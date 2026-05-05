import RAPIER from '@dimforge/rapier3d-compat';
import {
  Vec3,
  MAP_SIZE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  TICK_INTERVAL,
  getAllMapBoxes,
} from '@dayzcopy/shared';

interface RaycastResult {
  hit: boolean;
  colliderHandle?: number;
  point?: Vec3;
  distance?: number;
}

export class PhysicsWorld {
  world: RAPIER.World;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.buildTerrain();
    this.buildMapGeometry();
  }

  private buildTerrain(): void {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(MAP_SIZE / 2, 0.5, MAP_SIZE / 2);
    this.world.createCollider(colliderDesc, body);
  }

  private buildMapGeometry(): void {
    const allBoxes = getAllMapBoxes();
    for (const box of allBoxes) {
      this.createBox(box.x, box.y, box.z, box.halfW, box.halfH, box.halfD);
    }
  }

  private createBox(x: number, y: number, z: number, halfW: number, halfH: number, halfD: number): void {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD);
    this.world.createCollider(colliderDesc, body);
  }

  createPlayerBody(position: Vec3): {
    rigidBody: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    characterController: RAPIER.KinematicCharacterController;
  } {
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z);
    const rigidBody = this.world.createRigidBody(bodyDesc);

    const halfHeight = PLAYER_HEIGHT / 2 - PLAYER_RADIUS;
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, PLAYER_RADIUS);
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    const characterController = this.world.createCharacterController(0.01);
    characterController.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    characterController.setMinSlopeSlideAngle((30 * Math.PI) / 180);
    characterController.enableAutostep(0.3, 0.2, true);
    characterController.enableSnapToGround(0.3);

    return { rigidBody, collider, characterController };
  }

  removePlayerBody(rigidBody: RAPIER.RigidBody, collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, true);
    this.world.removeRigidBody(rigidBody);
  }

  step(): void {
    this.world.timestep = TICK_INTERVAL / 1000;
    this.world.step();
  }

  castRay(
    origin: Vec3,
    direction: Vec3,
    maxDist: number,
    excludeCollider?: RAPIER.Collider
  ): RaycastResult {
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.world.castRay(
      ray,
      maxDist,
      true,
      undefined,
      undefined,
      excludeCollider
    );

    if (!hit) {
      return { hit: false };
    }

    const point = {
      x: origin.x + direction.x * hit.timeOfImpact,
      y: origin.y + direction.y * hit.timeOfImpact,
      z: origin.z + direction.z * hit.timeOfImpact,
    };

    return {
      hit: true,
      colliderHandle: hit.collider.handle,
      point,
      distance: hit.timeOfImpact,
    };
  }

  setColliderPosition(collider: RAPIER.Collider, pos: Vec3): void {
    collider.setTranslation({ x: pos.x, y: pos.y, z: pos.z });
  }

  getWorld(): RAPIER.World {
    return this.world;
  }
}
