import * as THREE from 'three';
import { Vec3 } from '@dayzcopy/shared';

interface ImpactParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  startTime: number;
  lifetime: number;
  initialScale: number;
  finalScale: number;
}

interface ImpactFlash {
  light: THREE.PointLight;
  startTime: number;
}

interface DebrisLine {
  line: THREE.Line;
  startTime: number;
  lifetime: number;
}

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

const MAX_IMPACT_PARTICLES = 50;

export class EffectsManager {
  private scene: THREE.Scene;
  private tracers: TracerEntry[] = [];
  private impacts: ImpactEntry[] = [];
  private muzzleFlashes: MuzzleFlashEntry[] = [];
  private decals: DecalEntry[] = [];
  private impactParticles: ImpactParticle[] = [];
  private impactFlashes: ImpactFlash[] = [];
  private debrisLines: DebrisLine[] = [];

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

  spawnBulletImpactExplosion(point: Vec3, normal: Vec3): void {
    // Enforce max particle count — cull oldest if needed
    while (this.impactParticles.length >= MAX_IMPACT_PARTICLES - 10) {
      const oldest = this.impactParticles.shift()!;
      this.scene.remove(oldest.mesh);
      oldest.mesh.geometry.dispose();
      (oldest.mesh.material as THREE.Material).dispose();
    }

    const impactPos = new THREE.Vector3(point.x, point.y, point.z);
    const normalVec = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const now = performance.now();

    // 1. Dust cloud — 6 spheres expanding outward
    const dustGeo = new THREE.SphereGeometry(0.1, 6, 6);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xAA9977,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(dustGeo, mat);
      mesh.position.copy(impactPos);
      // Random velocity outward + upward, biased along normal
      const randDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.8 + 0.2,
        (Math.random() - 0.5) * 2,
      ).normalize();
      randDir.add(normalVec.clone().multiplyScalar(0.5)).normalize();
      const speed = 1.5 + Math.random() * 2.5;
      const velocity = randDir.multiplyScalar(speed);

      this.scene.add(mesh);
      this.impactParticles.push({
        mesh,
        velocity,
        startTime: now,
        lifetime: 500,
        initialScale: 1.0,
        finalScale: 2.5 + Math.random(),
      });
    }

    // 2. Spark flash — bright point light at impact
    const flashLight = new THREE.PointLight(0xFFAA44, 3, 8);
    flashLight.position.copy(impactPos);
    this.scene.add(flashLight);
    this.impactFlashes.push({ light: flashLight, startTime: now });

    // 3. Debris lines — 4 thin lines shooting outward
    for (let i = 0; i < 4; i++) {
      const randDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.5 + 0.3,
        (Math.random() - 0.5) * 2,
      ).normalize();
      randDir.add(normalVec.clone().multiplyScalar(0.3)).normalize();
      const endPoint = impactPos.clone().add(randDir.multiplyScalar(0.5 + Math.random() * 0.5));

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        impactPos.clone(),
        endPoint,
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xFFFF88,
        transparent: true,
        opacity: 1.0,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      this.scene.add(line);
      this.debrisLines.push({ line, startTime: now, lifetime: 300 });
    }
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
    el.style.color = '#fff';
    el.style.fontSize = '24px';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 150);
  }

  showHeadshotMarker(): void {
    const el = document.getElementById('hit-marker');
    if (!el) return;
    el.style.color = '#ff2222';
    el.style.fontSize = '32px';
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      el.style.color = '#fff';
      el.style.fontSize = '24px';
    }, 250);
  }

  showKillConfirmation(): void {
    const el = document.getElementById('kill-confirmation');
    if (!el) return;
    el.classList.remove('show');
    // Force reflow to restart animation
    void el.offsetWidth;
    el.classList.add('show');
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

    // Impact particles: move, scale up, fade out
    for (let i = this.impactParticles.length - 1; i >= 0; i--) {
      const p = this.impactParticles[i];
      const age = now - p.startTime;
      const t = age / p.lifetime;

      if (t >= 1.0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.impactParticles.splice(i, 1);
        continue;
      }

      // Move particle
      const dtSec = 0.016; // approx frame time
      p.mesh.position.x += p.velocity.x * dtSec;
      p.mesh.position.y += p.velocity.y * dtSec;
      p.mesh.position.z += p.velocity.z * dtSec;
      // Gravity on particles
      p.velocity.y -= 5 * dtSec;

      // Scale up over time
      const scale = p.initialScale + (p.finalScale - p.initialScale) * t;
      p.mesh.scale.setScalar(scale);

      // Fade out opacity
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
    }

    // Impact flashes: remove after 50ms
    for (let i = this.impactFlashes.length - 1; i >= 0; i--) {
      if (now - this.impactFlashes[i].startTime > 50) {
        this.scene.remove(this.impactFlashes[i].light);
        this.impactFlashes[i].light.dispose();
        this.impactFlashes.splice(i, 1);
      }
    }

    // Debris lines: fade and remove
    for (let i = this.debrisLines.length - 1; i >= 0; i--) {
      const d = this.debrisLines[i];
      const age = now - d.startTime;
      const t = age / d.lifetime;

      if (t >= 1.0) {
        this.scene.remove(d.line);
        d.line.geometry.dispose();
        (d.line.material as THREE.Material).dispose();
        this.debrisLines.splice(i, 1);
        continue;
      }

      (d.line.material as THREE.LineBasicMaterial).opacity = 1.0 * (1 - t);
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
