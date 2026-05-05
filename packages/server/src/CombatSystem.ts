import {
  Vec3,
  WEAPON_DAMAGE,
  HEADSHOT_MULTIPLIER,
  PLAYER_HEIGHT,
  encodeShootConfirm,
  encodePlayerHit,
  encodePlayerDied,
} from '@dayzcopy/shared';
import { PhysicsWorld } from './PhysicsWorld';
import { PlayerManager } from './PlayerManager';
import { LagCompensation } from './LagCompensation';
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
  private physicsWorld: PhysicsWorld;
  private playerManager: PlayerManager;
  private lagCompensation: LagCompensation;
  private botManager: BotManager | null = null;

  constructor(physicsWorld: PhysicsWorld, playerManager: PlayerManager, lagCompensation: LagCompensation) {
    this.physicsWorld = physicsWorld;
    this.playerManager = playerManager;
    this.lagCompensation = lagCompensation;
  }

  setBotManager(botManager: BotManager): void {
    this.botManager = botManager;
  }

  queueShot(shooterId: number, seq: number, origin: Vec3, direction: Vec3, tick: number): void {
    const shooter = this.playerManager.getPlayer(shooterId);
    if (!shooter) return;

    const pos = shooter.entity.position;
    const dx = origin.x - pos.x;
    const dy = origin.y - pos.y;
    const dz = origin.z - pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 25) return;

    this.pendingShots.push({ shooterId, seq, origin, direction, tick });
  }

  processPending(currentTick: number): void {
    for (const shot of this.pendingShots) {
      const shooter = this.playerManager.getPlayer(shot.shooterId);
      if (!shooter) continue;

      if (!shooter.entity.canFire()) {
        this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, false));
        continue;
      }

      shooter.entity.fire();

      const rewindTick = Math.max(currentTick - 10, Math.min(currentTick, shot.tick));
      const historicalSnapshot = this.lagCompensation.getSnapshot(rewindTick);

      const originalPositions = new Map<number, Vec3>();
      const allPlayers = this.playerManager.getAllPlayers();

      if (historicalSnapshot) {
        // Rewind player positions for lag compensation
        for (const player of allPlayers) {
          if (player.id === shot.shooterId) continue;
          const historicalPos = historicalSnapshot.playerPositions.get(player.id);
          if (historicalPos) {
            originalPositions.set(player.id, { ...player.entity.position });
            this.physicsWorld.setColliderPosition(player.entity.collider, historicalPos);
          }
        }
        // Rewind bot positions for lag compensation
        if (this.botManager) {
          for (const bot of this.botManager.getAllBots()) {
            if (bot.state === 'dead') continue;
            const historicalPos = historicalSnapshot.playerPositions.get(bot.id);
            if (historicalPos) {
              originalPositions.set(bot.id, { ...bot.position });
              this.physicsWorld.setColliderPosition(bot.collider, historicalPos);
            }
          }
        }
      }

      const rayResult = this.physicsWorld.castRay(
        shot.origin,
        shot.direction,
        200,
        shooter.entity.collider
      );

      if (historicalSnapshot) {
        // Restore player positions
        for (const player of allPlayers) {
          if (player.id === shot.shooterId) continue;
          const originalPos = originalPositions.get(player.id);
          if (originalPos) {
            this.physicsWorld.setColliderPosition(player.entity.collider, originalPos);
          }
        }
        // Restore bot positions
        if (this.botManager) {
          for (const bot of this.botManager.getAllBots()) {
            if (bot.state === 'dead') continue;
            const originalPos = originalPositions.get(bot.id);
            if (originalPos) {
              this.physicsWorld.setColliderPosition(bot.collider, originalPos);
            }
          }
        }
      }

      if (rayResult.hit && rayResult.colliderHandle !== undefined) {
        let hitEntityId: number | null = null;
        let isHitBot = false;
        let hitEntityPosition: Vec3 | null = null;

        // Check if a player was hit
        for (const player of allPlayers) {
          if (player.id === shot.shooterId) continue;
          if (player.entity.collider.handle === rayResult.colliderHandle) {
            hitEntityId = player.id;
            hitEntityPosition = player.entity.position;
            break;
          }
        }

        // Check if a bot was hit
        if (hitEntityId === null && this.botManager) {
          for (const bot of this.botManager.getAllBots()) {
            if (bot.state === 'dead') continue;
            if (bot.collider.handle === rayResult.colliderHandle) {
              hitEntityId = bot.id;
              isHitBot = true;
              hitEntityPosition = bot.position;
              break;
            }
          }
        }

        if (hitEntityId !== null && hitEntityPosition !== null) {
          // Determine headshot based on hit point Y relative to entity position
          // Head zone is the top 20% of player height
          const hitPointY = rayResult.point!.y;
          const entityBaseY = hitEntityPosition.y;
          const headThreshold = entityBaseY + PLAYER_HEIGHT * 0.8;
          const isHeadshot = hitPointY >= headThreshold;
          const damage = isHeadshot
            ? Math.round(WEAPON_DAMAGE * HEADSHOT_MULTIPLIER)
            : WEAPON_DAMAGE;
          const hitType = isHeadshot ? 2 : 1; // 2 = headshot, 1 = body

          if (isHitBot && this.botManager) {
            // Bot was hit
            const bot = this.botManager.getBot(hitEntityId);
            if (bot && bot.hp > 0) {
              const died = this.botManager.applyDamage(hitEntityId, damage);

              this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, true, hitType));
              this.broadcastAll(encodePlayerHit(shot.shooterId, hitEntityId, damage));

              if (died) {
                this.broadcastAll(encodePlayerDied(hitEntityId, shot.shooterId));
              }
            } else {
              this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, false, 0));
            }
          } else {
            // Player was hit
            const target = this.playerManager.getPlayer(hitEntityId);
            if (target && target.entity.hp > 0) {
              const died = target.entity.applyDamage(damage);

              this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, true, hitType));
              this.broadcastAll(encodePlayerHit(shot.shooterId, hitEntityId, damage));

              if (died) {
                this.broadcastAll(encodePlayerDied(hitEntityId, shot.shooterId));
                const spawnPos = this.playerManager.getSpawnPosition();
                target.entity.respawn(spawnPos);
              }
            } else {
              this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, false, 0));
            }
          }
        } else {
          this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, false, 0));
        }
      } else {
        this.sendToPlayer(shot.shooterId, encodeShootConfirm(shot.seq, false, 0));
      }
    }

    this.pendingShots = [];
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
