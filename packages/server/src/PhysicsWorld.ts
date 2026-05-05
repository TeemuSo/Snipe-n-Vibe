import RAPIER from '@dimforge/rapier3d-compat';
import {
  Vec3,
  MAP_SIZE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  TICK_INTERVAL,
} from '@dayzcopy/shared';

interface RaycastResult {
  hit: boolean;
  colliderHandle?: number;
  point?: Vec3;
  distance?: number;
}

const BUILDING_POSITIONS = [
  { x: -30, z: -30 },
  { x: 30, z: 30 },
  { x: -40, z: 40 },
  { x: 50, z: -20 },
  { x: 0, z: 60 },
  { x: -60, z: 0 },
];

const BARRIER_POSITIONS: Vec3[] = [
  { x: 10, y: 0.6, z: -10 },
  { x: -15, y: 0.6, z: 15 },
  { x: 20, y: 0.6, z: 5 },
  { x: -25, y: 0.6, z: -5 },
  { x: 5, y: 0.6, z: 25 },
  { x: -10, y: 0.6, z: -25 },
  { x: 35, y: 0.6, z: -35 },
  { x: -35, y: 0.6, z: 35 },
  { x: 45, y: 0.6, z: 15 },
  { x: -50, y: 0.6, z: -15 },
];

const CRATE_POSITIONS: Vec3[] = [
  { x: 15, y: 0.5, z: -20 },
  { x: -20, y: 0.5, z: 10 },
  { x: 25, y: 0.5, z: 25 },
  { x: -30, y: 0.5, z: -20 },
  { x: 15, y: 1.5, z: -20 },
  { x: -20, y: 1.5, z: 10 },
];

export class PhysicsWorld {
  world: RAPIER.World;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.buildTerrain();
    this.buildBuildings();
    this.buildBarriers();
    this.buildCrates();
  }

  private buildTerrain(): void {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(MAP_SIZE / 2, 0.5, MAP_SIZE / 2);
    this.world.createCollider(colliderDesc, body);
  }

  private buildBuildings(): void {
    for (const building of BUILDING_POSITIONS) {
      const { x, z } = building;
      const wallHeight = 4;
      const wallLength = 10;
      const wallThickness = 0.3;

      this.createBox(x, wallHeight / 2, z - wallLength / 2, wallLength / 2, wallHeight / 2, wallThickness / 2);
      this.createBox(x - wallLength / 2, wallHeight / 2, z, wallThickness / 2, wallHeight / 2, wallLength / 2);
      this.createBox(x + wallLength / 2, wallHeight / 2, z, wallThickness / 2, wallHeight / 2, wallLength / 2);
    }
  }

  private buildBarriers(): void {
    for (const pos of BARRIER_POSITIONS) {
      this.createBox(pos.x, pos.y, pos.z, 1, 0.6, 0.2);
    }
  }

  private buildCrates(): void {
    for (const pos of CRATE_POSITIONS) {
      this.createBox(pos.x, pos.y, pos.z, 0.5, 0.5, 0.5);
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
