import RAPIER from '@dimforge/rapier3d-compat';
import { Vec3, MAP_SIZE } from '@dayzcopy/shared';

export class ClientPhysics {
  world: RAPIER.World;

  private constructor(world: RAPIER.World) {
    this.world = world;
  }

  static async init(): Promise<ClientPhysics> {
    await RAPIER.init();
    const gravity = { x: 0, y: -9.81, z: 0 };
    const world = new RAPIER.World(gravity);
    return new ClientPhysics(world);
  }

  createGround(): void {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(MAP_SIZE / 2, 0.5, MAP_SIZE / 2);
    this.world.createCollider(colliderDesc, body);
  }

  createBox(x: number, y: number, z: number, halfW: number, halfH: number, halfD: number): number {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD);
    const collider = this.world.createCollider(colliderDesc, body);
    return collider.handle;
  }

  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }

  raycast(origin: Vec3, direction: Vec3, maxDist: number): { point: Vec3; normal: Vec3 } | null {
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true);
    if (!hit) return null;

    const point = {
      x: origin.x + direction.x * hit.timeOfImpact,
      y: origin.y + direction.y * hit.timeOfImpact,
      z: origin.z + direction.z * hit.timeOfImpact,
    };

    return {
      point,
      normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
    };
  }
}
