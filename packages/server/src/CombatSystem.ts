import {
  Vec3,
  WEAPON_DAMAGE,
  HEADSHOT_MULTIPLIER,
  encodeShootConfirm,
  encodePlayerHit,
  encodePlayerDied,
} from '@dayzcopy/shared';
import { PlayerManager } from './PlayerManager';
import { ProjectileManager } from './ProjectileManager';
import { BotManager } from './BotManager';

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

  queueShot(shooterId: number, seq: number, origin: Vec3, direction: Vec3, tick: number): void {
    const shooter = this.playerManager.getPlayer(shooterId);
    if (!shooter) return;

    // Validate origin is near the player (anti-cheat)
    const pos = shooter.entity.position;
    const dx = origin.x - pos.x;
    const dy = origin.y - pos.y;
    const dz = origin.z - pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 25) return;

    this.pendingShots.push({ shooterId, seq, origin, direction, tick });
  }

  processPending(_currentTick: number): void {
    for (const shot of this.pendingShots) {
      const shooter = this.playerManager.getPlayer(shot.shooterId);
      if (!shooter) continue;

      if (!shooter.entity.canFire()) {
        this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, false));
        continue;
      }

      shooter.entity.fire();

      // Spawn a projectile instead of instant raycast
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
          const spawnPos = this.playerManager.getSpawnPosition();
          target.entity.respawn(spawnPos);
        }
      } else {
        this.sendToPlayer(shooterId, encodeShootConfirm(seq, false, 0));
      }
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
