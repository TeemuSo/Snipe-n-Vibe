import RAPIER from '@dimforge/rapier3d-compat';
import {
  Vec3,
  PlayerState,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  MOVE_SPEED,
  SPRINT_MULTIPLIER,
  GRAVITY,
  JUMP_IMPULSE,
  MAGAZINE_SIZE,
  MAX_HP,
} from '@dayzcopy/shared';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

export class LocalPlayer {
  position: Vec3;
  velocity: Vec3 = { x: 0, y: 0, z: 0 };
  yaw = 0;
  pitch = 0;
  hp = MAX_HP;
  ammo = MAGAZINE_SIZE;
  isReloading = false;
  isSprinting = false;
  isGrounded = false;

  characterController: RAPIER.KinematicCharacterController;
  collider: RAPIER.Collider;
  rigidBody: RAPIER.RigidBody;

  private world: RAPIER.World;

  constructor(world: RAPIER.World, spawnPos: Vec3) {
    this.world = world;
    this.position = { ...spawnPos };

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      spawnPos.x,
      spawnPos.y + PLAYER_HEIGHT / 2,
      spawnPos.z
    );
    this.rigidBody = world.createRigidBody(bodyDesc);

    const halfHeight = PLAYER_HEIGHT / 2 - PLAYER_RADIUS;
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, PLAYER_RADIUS);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    this.characterController = world.createCharacterController(0.01);
    this.characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    this.characterController.enableAutostep(0.3, 0.2, true);
    this.characterController.enableSnapToGround(0.3);
  }

  update(dt: number, input: MovementInput, yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = pitch;
    this.isSprinting = input.sprint && (input.forward || input.backward || input.left || input.right);

    const speed = this.isSprinting ? MOVE_SPEED * SPRINT_MULTIPLIER : MOVE_SPEED;

    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    let moveX = 0;
    let moveZ = 0;

    if (input.forward) {
      moveX -= sinYaw;
      moveZ -= cosYaw;
    }
    if (input.backward) {
      moveX += sinYaw;
      moveZ += cosYaw;
    }
    if (input.left) {
      moveX -= cosYaw;
      moveZ += sinYaw;
    }
    if (input.right) {
      moveX += cosYaw;
      moveZ -= sinYaw;
    }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      moveX = (moveX / len) * speed;
      moveZ = (moveZ / len) * speed;
    }

    if (!this.isGrounded) {
      this.velocity.y += GRAVITY * dt;
    }

    if (input.jump && this.isGrounded) {
      this.velocity.y = JUMP_IMPULSE;
      this.isGrounded = false;
    }

    const desiredTranslation = {
      x: moveX * dt,
      y: this.velocity.y * dt,
      z: moveZ * dt,
    };

    this.characterController.computeColliderMovement(this.collider, desiredTranslation);

    const movement = this.characterController.computedMovement();
    const currentPos = this.rigidBody.translation();

    const newPos = {
      x: currentPos.x + movement.x,
      y: currentPos.y + movement.y,
      z: currentPos.z + movement.z,
    };

    this.rigidBody.setNextKinematicTranslation(newPos);

    this.isGrounded = this.characterController.computedGrounded();
    if (this.isGrounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }

    const finalPos = this.rigidBody.translation();
    this.position = {
      x: finalPos.x,
      y: finalPos.y - PLAYER_HEIGHT / 2,
      z: finalPos.z,
    };
  }

  getState(): PlayerState {
    return {
      id: 0,
      position: { ...this.position },
      velocity: { ...this.velocity },
      yaw: this.yaw,
      pitch: this.pitch,
      hp: this.hp,
      ammo: this.ammo,
      isReloading: this.isReloading,
      isSprinting: this.isSprinting,
      lastProcessedInput: 0,
    };
  }

  applyServerState(state: PlayerState): void {
    this.position = { ...state.position };
    this.velocity = { ...state.velocity };
    this.hp = state.hp;
    this.ammo = state.ammo;

    this.rigidBody.setNextKinematicTranslation({
      x: state.position.x,
      y: state.position.y + PLAYER_HEIGHT / 2,
      z: state.position.z,
    });
  }

  teleport(pos: Vec3): void {
    this.position = { ...pos };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.rigidBody.setNextKinematicTranslation({
      x: pos.x,
      y: pos.y + PLAYER_HEIGHT / 2,
      z: pos.z,
    });
  }
}
