import fs from 'fs';
import path from 'path';
import { ScoreEntry } from '@dayzcopy/shared';

interface ScoreRecord {
  name: string;
  kills: number;
  deaths: number;
  lastSeen: number;
}

export class ScoreManager {
  private scores: Map<string, ScoreRecord> = new Map();
  private filePath: string;

  constructor(dataDir?: string) {
    this.filePath = path.join(dataDir || process.cwd(), 'scores.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [key, value] of Object.entries(parsed)) {
            const v = value as ScoreRecord;
            this.scores.set(key, {
              name: v.name,
              kills: v.kills || 0,
              deaths: v.deaths || 0,
              lastSeen: v.lastSeen || 0,
            });
          }
        }
        console.log(`[ScoreManager] Loaded ${this.scores.size} score records from ${this.filePath}`);
      } else {
        console.log(`[ScoreManager] No scores file found, starting fresh`);
      }
    } catch (err) {
      console.error('[ScoreManager] Failed to load scores:', err);
    }
  }

  private save(): void {
    try {
      const obj: Record<string, ScoreRecord> = {};
      for (const [key, record] of this.scores) {
        obj[key] = record;
      }
      const json = JSON.stringify(obj, null, 2);
      const tmpPath = this.filePath + '.tmp';
      fs.writeFileSync(tmpPath, json, 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('[ScoreManager] Failed to save scores:', err);
    }
  }

  registerPlayer(playerId: string, name: string): void {
    const existing = this.scores.get(playerId);
    if (existing) {
      existing.name = name;
      existing.lastSeen = Date.now();
    } else {
      this.scores.set(playerId, {
        name,
        kills: 0,
        deaths: 0,
        lastSeen: Date.now(),
      });
    }
    this.save();
  }

  recordKill(playerId: string): void {
    const record = this.scores.get(playerId);
    if (record) {
      record.kills++;
      record.lastSeen = Date.now();
      this.save();
    }
  }

  recordDeath(playerId: string): void {
    const record = this.scores.get(playerId);
    if (record) {
      record.deaths++;
      record.lastSeen = Date.now();
      this.save();
    }
  }

  getScores(): ScoreEntry[] {
    const entries: ScoreEntry[] = [];
    for (const [key, record] of this.scores) {
      // Extract numeric id from key like "player_1" or "bot_1000"
      const parts = key.split('_');
      const id = parseInt(parts[parts.length - 1], 10) || 0;
      entries.push({
        id,
        name: record.name,
        kills: record.kills,
        deaths: record.deaths,
      });
    }
    // Sort by kills descending
    entries.sort((a, b) => b.kills - a.kills);
    return entries;
  }

  getPlayerScore(playerId: string): ScoreRecord | undefined {
    return this.scores.get(playerId);
  }

  /** Get the string key for a player or bot given their numeric ID and bot start threshold */
  static keyForId(id: number, botStartId: number): string {
    return id >= botStartId ? `bot_${id}` : `player_${id}`;
  }
}
