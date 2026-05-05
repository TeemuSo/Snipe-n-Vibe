import { Vec3, vec3Lerp, lerpAngle, INTERPOLATION_DELAY, MAX_EXTRAPOLATION } from '@dayzcopy/shared';

interface Snapshot {
  time: number;
  position: Vec3;
  yaw: number;
  pitch: number;
}

export interface InterpolatedState {
  position: Vec3;
  yaw: number;
  pitch: number;
}

const MAX_BUFFER_SIZE = 6;

export class InterpolationBuffer {
  private buffer: Snapshot[] = [];
  private interpolationDelay: number = INTERPOLATION_DELAY;

  push(serverTime: number, position: Vec3, yaw: number, pitch: number): void {
    const snapshot: Snapshot = { time: serverTime, position, yaw, pitch };

    // Insert sorted by time
    let insertIdx = this.buffer.length;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].time <= serverTime) {
        insertIdx = i + 1;
        break;
      }
      if (i === 0) {
        insertIdx = 0;
      }
    }
    this.buffer.splice(insertIdx, 0, snapshot);

    // Trim oldest if over capacity
    while (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  sample(now: number): InterpolatedState | null {
    if (this.buffer.length === 0) return null;

    const renderTime = now - this.interpolationDelay;

    // Find two snapshots straddling renderTime
    let a: Snapshot | null = null;
    let b: Snapshot | null = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].time <= renderTime && this.buffer[i + 1].time >= renderTime) {
        a = this.buffer[i];
        b = this.buffer[i + 1];
        break;
      }
    }

    if (a && b) {
      // Standard interpolation between two snapshots
      const duration = b.time - a.time;
      const fraction = duration > 0 ? (renderTime - a.time) / duration : 0;

      return {
        position: vec3Lerp(a.position, b.position, fraction),
        yaw: lerpAngle(a.yaw, b.yaw, fraction),
        pitch: a.pitch + (b.pitch - a.pitch) * fraction,
      };
    }

    // No straddling pair found - check if we need to extrapolate
    const last = this.buffer[this.buffer.length - 1];

    if (renderTime > last.time) {
      // Need to extrapolate forward (packet loss / jitter)
      const extrapolationTime = renderTime - last.time;

      if (extrapolationTime > MAX_EXTRAPOLATION) {
        // Cap extrapolation - just return last known state
        return {
          position: last.position,
          yaw: last.yaw,
          pitch: last.pitch,
        };
      }

      // Estimate velocity from last two snapshots
      if (this.buffer.length >= 2) {
        const prev = this.buffer[this.buffer.length - 2];
        const dt = last.time - prev.time;

        if (dt > 0) {
          const vx = (last.position.x - prev.position.x) / dt;
          const vy = (last.position.y - prev.position.y) / dt;
          const vz = (last.position.z - prev.position.z) / dt;

          return {
            position: {
              x: last.position.x + vx * extrapolationTime,
              y: last.position.y + vy * extrapolationTime,
              z: last.position.z + vz * extrapolationTime,
            },
            yaw: last.yaw,
            pitch: last.pitch,
          };
        }
      }

      // Only one snapshot, no velocity estimation possible
      return {
        position: last.position,
        yaw: last.yaw,
        pitch: last.pitch,
      };
    }

    // renderTime is before all snapshots (early frames) - use first snapshot
    const first = this.buffer[0];
    return {
      position: first.position,
      yaw: first.yaw,
      pitch: first.pitch,
    };
  }

  reset(): void {
    this.buffer = [];
  }
}
