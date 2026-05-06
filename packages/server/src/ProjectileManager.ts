import {
  Vec3,
  BULLET_SPEED,
  BULLET_GRAVITY,
  BULLET_MAX_LIFETIME,
  BULLET_MAX_DISTANCE,
  PLAYER_HEIGHT,
} from '@dayzcopy/shared';
import { PhysicsWorld } from './PhysicsWorld';
import { PlayerManager } from './PlayerManager';
import { BotManager } from './BotManager';

interface ServerBullet {
  id: number;
  shooterId: number;
  seq: number;
  position: Vec3;
  velocity: Vec3;
  startTime: number;
  distanceTraveled: number;
}

export class ProjectileManager {
  private bullets: ServerBullet[] = [];
  private nextBulletId = 0;
  private physicsWorld: PhysicsWorld;
  private playerManager: PlayerManager;
  private botManager: BotManager | null = null;

  // Callback for when a bullet hits a player/bot
  public onHit: ((
    shooterId: number,
    targetId: number,
    seq: number,
    isHeadshot: boolean,
    isBot: boolean
  ) => void) | null = null;

  // Callback for when a bullet misses (expires without hitting anything)
  public onMiss: ((shooterId: number, seq: number) => void) | null = null;

  constructor(physicsWorld: PhysicsWorld, playerManager: PlayerManager) {
    this.physicsWorld = physicsWorld;
    this.playerManager = playerManager;
  }

  setBotManager(botManager: BotManager): void {
    this.botManager = botManager;
  }

  spawnBullet(shooterId: number, seq: number, origin: Vec3, direction: Vec3): void {
    // Normalize direction
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    if (len < 0.001) return;
    const nx = direction.x / len;
    const ny = direction.y / len;
    const nz = direction.z / len;

    const bullet: ServerBullet = {
      id: this.nextBulletId++,
      shooterId,
      seq,
      position: { x: origin.x, y: origin.y, z: origin.z },
      velocity: { x: nx * BULLET_SPEED, y: ny * BULLET_SPEED, z: nz * BULLET_SPEED },
      startTime: performance.now(),
      distanceTraveled: 0,
    };

    this.bullets.push(bullet);
  }

  update(dt: number): void {
    const now = performance.now();

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      // Apply gravity to velocity BEFORE raycast so the ray direction matches actual movement
      bullet.velocity.y -= BULLET_GRAVITY * dt;

      // Calculate step distance
      const speed = Math.sqrt(
        bullet.velocity.x * bullet.velocity.x +
        bullet.velocity.y * bullet.velocity.y +
        bullet.velocity.z * bullet.velocity.z
      );
      const stepDist = speed * dt;

      // Normalize current velocity for raycast direction
      const dirX = bullet.velocity.x / speed;
      const dirY = bullet.velocity.y / speed;
      const dirZ = bullet.velocity.z / speed;

      // Get the shooter's collider so we can exclude it from raycasting
      const shooter = this.playerManager.getPlayer(bullet.shooterId);
      const excludeCollider = shooter ? shooter.entity.collider : undefined;

      // Short raycast from current position along velocity (distance = step this frame)
      const rayResult = this.physicsWorld.castRay(
        bullet.position,
        { x: dirX, y: dirY, z: dirZ },
        stepDist,
        excludeCollider
      );

      if (rayResult.hit && rayResult.colliderHandle !== undefined) {
        // Check if we hit a player or bot
        let hitEntityId: number | null = null;
        let isHitBot = false;
        let hitEntityPosition: Vec3 | null = null;

        // Check players
        const allPlayers = this.playerManager.getAllPlayers();
        for (const player of allPlayers) {
          if (player.id === bullet.shooterId) continue;
          if (player.entity.hp <= 0) continue;
          if (player.entity.collider.handle === rayResult.colliderHandle) {
            hitEntityId = player.id;
            hitEntityPosition = player.entity.position;
            break;
          }
        }

        // Check bots
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
          const hitPointY = rayResult.point!.y;
          const entityFootY = hitEntityPosition.y;
          const headThreshold = entityFootY + PLAYER_HEIGHT * 0.8;
          const isHeadshot = hitPointY >= headThreshold;

          if (this.onHit) {
            this.onHit(bullet.shooterId, hitEntityId, bullet.seq, isHeadshot, isHitBot);
          }
          this.bullets.splice(i, 1);
          continue;
        } else {
          if (this.onMiss) {
            this.onMiss(bullet.shooterId, bullet.seq);
          }
          this.bullets.splice(i, 1);
          continue;
        }
      }

      // Update position (gravity already applied above)
      bullet.position.x += bullet.velocity.x * dt;
      bullet.position.y += bullet.velocity.y * dt;
      bullet.position.z += bullet.velocity.z * dt;

      // Track distance traveled
      bullet.distanceTraveled += stepDist;

      // Check lifetime expiry
      const age = now - bullet.startTime;
      if (age > BULLET_MAX_LIFETIME || bullet.distanceTraveled > BULLET_MAX_DISTANCE) {
        if (this.onMiss) {
          this.onMiss(bullet.shooterId, bullet.seq);
        }
        this.bullets.splice(i, 1);
        continue;
      }

      // Remove if way below ground
      if (bullet.position.y < -10) {
        if (this.onMiss) {
          this.onMiss(bullet.shooterId, bullet.seq);
        }
        this.bullets.splice(i, 1);
        continue;
      }
    }
  }
}
