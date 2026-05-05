import * as THREE from 'three';
import { Vec3, BULLET_SPEED, BULLET_GRAVITY, BULLET_MAX_LIFETIME } from '@dayzcopy/shared';

const TRAIL_LENGTH = 15;

interface ActiveBullet {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  startTime: number;
  trail: THREE.Line;
  trailPositions: THREE.Vector3[];
}

export class BulletTracerManager {
  private scene: THREE.Scene;
  private bullets: ActiveBullet[] = [];
  private bulletGeometry: THREE.CapsuleGeometry;
  private bulletMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Shared geometry for all bullets — small bright capsule
    this.bulletGeometry = new THREE.CapsuleGeometry(0.02, 0.2, 2, 4);
    this.bulletMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 1.0,
      toneMapped: false,
    });
  }

  spawnBullet(origin: Vec3, direction: Vec3): void {
    // Normalize direction
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    const nx = direction.x / len;
    const ny = direction.y / len;
    const nz = direction.z / len;

    // Create bullet mesh (clone material so each bullet can fade independently)
    const mesh = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial.clone());
    mesh.position.set(origin.x, origin.y, origin.z);

    // Orient bullet along velocity direction
    // CapsuleGeometry is aligned along Y by default, so rotate Y axis to match velocity
    const velDir = new THREE.Vector3(nx, ny, nz);
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, velDir);
    mesh.quaternion.copy(quaternion);

    this.scene.add(mesh);

    // Create trail with fading colors
    const trailPositions: THREE.Vector3[] = [];
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      trailPositions.push(new THREE.Vector3(origin.x, origin.y, origin.z));
    }

    const trailGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(TRAIL_LENGTH * 3);
    const colors = new Float32Array(TRAIL_LENGTH * 4);
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
      // Fade from bright at head (i=0) to transparent at tail (i=TRAIL_LENGTH-1)
      const t = i / (TRAIL_LENGTH - 1);
      colors[i * 4] = 1.0;                           // R
      colors[i * 4 + 1] = 0.8 * (1 - t) + 0.3 * t;  // G: fades from bright to dim
      colors[i * 4 + 2] = 0.2 * (1 - t);             // B: fades out
      colors[i * 4 + 3] = 1.0 * (1 - t);             // A: fades out
    }
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

    const trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      toneMapped: false,
    });

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.frustumCulled = false;
    this.scene.add(trail);

    const bullet: ActiveBullet = {
      mesh,
      position: new THREE.Vector3(origin.x, origin.y, origin.z),
      velocity: new THREE.Vector3(nx * BULLET_SPEED, ny * BULLET_SPEED, nz * BULLET_SPEED),
      startTime: performance.now(),
      trail,
      trailPositions,
    };

    this.bullets.push(bullet);
  }

  update(dt: number): void {
    const now = performance.now();

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const age = now - bullet.startTime;

      // Remove expired bullets
      if (age > BULLET_MAX_LIFETIME) {
        this.removeBullet(i);
        continue;
      }

      // Apply gravity to velocity (bullet drop)
      bullet.velocity.y -= BULLET_GRAVITY * dt;

      // Move bullet along velocity
      bullet.position.x += bullet.velocity.x * dt;
      bullet.position.y += bullet.velocity.y * dt;
      bullet.position.z += bullet.velocity.z * dt;

      // Update mesh position
      bullet.mesh.position.copy(bullet.position);

      // Orient mesh along velocity direction
      const speed = bullet.velocity.length();
      if (speed > 0.1) {
        const velDir = bullet.velocity.clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(up, velDir);
        bullet.mesh.quaternion.copy(quaternion);
      }

      // Update trail: shift positions and add new head position
      for (let j = TRAIL_LENGTH - 1; j > 0; j--) {
        bullet.trailPositions[j].copy(bullet.trailPositions[j - 1]);
      }
      bullet.trailPositions[0].copy(bullet.position);

      // Update trail geometry buffer
      const posAttr = bullet.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let j = 0; j < TRAIL_LENGTH; j++) {
        posAttr.setXYZ(j, bullet.trailPositions[j].x, bullet.trailPositions[j].y, bullet.trailPositions[j].z);
      }
      posAttr.needsUpdate = true;

      // Remove if bullet went well below ground
      if (bullet.position.y < -5) {
        this.removeBullet(i);
        continue;
      }
    }
  }

  private removeBullet(index: number): void {
    const bullet = this.bullets[index];
    this.scene.remove(bullet.mesh);
    (bullet.mesh.material as THREE.Material).dispose();
    this.scene.remove(bullet.trail);
    bullet.trail.geometry.dispose();
    (bullet.trail.material as THREE.Material).dispose();
    this.bullets.splice(index, 1);
  }

  clear(): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.removeBullet(i);
    }
  }
}
