import * as THREE from 'three';
import { Vec3 } from '@dayzcopy/shared';

export class ShootingSystem {
  private raycaster: THREE.Raycaster;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private worldObjects: THREE.Object3D[] = [];
  public onShoot: ((origin: Vec3, direction: Vec3) => void) | null = null;
  public onLocalHit: ((playerId: number, point: Vec3) => void) | null = null;
  public onSurfaceHit: ((point: Vec3, normal: Vec3) => void) | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 200;
  }

  setWorldObjects(objects: THREE.Object3D[]): void {
    this.worldObjects = objects;
  }

  shoot(remotePlayers: THREE.Object3D[]): { hit: boolean; point?: Vec3; playerId?: number } {
    const origin: Vec3 = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
    };

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const direction: Vec3 = { x: dir.x, y: dir.y, z: dir.z };

    this.raycaster.set(this.camera.position, dir);

    // Raycast against remote players
    const playerIntersections = this.raycaster.intersectObjects(remotePlayers, true);

    // Raycast against world geometry
    const worldIntersections = this.raycaster.intersectObjects(this.worldObjects, true);

    // Determine closest player hit
    let closestPlayerHit: THREE.Intersection | null = null;
    let playerId: number | undefined;
    if (playerIntersections.length > 0) {
      closestPlayerHit = playerIntersections[0];
      let targetObject: THREE.Object3D | null = closestPlayerHit.object;
      while (targetObject) {
        if (targetObject.userData && targetObject.userData.playerId !== undefined) {
          playerId = targetObject.userData.playerId;
          break;
        }
        targetObject = targetObject.parent;
      }
    }

    // Determine closest world hit
    let closestWorldHit: THREE.Intersection | null = null;
    if (worldIntersections.length > 0) {
      closestWorldHit = worldIntersections[0];
    }

    let result: { hit: boolean; point?: Vec3; playerId?: number };

    // Compare distances to find the overall closest hit
    const playerDist = closestPlayerHit ? closestPlayerHit.distance : Infinity;
    const worldDist = closestWorldHit ? closestWorldHit.distance : Infinity;

    if (closestPlayerHit && playerDist <= worldDist && playerId !== undefined) {
      // Player hit is closest
      const point: Vec3 = {
        x: closestPlayerHit.point.x,
        y: closestPlayerHit.point.y,
        z: closestPlayerHit.point.z,
      };
      result = { hit: true, point, playerId };

      if (this.onLocalHit) {
        this.onLocalHit(playerId, point);
      }
    } else if (closestWorldHit) {
      // World surface hit is closest (or no player hit)
      const point: Vec3 = {
        x: closestWorldHit.point.x,
        y: closestWorldHit.point.y,
        z: closestWorldHit.point.z,
      };
      const normal: Vec3 = closestWorldHit.face
        ? { x: closestWorldHit.face.normal.x, y: closestWorldHit.face.normal.y, z: closestWorldHit.face.normal.z }
        : { x: 0, y: 1, z: 0 };

      // Transform face normal from object-local space to world space
      if (closestWorldHit.face) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(closestWorldHit.object.matrixWorld);
        const worldNormal = new THREE.Vector3(
          closestWorldHit.face.normal.x,
          closestWorldHit.face.normal.y,
          closestWorldHit.face.normal.z
        ).applyMatrix3(normalMatrix).normalize();
        normal.x = worldNormal.x;
        normal.y = worldNormal.y;
        normal.z = worldNormal.z;
      }

      result = { hit: true, point };

      if (this.onSurfaceHit) {
        this.onSurfaceHit(point, normal);
      }
    } else {
      result = { hit: false };
    }

    if (this.onShoot) {
      this.onShoot(origin, direction);
    }

    return result;
  }
}
