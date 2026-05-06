import RAPIER from '@dimforge/rapier3d-compat';
import {
  Vec3,
  PlayerState,
  InputPayload,
  MOVE_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_IMPULSE,
  JUMP_CUT_MULTIPLIER,
  GRAVITY,
  MAX_HP,
  FIRE_RATE,
  MAGAZINE_SIZE,
  RELOAD_TIME,
  PLAYER_HEIGHT,
} from '@dayzcopy/shared';

export class PlayerEntity {
  id: number;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  hp: number;
  ammo: number;
  isReloading: boolean;
  isSprinting: boolean;
  isGrounded: boolean;
  jumpHeld: boolean;
  lastProcessedInput: number;
  lastFireTime: number;
  reloadStartTime: number;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  characterController: RAPIER.KinematicCharacterController;
  inputQueue: InputPayload[];

  constructor(
    id: number,
    rigidBody: RAPIER.RigidBody,
    collider: RAPIER.Collider,
    characterController: RAPIER.KinematicCharacterController,
    spawnPos: Vec3
  ) {
    this.id = id;
    this.position = { ...spawnPos };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.hp = MAX_HP;
    this.ammo = MAGAZINE_SIZE;
    this.isReloading = false;
    this.isSprinting = false;
    this.isGrounded = false;
    this.jumpHeld = false;
    this.lastProcessedInput = 0;
    this.lastFireTime = 0;
    this.reloadStartTime = 0;
    this.rigidBody = rigidBody;
    this.collider = collider;
    this.characterController = characterController;
    this.inputQueue = [];
  }

  queueInput(input: InputPayload): void {
    if (this.inputQueue.length < 10) {
      this.inputQueue.push(input);
    }
  }

  processInput(input: InputPayload, world: RAPIER.World): void {
    const dt = Math.max(1 / 128, Math.min(1 / 15, input.deltaTime));

    this.yaw = input.yaw;
    this.pitch = input.pitch;
    this.isSprinting = input.sprint;

    if (input.reload && !this.isReloading && this.ammo < MAGAZINE_SIZE) {
      this.isReloading = true;
      this.reloadStartTime = performance.now();
    }

    if (this.isReloading) {
      if (performance.now() - this.reloadStartTime >= RELOAD_TIME) {
        this.ammo = MAGAZINE_SIZE;
        this.isReloading = false;
      }
    }

    let moveX = 0;
    let moveZ = 0;

    if (input.forward) {
      moveX -= Math.sin(this.yaw);
      moveZ -= Math.cos(this.yaw);
    }
    if (input.backward) {
      moveX += Math.sin(this.yaw);
      moveZ += Math.cos(this.yaw);
    }
    if (input.left) {
      moveX -= Math.cos(this.yaw);
      moveZ += Math.sin(this.yaw);
    }
    if (input.right) {
      moveX += Math.cos(this.yaw);
      moveZ -= Math.sin(this.yaw);
    }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
    }

    let speed = MOVE_SPEED;
    if (input.sprint) {
      speed *= SPRINT_MULTIPLIER;
    }

    this.velocity.x = moveX * speed;
    this.velocity.z = moveZ * speed;

    if (this.isGrounded && input.jump) {
      this.velocity.y = JUMP_IMPULSE;
    }

    // Variable jump height: cut upward velocity on early release
    if (this.jumpHeld && !input.jump && this.velocity.y > 0) {
      this.velocity.y *= JUMP_CUT_MULTIPLIER;
    }

    this.velocity.y += GRAVITY * dt;

    const translation = {
      x: this.velocity.x * dt,
      y: this.velocity.y * dt,
      z: this.velocity.z * dt,
    };

    this.characterController.computeColliderMovement(this.collider, translation);

    const movement = this.characterController.computedMovement();
    const currentPos = this.rigidBody.translation();
    const newPos = {
      x: currentPos.x + movement.x,
      y: currentPos.y + movement.y,
      z: currentPos.z + movement.z,
    };

    this.rigidBody.setNextKinematicTranslation(newPos);

    // Store as foot position (capsule center minus half height)
    this.position = { x: newPos.x, y: newPos.y - PLAYER_HEIGHT / 2, z: newPos.z };

    this.isGrounded = this.characterController.computedGrounded();
    if (this.isGrounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }

    this.jumpHeld = input.jump;
    this.lastProcessedInput = input.seq;
  }

  applyDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.collider.setEnabled(false);
      return true;
    }
    return false;
  }

  respawn(pos: Vec3): void {
    this.hp = MAX_HP;
    this.ammo = MAGAZINE_SIZE;
    this.isReloading = false;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.position = { ...pos };
    // pos is foot position; rigid body needs capsule center
    this.rigidBody.setNextKinematicTranslation({ x: pos.x, y: pos.y + PLAYER_HEIGHT / 2, z: pos.z });
    this.collider.setEnabled(true);
  }

  canFire(): boolean {
    if (this.isReloading) return false;
    if (this.ammo <= 0) return false;
    const now = performance.now();
    const fireInterval = 60000 / FIRE_RATE;
    return now - this.lastFireTime >= fireInterval;
  }

  fire(): void {
    this.ammo--;
    this.lastFireTime = performance.now();
  }

  getState(): PlayerState {
    return {
      id: this.id,
      position: { ...this.position },
      velocity: { ...this.velocity },
      yaw: this.yaw,
      pitch: this.pitch,
      hp: this.hp,
      ammo: this.ammo,
      isReloading: this.isReloading,
      isSprinting: this.isSprinting,
      lastProcessedInput: this.lastProcessedInput,
    };
  }

  syncFromPhysics(): void {
    const pos = this.rigidBody.translation();
    // Convert capsule center to foot position
    this.position = { x: pos.x, y: pos.y - PLAYER_HEIGHT / 2, z: pos.z };
  }
}
