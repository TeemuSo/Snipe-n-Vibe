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
// ShootingSystem no longer used — replaced by projectile-based ballistics
import { HUD } from './hud/HUD';
import { Scoreboard } from './hud/Scoreboard';
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
  ScoreEntry,
} from '@dayzcopy/shared';
import { BulletTracerManager } from './rendering/BulletTracer';

async function main() {
  const hud = new HUD();
  const scoreboard = new Scoreboard();
  const audioManager = new AudioManager();

  // Network — connect early so we can show "Connecting..." state
  const networkManager = new NetworkManager();
  const isSecure = window.location.protocol === 'https:';
  const wsUrl = import.meta.env.VITE_WS_URL
    || (isSecure
      ? `wss://${window.location.host}`
      : `ws://${window.location.hostname || 'localhost'}:8080`);
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
  const bulletTracerManager = new BulletTracerManager(renderer.scene);

  // Wire bullet impact effects: when tracer hits ground, spawn explosion + decal + sound
  bulletTracerManager.onBulletImpact = (point, normal) => {
    effectsManager.spawnBulletImpactExplosion(point, normal);
    effectsManager.spawnBulletDecal(point, normal);
    audioManager.playImpact();
  };

  const remotePlayers = new Map<number, RemotePlayer>();

  // === MW2-style Kill Streak State ===
  let killsThisLife = 0;
  let totalKills = 0;
  let currentStreak = 0;

  // Streak thresholds
  const STREAK_MESSAGES: [number, string][] = [
    [2, 'DOUBLE KILL'],
    [3, 'TRIPLE KILL'],
    [5, 'KILLING SPREE'],
    [7, 'RAMPAGE'],
    [10, 'UNSTOPPABLE'],
    [15, 'GODLIKE'],
  ];

  function getStreakMessage(streak: number): string | null {
    // Find the highest threshold that matches
    for (let i = STREAK_MESSAGES.length - 1; i >= 0; i--) {
      if (streak === STREAK_MESSAGES[i][0]) {
        return STREAK_MESSAGES[i][1];
      }
    }
    return null;
  }

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

  // Tab key: hold to show scoreboard, release to hide
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      scoreboard.show();
    }
  });
  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      scoreboard.hide();
    }
  });

  // Score update callback
  networkManager.onScoresUpdate = (scores: ScoreEntry[]) => {
    scoreboard.updateScores(scores);
  };

  // Set local player ID on scoreboard when init is received
  networkManager.onInitReceived = (_playerId: number, _snapshot) => {
    scoreboard.setLocalPlayerId(_playerId);
  };

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

  networkManager.onDamageReceived = (damage: number, _shooterId: number) => {
    effectsManager.showDamageVignette();
    localPlayer.hp -= damage;
    if (localPlayer.hp < 0) localPlayer.hp = 0;
  };

  networkManager.onPlayerDied = (deadId: number, killerId: number) => {
    if (deadId === networkManager.getLocalPlayerId()) {
      // === Local player died ===
      hud.showDeathScreen(killerId);
      audioManager.playDeath();

      // Reset streak on death
      killsThisLife = 0;
      currentStreak = 0;
      hud.updateKillCounter(0);

      // Scope out on death
      if (weaponManager.isScoped) {
        weaponManager.scopeOut();
        fpsCamera.setScoped(false);
        fpsCamera.setHoldingBreath(false);
        isHoldingBreath = false;
        hud.hideScope();
      }
      // Respawn after 3s — trust server position from next snapshot
      // (death screen auto-hides via HUD.showDeathScreen timeout)
      setTimeout(() => {
        localPlayer.hp = 100;
      }, 3000);
    } else if (killerId === networkManager.getLocalPlayerId()) {
      // === We killed someone — MW2 feedback ===
      const wasHeadshot = lastConfirmedHitType === 2;

      // Update kill counts
      killsThisLife++;
      totalKills++;
      currentStreak++;

      // Show kill confirmation effects
      effectsManager.showKillConfirmation();
      hud.showKillConfirmation(deadId, wasHeadshot);
      audioManager.playKillConfirm();

      // Update kill counter HUD
      hud.updateKillCounter(killsThisLife);

      // XP popup
      const xp = wasHeadshot ? 150 : 100;
      hud.showXPPopup(xp, wasHeadshot);

      // Streak announcement
      const streakMsg = getStreakMessage(currentStreak);
      if (streakMsg) {
        hud.showStreakAnnouncement(streakMsg);
      }

      lastConfirmedHitType = 0;

      // Play death animation on the killed remote player/bot
      const rp = remotePlayers.get(deadId);
      if (rp) {
        rp.playDeathAnimation();
      }
    } else {
      // Someone else killed someone else — just play death animation
      const rp = remotePlayers.get(deadId);
      if (rp) {
        rp.playDeathAnimation();
      }
    }

    hud.addKillFeedEntry(`Player ${killerId}`, `Player ${deadId}`);
  };

  // Server-authoritative hit feedback (projectile-based — no client-side prediction)
  networkManager.onHitConfirmed = (_hit: boolean, hitType: number) => {
    if (hitType === 2) {
      lastConfirmedHitType = 2;
      effectsManager.showHeadshotMarker();
      audioManager.playHeadshot();
    } else if (hitType === 1) {
      lastConfirmedHitType = 1;
      effectsManager.showHitMarker();
      audioManager.playHitMarker();
    } else {
      lastConfirmedHitType = 0;
    }
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
    const dt = Math.max(1 / 128, Math.min(1 / 15, input.deltaTime));
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
        // Only reset dead state when the server shows the entity alive again (hp > 0)
        const remoteData = networkManager.getRemotePlayers().get(id);
        if (rp.dead && remoteData && remoteData.state.hp > 0) {
          rp.show();
        }
        rp.updateFromState(interpolated);
      }
      rp.interpolate(dt);
    });

    effectsManager.update(now);
    bulletTracerManager.update(dt);

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

        // Get camera direction for tracer and network shoot
        const camDir = new THREE.Vector3();
        fpsCamera.camera.getWorldDirection(camDir);
        const origin: Vec3 = {
          x: fpsCamera.camera.position.x,
          y: fpsCamera.camera.position.y,
          z: fpsCamera.camera.position.z,
        };
        const direction: Vec3 = { x: camDir.x, y: camDir.y, z: camDir.z };

        // Spawn visible tracer bullet
        bulletTracerManager.spawnBullet(origin, direction);

        // Send shot to server (server does projectile simulation)
        networkManager.sendShoot(origin, direction, 0);

        effectsManager.spawnMuzzleFlash(localPlayer.position);
        audioManager.playGunshot();

        // Scope stays up — no scope-out on fire
      }
    }

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
