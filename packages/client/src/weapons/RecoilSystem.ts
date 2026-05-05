const DEG_TO_RAD = Math.PI / 180;

// Sniper rifle: single heavy kick per shot
const SNIPER_RECOIL = { pitch: 4.0, yaw: 0.3 };

export class RecoilSystem {
  private currentPitchOffset: number = 0;
  private currentYawOffset: number = 0;
  private recoverySpeed: number = 3.0; // Slower recovery for bolt-action feel
  private spreadMultiplier: number = 1.0;

  applyRecoil(_shotIndex: number): { pitchDelta: number; yawDelta: number } {
    const pitchDeg = SNIPER_RECOIL.pitch;
    // Slight random yaw variation for each shot
    const yawDeg = SNIPER_RECOIL.yaw * (Math.random() > 0.5 ? 1 : -1);

    const pitchRad = pitchDeg * DEG_TO_RAD;
    const yawRad = yawDeg * DEG_TO_RAD;

    // Small random spread
    const randomPitch = (Math.random() - 0.5) * 0.005;
    const randomYaw = (Math.random() - 0.5) * 0.005;

    const pitchDelta = pitchRad + randomPitch;
    const yawDelta = yawRad + randomYaw;

    this.currentPitchOffset += pitchDelta;
    this.currentYawOffset += yawDelta;

    return { pitchDelta, yawDelta };
  }

  update(dt: number): void {
    const recovery = this.recoverySpeed * dt * DEG_TO_RAD;

    if (Math.abs(this.currentPitchOffset) > 0.0001) {
      const sign = Math.sign(this.currentPitchOffset);
      this.currentPitchOffset -= sign * Math.min(recovery, Math.abs(this.currentPitchOffset));
    } else {
      this.currentPitchOffset = 0;
    }

    if (Math.abs(this.currentYawOffset) > 0.0001) {
      const sign = Math.sign(this.currentYawOffset);
      this.currentYawOffset -= sign * Math.min(recovery, Math.abs(this.currentYawOffset));
    } else {
      this.currentYawOffset = 0;
    }
  }

  reset(): void {
    this.currentPitchOffset = 0;
    this.currentYawOffset = 0;
    this.spreadMultiplier = 1.0;
  }

  getCurrentSpread(): number {
    return Math.abs(this.currentPitchOffset) + Math.abs(this.currentYawOffset);
  }
}
