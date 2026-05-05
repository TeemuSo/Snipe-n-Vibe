import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Renderer } from './rendering/Renderer';
import { WorldBuilder } from './rendering/WorldBuilder';
import { EffectsManager } from './rendering/EffectsManager';
import { ClientPhysics } from './physics/ClientPhysics';
import { InputManager } from './input/InputManager';
import { FPSCamera } from './camera/FPSCamera';
import { LocalPlayer } from './player/LocalPlayer';
import { RemotePlayer } from './player/RemotePlayer';
import { NetworkManager } from './network/NetworkManager';
import { WeaponManager } from './weapons/WeaponManager';
import { RecoilSystem } from './weapons/RecoilSystem';
import { ShootingSystem } from './weapons/ShootingSystem';
import { HUD } from './hud/HUD';
import { AudioManager } from './audio/AudioManager';
import {
  MOVE_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_IMPULSE,
  JUMP_CUT_MULTIPLIER,
  GRAVITY,
  TICK_INTERVAL,
  SCOPE_SENSITIVITY_MULTIPLIER,
  HOLD_BREATH_DURATION,
  HOLD_BREATH_COOLDOWN,
  MAGAZINE_SIZE,
  InputPayload,
  PlayerState,
  Vec3,
} from '@dayzcopy/shared';

