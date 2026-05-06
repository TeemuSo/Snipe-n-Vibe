import {
  Vec3,
  WEAPON_DAMAGE,
  HEADSHOT_MULTIPLIER,
  encodeShootConfirm,
  encodePlayerHit,
  encodePlayerDied,
} from '@dayzcopy/shared';

const PLAYER_RESPAWN_DELAY = 3000; // ms - matches client death screen
import { PlayerManager } from './PlayerManager';
import { ProjectileManager } from './ProjectileManager';
import { BotManager } from './BotManager';
import { ScoreManager } from './ScoreManager';
import { NetworkBroadcaster } from './NetworkBroadcaster';

interface PendingShot {
  shooterId: number;
  seq: number;
  origin: Vec3;
  direction: Vec3;
  tick: number;
}

export class CombatSystem {
  private pendingShots: PendingShot[] = [];
  private playerManager: PlayerManager;
  private projectileManager: ProjectileManager;
  private botManager: BotManager | null = null;
  private scoreManager: ScoreManager | null = null;
  private broadcaster: NetworkBroadcaster | null = null;
  private botStartId: number = 1000;

  constructor(playerManager: PlayerManager, projectileManager: ProjectileManager) {
    this.playerManager = playerManager;
    this.projectileManager = projectileManager;

    // Wire up projectile hit callback
    this.projectileManager.onHit = (shooterId, targetId, seq, isHeadshot, isBot) => {
      this.handleProjectileHit(shooterId, targetId, seq, isHeadshot, isBot);
    };

    // Wire up projectile miss callback
    this.projectileManager.onMiss = (shooterId, seq) => {
      this.sendToPlayer(shooterId, encodeShootConfirm(seq, false, 0));
    };
  }

  setBotManager(botManager: BotManager): void {
    this.botManager = botManager;
  }

  setScoreManager(scoreManager: ScoreManager, botStartId: number): void {
    this.scoreManager = scoreManager;
    this.botStartId = botStartId;
  }

  setBroadcaster(broadcaster: NetworkBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  queueShot(shooterId: number, seq: number, origin: Vec3, direction: Vec3, tick: number): void {
    const shooter = this.playerManager.getPlayer(shooterId);
    if (!shooter) return;

    // Validate origin is near the player (anti-cheat)
    const pos = shooter.entity.position;
    const dx = origin.x - pos.x;
    const dy = origin.y - pos.y;
    const dz = origin.z - pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 25) {
      return;
    }

    this.pendingShots.push({ shooterId, seq, origin, direction, tick });
  }

  processPending(_currentTick: number): void {
    for (const shot of this.pendingShots) {
      const shooter = this.playerManager.getPlayer(shot.shooterId);
      if (!shooter) continue;

      if (shooter.entity.hp <= 0) {
        this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, false));
        continue;
      }

      if (!shooter.entity.canFire()) {
        this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, false));
        continue;
      }

      shooter.entity.fire();
      this.projectileManager.spawnBullet(shot.shooterId, shot.seq, shot.origin, shot.direction);
    }

    this.pendingShots = [];
  }

  private handleProjectileHit(
    shooterId: number,
    targetId: number,
    seq: number,
    isHeadshot: boolean,
    isBot: boolean
  ): void {
    const damage = isHeadshot
      ? Math.round(WEAPON_DAMAGE * HEADSHOT_MULTIPLIER)
      : WEAPON_DAMAGE;
    const hitType = isHeadshot ? 2 : 1;

    if (isBot && this.botManager) {
      const bot = this.botManager.getBot(targetId);
      if (bot && bot.hp > 0) {
        const died = this.botManager.applyDamage(targetId, damage);

        this.sendToPlayer(shooterId, encodeShootConfirm(seq, true, hitType));
        this.broadcastAll(encodePlayerHit(shooterId, targetId, damage));

        if (died) {
          this.broadcastAll(encodePlayerDied(targetId, shooterId));
          this.recordKillAndBroadcastScores(shooterId, targetId);
        }
      } else {
        this.sendToPlayer(shooterId, encodeShootConfirm(seq, false, 0));
      }
    } else {
      const target = this.playerManager.getPlayer(targetId);
      if (target && target.entity.hp > 0) {
        const died = target.entity.applyDamage(damage);

        this.sendToPlayer(shooterId, encodeShootConfirm(seq, true, hitType));
        this.broadcastAll(encodePlayerHit(shooterId, targetId, damage));

        if (died) {
          this.broadcastAll(encodePlayerDied(targetId, shooterId));
          this.recordKillAndBroadcastScores(shooterId, targetId);
          setTimeout(() => {
            const respawnTarget = this.playerManager.getPlayer(targetId);
            if (respawnTarget) {
              const spawnPos = this.playerManager.getSpawnPosition();
              respawnTarget.entity.respawn(spawnPos);
            }
          }, PLAYER_RESPAWN_DELAY);
        }
      } else {
        this.sendToPlayer(shooterId, encodeShootConfirm(seq, false, 0));
      }
    }
  }

  private recordKillAndBroadcastScores(killerId: number, deadId: number): void {
    if (!this.scoreManager) return;
    const killerKey = ScoreManager.keyForId(killerId, this.botStartId);
    const deadKey = ScoreManager.keyForId(deadId, this.botStartId);
    this.scoreManager.recordKill(killerKey);
    this.scoreManager.recordDeath(deadKey);
    if (this.broadcaster) {
      this.broadcaster.broadcastScores(this.scoreManager.getScores());
    }
  }

  private sendToPlayer(playerId: number, buffer: ArrayBuffer): void {
    const player = this.playerManager.getPlayer(playerId);
    if (player && player.ws.readyState === player.ws.OPEN) {
      player.ws.send(buffer);
    }
  }

  private broadcastAll(buffer: ArrayBuffer): void {
    for (const player of this.playerManager.getAllPlayers()) {
      if (player.ws.readyState === player.ws.OPEN) {
        player.ws.send(buffer);
      }
    }
  }
}
