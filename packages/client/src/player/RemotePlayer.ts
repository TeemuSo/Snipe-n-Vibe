import * as THREE from 'three';
import { Vec3, vec3Lerp, lerpAngle, PLAYER_HEIGHT, PLAYER_RADIUS } from '@dayzcopy/shared';
import { createPlayerMesh } from './PlayerModel';

const PLAYER_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xecf0f1];

export class RemotePlayer {
  id: number;
  mesh: THREE.Group;
  targetPosition: Vec3 = { x: 0, y: 0, z: 0 };
  targetYaw = 0;
  currentPosition: Vec3 = { x: 0, y: 0, z: 0 };
  currentYaw = 0;
  private initialized = false;

  constructor(id: number, scene: THREE.Scene) {
    this.id = id;
    const color = PLAYER_COLORS[id % PLAYER_COLORS.length];
    this.mesh = createPlayerMesh(color);
    scene.add(this.mesh);
  }

  updateFromState(state: { position: Vec3; yaw: number; pitch: number }): void {
    // On first update snap current position so the mesh doesn't lerp from origin
    if (!this.initialized) {
      this.currentPosition = { ...state.position };
      this.currentYaw = state.yaw;
      this.initialized = true;
    }
    this.targetPosition = { ...state.position };
    this.targetYaw = state.yaw;
  }

  interpolate(dt: number): void {
    const factor = Math.min(1, 15 * dt);
    this.currentPosition = vec3Lerp(this.currentPosition, this.targetPosition, factor);
    this.currentYaw = lerpAngle(this.currentYaw, this.targetYaw, factor);

    this.mesh.position.set(
      this.currentPosition.x,
      this.currentPosition.y + PLAYER_HEIGHT / 2,
      this.currentPosition.z
    );
    this.mesh.rotation.y = this.currentYaw;
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
