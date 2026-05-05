import { Vec3, WorldSnapshot } from '@dayzcopy/shared';

interface HistoryEntry {
  tick: number;
  playerPositions: Map<number, Vec3>;
}

const HISTORY_SIZE = 30;

export class LagCompensation {
  private history: HistoryEntry[] = new Array(HISTORY_SIZE);
  private writeIndex: number = 0;
  private count: number = 0;

  storeSnapshot(tick: number, snapshot: WorldSnapshot): void {
    const playerPositions = new Map<number, Vec3>();
    for (const player of snapshot.players) {
      playerPositions.set(player.id, { ...player.position });
    }

    this.history[this.writeIndex] = { tick, playerPositions };
    this.writeIndex = (this.writeIndex + 1) % HISTORY_SIZE;
    if (this.count < HISTORY_SIZE) this.count++;
  }

  getSnapshot(tick: number): HistoryEntry | null {
    if (this.count === 0) return null;

    let exact: HistoryEntry | null = null;
    let closest: HistoryEntry | null = null;
    let closestDiff = Infinity;

    for (let i = 0; i < this.count; i++) {
      const entry = this.history[i];
      if (!entry) continue;

      if (entry.tick === tick) {
        exact = entry;
        break;
      }

      const diff = Math.abs(entry.tick - tick);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = entry;
      }
    }

    if (exact) return exact;

    let before: HistoryEntry | null = null;
    let after: HistoryEntry | null = null;

    for (let i = 0; i < this.count; i++) {
      const entry = this.history[i];
      if (!entry) continue;

      if (entry.tick <= tick && (!before || entry.tick > before.tick)) {
        before = entry;
      }
      if (entry.tick >= tick && (!after || entry.tick < after.tick)) {
        after = entry;
      }
    }

    if (before && after && before !== after) {
      const t = (tick - before.tick) / (after.tick - before.tick);
      const interpolated = new Map<number, Vec3>();

      for (const [id, posA] of before.playerPositions) {
        const posB = after.playerPositions.get(id);
        if (posB) {
          interpolated.set(id, {
            x: posA.x + (posB.x - posA.x) * t,
            y: posA.y + (posB.y - posA.y) * t,
            z: posA.z + (posB.z - posA.z) * t,
          });
        } else {
          interpolated.set(id, { ...posA });
        }
      }

      return { tick, playerPositions: interpolated };
    }

    return closest;
  }

  getPlayerPositionAtTick(playerId: number, tick: number): Vec3 | null {
    const snapshot = this.getSnapshot(tick);
    if (!snapshot) return null;
    return snapshot.playerPositions.get(playerId) || null;
  }
}