async function main() {
  const hud = new HUD();
  const audioManager = new AudioManager();

  // Network — connect early so we can show "Connecting..." state
  const networkManager = new NetworkManager();
  const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname || 'localhost'}:8080`;
  networkManager.connect(wsUrl);

  // Wait for WebSocket connection, then transition start screen to "Click to Play"
  await new Promise<void>((resolve) => {
    if (networkManager.connected) {
      resolve();
    } else {
      const originalOnConnect = networkManager.connection.onConnect;
      networkManager.connection.onConnect = () => {
        if (originalOnConnect) originalOnConnect();
        resolve();
      };
    }
  });
  hud.showStartScreenReady();

  // Init Rapier WASM in parallel while user reads the start screen
  await RAPIER.init();

  // Renderer
  const renderer = new Renderer();
  const canvas = renderer.getCanvas();

  // Wait for user click to start — this single click also acquires pointer lock
  await new Promise<void>((resolve) => {
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
      startScreen.addEventListener('click', () => {
        hud.hideStartScreen();
        canvas.requestPointerLock();
        resolve();
      }, { once: true });
    } else {
      canvas.requestPointerLock();
      resolve();
    }
  });

  // Initialize audio after user gesture (required by browsers)
  audioManager.init();

  // Physics
  const physics = await ClientPhysics.init();

  // World
  const worldBuilder = new WorldBuilder();
  worldBuilder.build(renderer.scene, physics);
  const spawnPoints = worldBuilder.getSpawnPoints();
  const spawnPos = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

  // Camera
  const fpsCamera = new FPSCamera(window.innerWidth / window.innerHeight);

  // Input
  const inputManager = new InputManager();
  inputManager.init(canvas);

  // Local player
  const localPlayer = new LocalPlayer(physics.world, spawnPos);

  // Weapons
  const weaponManager = new WeaponManager();
  const recoilSystem = new RecoilSystem();
  const effectsManager = new EffectsManager(renderer.scene);
  const shootingSystem = new ShootingSystem(renderer.scene, fpsCamera.camera);

  const remotePlayers = new Map<number, RemotePlayer>();

  // Pause overlay: show when pointer lock is lost, hide when re-acquired
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      hud.hidePauseOverlay();
    } else {
      hud.showPauseOverlay();
    }
  });

  // Click on pause overlay to re-acquire pointer lock
  const pauseOverlay = document.getElementById('pause-overlay');
  if (pauseOverlay) {
    pauseOverlay.addEventListener('click', () => {
      inputManager.requestPointerLock();
    });
  }

  // Hold breath state
  let holdBreathStart = 0;
  let holdBreathCooldownEnd = 0;
  let isHoldingBreath = false;

  // Prevent context menu on right click
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Right mouse button for scope toggle
  document.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button === 2 && inputManager.isLocked()) {
      weaponManager.toggleScope();
      if (weaponManager.isScoped) {
        fpsCamera.setScoped(true);
        hud.showScope();
      } else {
        fpsCamera.setScoped(false);
        fpsCamera.setHoldingBreath(false);
        isHoldingBreath = false;
        hud.hideScope();
      }
    }
  });

  // Network callbacks
  networkManager.onPlayerJoin = (id: number, pos: Vec3) => {
    if (!remotePlayers.has(id)) {
      const rp = new RemotePlayer(id, renderer.scene);
      rp.updateFromState({ position: pos, yaw: 0, pitch: 0 });
      remotePlayers.set(id, rp);
    }
  };

  networkManager.onPlayerLeave = (id: number) => {
    const rp = remotePlayers.get(id);
    if (rp) {
      rp.destroy(renderer.scene);
      remotePlayers.delete(id);
    }
  };

  // Track last confirmed hit type for kill feedback (was it a headshot kill?)
  let lastConfirmedHitType = 0;

  networkManager.onHitConfirmed = (_hit: boolean, hitType: number) => {
    // Server authoritative confirmation — record type for kill feedback.
    // Instant hit feedback is already provided by onLocalHit (client prediction).
    // If server says headshot but client didn't predict it, upgrade the feedback.
    if (hitType === 2) {
      lastConfirmedHitType = 2;
    } else if (hitType === 1) {
      lastConfirmedHitType = 1;
    } else {
      lastConfirmedHitType = 0;
    }
  };

  networkManager.onDamageReceived = (damage: number, _shooterId: number) => {
    effectsManager.showDamageVignette();
    localPlayer.hp -= damage;
    if (localPlayer.hp < 0) localPlayer.hp = 0;
  };

  networkManager.onPlayerDied = (deadId: number, killerId: number) => {
    if (deadId === networkManager.getLocalPlayerId()) {
      hud.showDeathScreen(killerId);
      audioManager.playDeath();
      // Scope out on death
      if (weaponManager.isScoped) {
        weaponManager.scopeOut();
        fpsCamera.setScoped(false);
        fpsCamera.setHoldingBreath(false);
        isHoldingBreath = false;
        hud.hideScope();
      }
      // Respawn after 3s
      setTimeout(() => {
        const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        localPlayer.teleport(sp);
        localPlayer.hp = 100;
      }, 3000);
    } else if (killerId === networkManager.getLocalPlayerId()) {
      // We killed someone - show kill confirmation
      const wasHeadshot = lastConfirmedHitType === 2;
      effectsManager.showKillConfirmation();
      hud.showKillConfirmation(deadId, wasHeadshot);
      audioManager.playKillConfirm();
      lastConfirmedHitType = 0;
    }
    hud.addKillFeedEntry(`Player ${killerId}`, `Player ${deadId}`);
  };

  // Provide world geometry to ShootingSystem for surface raycasting
  shootingSystem.setWorldObjects(worldBuilder.structures);

  // Local hit prediction callback - show instant feedback for headshot vs body
  shootingSystem.onLocalHit = (_playerId: number, _point: Vec3, isHeadshot: boolean) => {
    // Instant client-side feedback (server will confirm authoritatively)
    if (isHeadshot) {
      effectsManager.showHeadshotMarker();
      audioManager.playHeadshot();
    } else {
      effectsManager.showHitMarker();
      audioManager.playHitMarker();
    }
  };

  // Shooting callback - notify the server about shot
  shootingSystem.onShoot = (origin: Vec3, direction: Vec3) => {
    networkManager.sendShoot(origin, direction, 0);
  };

  // Surface hit callback - spawn bullet decal at impact point
  shootingSystem.onSurfaceHit = (point: Vec3, normal: Vec3) => {
    effectsManager.spawnBulletDecal(point, normal);
    audioManager.playImpact();
  };

  // Pointer lock re-acquisition on canvas click (e.g., after pressing Escape)
  canvas.addEventListener('click', () => {
    if (!inputManager.isLocked()) {
      inputManager.requestPointerLock();
    }
  });

  // Replay function for server reconciliation
  let replayJumpHeld = false;
  const replayFn = (state: PlayerState, input: InputPayload): PlayerState => {
    const dt = input.deltaTime;
    const speed = input.sprint ? MOVE_SPEED * SPRINT_MULTIPLIER : MOVE_SPEED;
    let dx = 0;
    let dz = 0;
    if (input.forward) dz -= 1;
    if (input.backward) dz += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      dx /= len;
      dz /= len;
    }

    const cos = Math.cos(input.yaw);
    const sin = Math.sin(input.yaw);
    const moveX = (dx * cos + dz * sin) * speed * dt;
    const moveZ = (-dx * sin + dz * cos) * speed * dt;

    // Vertical physics (must match server processInput)
    let vy = state.velocity.y;
    const isGrounded = state.position.y <= 0 && vy <= 0;

    if (isGrounded && input.jump) {
      vy = JUMP_IMPULSE;
    }

    // Variable jump height: cut upward velocity on early release
    if (replayJumpHeld && !input.jump && vy > 0) {
      vy *= JUMP_CUT_MULTIPLIER;
    }

    vy += GRAVITY * dt;

    let newY = state.position.y + vy * dt;
    if (newY <= 0 && vy < 0) {
      newY = 0;
      vy = 0;
    }

    replayJumpHeld = input.jump;

    return {
      ...state,
      position: {
        x: state.position.x + moveX,
        y: newY,
        z: state.position.z + moveZ,
      },
      velocity: {
        ...state.velocity,
        y: vy,
      },
    };
  };

  // Resize handler
  window.addEventListener('resize', () => {
    fpsCamera.resize(window.innerWidth / window.innerHeight);
  });

  // Track previous scope state to detect transitions from auto re-scope
  let wasScoped = false;

  // Game loop
  let lastTime = performance.now();
  let lastSendTime = 0;
  let inputSeq = 0;

  function gameLoop(now: number): void {
    requestAnimationFrame(gameLoop);

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Always process network and render remote players, even before pointer lock
    replayJumpHeld = false;
    const netResult = networkManager.processMessages(replayFn);
    if (netResult.correctedState && inputManager.isLocked()) {
      localPlayer.applyServerState(netResult.correctedState);
    }

    const nowMs = performance.now();
    remotePlayers.forEach((rp, id) => {
      const interpolated = networkManager.getInterpolatedState(id, nowMs);
      if (interpolated) {
        rp.updateFromState(interpolated);
      }
      rp.interpolate(dt);
    });

    effectsManager.update(now);

    if (!inputManager.isLocked()) {
      renderer.render(fpsCamera.camera);
      return;
    }

    // Poll input
    const { dx, dy, keys, mouseLeftDown, mouseRightDown: _mouseRightDown } = inputManager.poll();

    // Determine effective sensitivity (reduced when scoped)
    let currentSensitivity = inputManager.sensitivity;
    if (weaponManager.isScoped) {
      currentSensitivity *= SCOPE_SENSITIVITY_MULTIPLIER;
    }

    // Camera look
    fpsCamera.update(dx, dy, currentSensitivity);

    // Hold breath logic (Shift when scoped = hold breath, Shift when unscoped = sprint)
    if (weaponManager.isScoped && keys.has('ShiftLeft')) {
      const canHoldBreath = now >= holdBreathCooldownEnd;
      if (canHoldBreath && !isHoldingBreath) {
        isHoldingBreath = true;
        holdBreathStart = now;
        fpsCamera.setHoldingBreath(true);
      }
      // Check duration limit
      if (isHoldingBreath && (now - holdBreathStart) >= HOLD_BREATH_DURATION) {
        // Breath exhausted
        isHoldingBreath = false;
        fpsCamera.setHoldingBreath(false);
        holdBreathCooldownEnd = now + HOLD_BREATH_COOLDOWN;
      }
    } else {
      if (isHoldingBreath) {
        isHoldingBreath = false;
        fpsCamera.setHoldingBreath(false);
        // Start cooldown if breath was actually used
        if ((now - holdBreathStart) > 100) {
          holdBreathCooldownEnd = now + HOLD_BREATH_COOLDOWN;
        }
      }
    }

    // Recoil recovery
    recoilSystem.update(dt);

    // Shooting (left mouse)
    if (mouseLeftDown && weaponManager.canFire()) {
      if (weaponManager.fire()) {
        const shotIndex = weaponManager.getShotIndex();
        const recoil = recoilSystem.applyRecoil(shotIndex);
        fpsCamera.yaw += recoil.yawDelta;
        fpsCamera.pitch += recoil.pitchDelta;

        // Get remote player meshes for raycasting
        const remotePlayerMeshes: THREE.Object3D[] = [];
        remotePlayers.forEach((rp) => remotePlayerMeshes.push(rp.mesh));

        shootingSystem.shoot(remotePlayerMeshes);
        effectsManager.spawnMuzzleFlash(localPlayer.position);
        audioManager.playGunshot();

        // If was scoped, the weaponManager.fire() already kicked us out.
        // Update camera/HUD to reflect scope-out.
        if (wasScoped && !weaponManager.isScoped) {
          fpsCamera.setScoped(false);
          fpsCamera.setHoldingBreath(false);
          isHoldingBreath = false;
          hud.hideScope();
        }
      }
    }

    // Detect scope state changes from auto re-scope
    if (weaponManager.isScoped && !wasScoped) {
      fpsCamera.setScoped(true);
      hud.showScope();
    }
    wasScoped = weaponManager.isScoped;

    // Reload
    if (keys.has('KeyR')) weaponManager.reload();
    weaponManager.update(dt);

    // Update scope FOV and sway
    fpsCamera.updateScope(dt, now);

    // Player movement -- sprint only when NOT scoped
    const isSprinting = !weaponManager.isScoped && keys.has('ShiftLeft');
    const moveInput = {
      forward: keys.has('KeyW'),
      backward: keys.has('KeyS'),
      left: keys.has('KeyA'),
      right: keys.has('KeyD'),
      jump: keys.has('Space'),
      sprint: isSprinting,
    };

    localPlayer.update(dt, moveInput, fpsCamera.yaw, fpsCamera.pitch);
    physics.step(dt);

    // Camera position follows player
    fpsCamera.setPosition(localPlayer.position.x, localPlayer.position.y, localPlayer.position.z);

    // Send input to network (throttled to tick rate)
    if (now - lastSendTime >= TICK_INTERVAL) {
      const input: InputPayload = {
        seq: inputSeq++,
        tick: 0,
        forward: moveInput.forward,
        backward: moveInput.backward,
        left: moveInput.left,
        right: moveInput.right,
        jump: moveInput.jump,
        sprint: moveInput.sprint,
        shoot: mouseLeftDown,
        reload: keys.has('KeyR'),
        yaw: fpsCamera.yaw,
        pitch: fpsCamera.pitch,
        deltaTime: dt,
      };
      networkManager.sendInput(input, localPlayer.getState());
      lastSendTime = now;
    }

    // Effects already updated above

    // HUD
    hud.updateHealth(localPlayer.hp, 100);
    if (!weaponManager.isScoped) {
      hud.updateAmmo(weaponManager.getAmmo(), MAGAZINE_SIZE);
    }

    // Render
    renderer.render(fpsCamera.camera);
  }

  requestAnimationFrame(gameLoop);
}

main();
