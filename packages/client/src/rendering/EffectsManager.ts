import * as THREE from 'three';
import { Vec3 } from '@dayzcopy/shared';

interface TracerEntry {
  mesh: THREE.Line;
  startTime: number;
}

interface ImpactEntry {
  mesh: THREE.Mesh;
  startTime: number;
}

interface MuzzleFlashEntry {
  light: THREE.PointLight;
  startTime: number;
}

interface DecalEntry {
  outerMesh: THREE.Mesh;
  innerMesh: THREE.Mesh;
  startTime: number;
}

const DECAL_MAX_COUNT = 100;
const DECAL_LIFETIME = 30000; // 30 seconds in ms
const DECAL_FADE_DURATION = 2000; // last 2 seconds fade out

export class EffectsManager {
  private scene: THREE.Scene;
  private tracers: TracerEntry[] = [];
  private impacts: ImpactEntry[] = [];
  private muzzleFlashes: MuzzleFlashEntry[] = [];
  private decals: DecalEntry[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawnMuzzleFlash(position: Vec3): void {
    const light = new THREE.PointLight(0xffaa00, 3, 5);
    light.position.set(position.x, position.y, position.z);
    this.scene.add(light);
    this.muzzleFlashes.push({ light, startTime: performance.now() });
  }

  spawnTracer(from: Vec3, to: Vec3): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Line(geometry, material);
    this.scene.add(mesh);
    this.tracers.push({ mesh, startTime: performance.now() });
  }

  spawnImpact(point: Vec3, normal: Vec3): void {
    const geometry = new THREE.SphereGeometry(0.05, 6, 6);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      point.x + normal.x * 0.01,
      point.y + normal.y * 0.01,
      point.z + normal.z * 0.01
    );
    this.scene.add(mesh);
    this.impacts.push({ mesh, startTime: performance.now() });
  }

  spawnBulletDecal(point: Vec3, normal: Vec3): void {
    // Remove oldest decal if at limit
    if (this.decals.length >= DECAL_MAX_COUNT) {
      const oldest = this.decals.shift()!;
      this.removeDecal(oldest);
    }

    // Outer dark circle
    const outerGeo = new THREE.CircleGeometry(0.05, 8);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.set(
      point.x + normal.x * 0.001,
      point.y + normal.y * 0.001,
      point.z + normal.z * 0.001
    );
    outerMesh.lookAt(
      point.x + normal.x,
      point.y + normal.y,
      point.z + normal.z
    );
    this.scene.add(outerMesh);

    // Inner darker circle for realism
    const innerGeo = new THREE.CircleGeometry(0.02, 8);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.position.set(
      point.x + normal.x * 0.002,
      point.y + normal.y * 0.002,
      point.z + normal.z * 0.002
    );
    innerMesh.lookAt(
      point.x + normal.x,
      point.y + normal.y,
      point.z + normal.z
    );
    this.scene.add(innerMesh);

    this.decals.push({ outerMesh, innerMesh, startTime: performance.now() });
  }

  private removeDecal(decal: DecalEntry): void {
    this.scene.remove(decal.outerMesh);
    this.scene.remove(decal.innerMesh);
    decal.outerMesh.geometry.dispose();
    (decal.outerMesh.material as THREE.Material).dispose();
    decal.innerMesh.geometry.dispose();
    (decal.innerMesh.material as THREE.Material).dispose();
  }

  showHitMarker(): void {
    const el = document.getElementById('hit-marker');
    if (!el) return;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 150);
  }

  showDamageVignette(): void {
    const el = document.getElementById('damage-vignette');
    if (!el) return;
    el.classList.add('hurt');
    setTimeout(() => el.classList.remove('hurt'), 300);
  }

  update(now: number): void {
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      if (now - this.muzzleFlashes[i].startTime > 50) {
        this.scene.remove(this.muzzleFlashes[i].light);
        this.muzzleFlashes[i].light.dispose();
        this.muzzleFlashes.splice(i, 1);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      if (now - this.tracers[i].startTime > 100) {
        const tracer = this.tracers[i];
        this.scene.remove(tracer.mesh);
        tracer.mesh.geometry.dispose();
        (tracer.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.impacts.length - 1; i >= 0; i--) {
      if (now - this.impacts[i].startTime > 200) {
        const impact = this.impacts[i];
        this.scene.remove(impact.mesh);
        impact.mesh.geometry.dispose();
        (impact.mesh.material as THREE.Material).dispose();
        this.impacts.splice(i, 1);
      }
    }

    // Decal lifecycle: fade out during last 2 seconds, remove after 30 seconds
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const decal = this.decals[i];
      const age = now - decal.startTime;

      if (age >= DECAL_LIFETIME) {
        this.removeDecal(decal);
        this.decals.splice(i, 1);
      } else if (age >= DECAL_LIFETIME - DECAL_FADE_DURATION) {
        // Fade out during last 2 seconds
        const fadeProgress = (age - (DECAL_LIFETIME - DECAL_FADE_DURATION)) / DECAL_FADE_DURATION;
        const opacity = 0.8 * (1 - fadeProgress);
        (decal.outerMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
        (decal.innerMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
    }
  }
}
