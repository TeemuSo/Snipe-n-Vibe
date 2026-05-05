import * as THREE from 'three';
import { Vec3, vec3Lerp, lerpAngle } from '@dayzcopy/shared';
import { createPlayerMesh } from './PlayerModel';

const PLAYER_COLORS = [0x3D4F2F, 0x4A5C3A, 0x354828, 0x2F4A3D, 0x3A5C4A, 0x28483A, 0x3D4A2F, 0x4F5C3D];

export class RemotePlayer {
  id: number;
  mesh: THREE.Group;
  targetPosition: Vec3 = { x: 0, y: 0, z: 0 };
  targetYaw = 0;
  currentPosition: Vec3 = { x: 0, y: 0, z: 0 };
  currentYaw = 0;
  private initialized = false;
  private isDead = false;
  private deathAnimProgress = 0;
  private deathAnimDuration = 0.3; // seconds to fall forward

  constructor(id: number, scene: THREE.Scene) {
    this.id = id;
    const color = PLAYER_COLORS[id % PLAYER_COLORS.length];
    this.mesh = createPlayerMesh(color);

    // Set playerId on the group itself AND all child meshes so raycasting can identify hits
    this.mesh.userData.playerId = id;
    this.mesh.traverse((child) => {
      child.userData.playerId = id;
    });

    scene.add(this.mesh);
  }

  updateFromState(state: { position: Vec3; yaw: number; pitch: number }): void {
    if (this.isDead) return; // Don't update position while dead

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
    // Handle death animation
    if (this.isDead) {
      if (this.deathAnimProgress < 1) {
        this.deathAnimProgress = Math.min(1, this.deathAnimProgress + dt / this.deathAnimDuration);
        // Tilt forward (around X axis) to simulate falling face-down
        this.mesh.rotation.x = (Math.PI / 2) * this.easeOutQuad(this.deathAnimProgress);
      }
      return;
    }

    const factor = Math.min(1, 15 * dt);
    this.currentPosition = vec3Lerp(this.currentPosition, this.targetPosition, factor);
    this.currentYaw = lerpAngle(this.currentYaw, this.targetYaw, factor);

    // Position the mesh so Y=0 of the group is at foot level
    // The group's origin is at feet (Y=0), so we place the group at ground level
    this.mesh.position.set(
      this.currentPosition.x,
      this.currentPosition.y,
      this.currentPosition.z
    );
    this.mesh.rotation.y = this.currentYaw;
  }

  playDeathAnimation(): void {
    this.isDead = true;
    this.deathAnimProgress = 0;
  }

  reset(): void {
    this.isDead = false;
    this.deathAnimProgress = 0;
    this.mesh.rotation.x = 0;
    this.mesh.visible = true;
    // Make all materials fully opaque again
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material.opacity = 1;
        child.material.transparent = false;
      }
    });
  }

  hide(): void {
    this.mesh.visible = false;
  }

  show(): void {
    this.mesh.visible = true;
    this.reset();
  }

  get dead(): boolean {
    return this.isDead;
  }

  private easeOutQuad(t: number): number {
    return t * (2 - t);
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
