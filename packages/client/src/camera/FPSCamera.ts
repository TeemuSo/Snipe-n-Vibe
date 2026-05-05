import * as THREE from 'three';
import {
  Vec3,
  PLAYER_HEIGHT,
  directionFromYawPitch,
  clamp,
  DEFAULT_FOV,
  SCOPE_FOV,
  SCOPE_SWAY_AMPLITUDE,
  SCOPE_SWAY_FREQUENCY,
} from '@dayzcopy/shared';

export class FPSCamera {
  camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0;

  private static PITCH_MIN = -Math.PI / 2 + 0.01;
  private static PITCH_MAX = Math.PI / 2 - 0.01;

  // FOV lerp state
  private currentFOV: number = DEFAULT_FOV;
  private targetFOV: number = DEFAULT_FOV;
  private fovLerpSpeed: number = 12.0; // units per second, fast smooth transition

  // Scope sway state
  private isScoped: boolean = false;
  private isHoldingBreath: boolean = false;
  private holdBreathStartTime: number = 0;
  private swayPitchOffset: number = 0;
  private swayYawOffset: number = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, aspect, 0.1, 600);
  }

  update(mouseDX: number, mouseDY: number, sensitivity: number): void {
    this.yaw -= mouseDX * sensitivity;
    this.pitch -= mouseDY * sensitivity;
    this.pitch = clamp(this.pitch, FPSCamera.PITCH_MIN, FPSCamera.PITCH_MAX);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Call each frame to advance FOV and sway. dt in seconds, time in ms (performance.now). */
  updateScope(dt: number, time: number): void {
    // Lerp FOV
    if (this.currentFOV !== this.targetFOV) {
      const diff = this.targetFOV - this.currentFOV;
      const step = this.fovLerpSpeed * dt * Math.abs(diff);
      if (Math.abs(diff) < 0.5) {
        this.currentFOV = this.targetFOV;
      } else {
        this.currentFOV += Math.sign(diff) * Math.min(step, Math.abs(diff));
      }
      this.camera.fov = this.currentFOV;
      this.camera.updateProjectionMatrix();
    }

    // Compute and apply sway only when scoped
    if (this.isScoped) {
      const sway = this.computeSway(time / 1000);
      // Remove previous sway offset, apply new
      this.pitch -= this.swayPitchOffset;
      this.yaw -= this.swayYawOffset;
      this.swayPitchOffset = sway.pitchSway;
      this.swayYawOffset = sway.yawSway;
      this.pitch += this.swayPitchOffset;
      this.yaw += this.swayYawOffset;
      this.pitch = clamp(this.pitch, FPSCamera.PITCH_MIN, FPSCamera.PITCH_MAX);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else if (this.swayPitchOffset !== 0 || this.swayYawOffset !== 0) {
      // Remove sway when unscoped
      this.pitch -= this.swayPitchOffset;
      this.yaw -= this.swayYawOffset;
      this.swayPitchOffset = 0;
      this.swayYawOffset = 0;
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
  }

  private computeSway(timeSeconds: number): { pitchSway: number; yawSway: number } {
    let amplitude = SCOPE_SWAY_AMPLITUDE;

    // When holding breath, lerp amplitude to near zero over 500ms
    if (this.isHoldingBreath) {
      const breathElapsed = performance.now() - this.holdBreathStartTime;
      const t = Math.min(breathElapsed / 500, 1.0);
      amplitude *= (1.0 - t * 0.95); // reduce to 5% of original
    }

    const freq = SCOPE_SWAY_FREQUENCY;
    const twoPi = Math.PI * 2;

    // Primary breathing sway (pitch - vertical)
    const pitchPrimary = Math.sin(timeSeconds * freq * twoPi) * amplitude;
    // Secondary slower frequency for figure-8 feel
    const pitchSecondary = Math.sin(timeSeconds * 0.3) * amplitude * 0.5;

    // Yaw sway - phase shifted, slightly different frequency
    const yawPrimary = Math.cos(timeSeconds * freq * twoPi * 0.7) * amplitude * 0.8;
    const yawSecondary = Math.cos(timeSeconds * 0.2) * amplitude * 0.4;

    return {
      pitchSway: pitchPrimary + pitchSecondary,
      yawSway: yawPrimary + yawSecondary,
    };
  }

  setFOV(fov: number): void {
    this.targetFOV = fov;
  }

  setScoped(scoped: boolean): void {
    this.isScoped = scoped;
    this.targetFOV = scoped ? SCOPE_FOV : DEFAULT_FOV;
  }

  setHoldingBreath(holding: boolean): void {
    if (holding && !this.isHoldingBreath) {
      this.holdBreathStartTime = performance.now();
    }
    this.isHoldingBreath = holding;
  }

  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y + PLAYER_HEIGHT * 0.9, z);
  }

  getDirection(): Vec3 {
    return directionFromYawPitch(this.yaw, this.pitch);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
