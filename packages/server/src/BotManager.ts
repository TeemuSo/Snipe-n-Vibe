import RAPIER from '@dimforge/rapier3d-compat';
import {
  Vec3,
  PlayerState,
  MOVE_SPEED,
  MAX_HP,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  MAP_SIZE,
  MAGAZINE_SIZE,
  BOT_PATROL_POINTS,
} from '@dayzcopy/shared';
import { PhysicsWorld } from './PhysicsWorld';

interface Bot {
  id: number;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  hp: number;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  characterController: RAPIER.KinematicCharacterController;
  targetPoint: Vec3;
  waitTimer: number;
  state: 'moving' | 'waiting' | 'dead';
  respawnTimer: number;
}

const RESPAWN_TIME = 5000; // 5 seconds in ms
const BOT_SPEED_MULTIPLIER = 0.5;
const GRAVITY = -9.81;

export class BotManager {
  private bots: Map<number, Bot> = new Map();
  private physicsWorld: PhysicsWorld;
  private startId: number;
  private nextId: number;

  constructor(physicsWorld: PhysicsWorld, startId: number) {
    this.physicsWorld = physicsWorld;
    this.startId = startId;
    this.nextId = startId;
  }

  spawnBots(count: number): void {
    for (let i = 0; i < count; i++) {
      const id = this.nextId++;
      const spawnPoint = this.randomPatrolPoint();
      const { rigidBody, collider, characterController } = this.physicsWorld.createPlayerBody(spawnPoint);

      const bot: Bot = {
        id,
        position: { ...spawnPoint },
        velocity: { x: 0, y: 0, z: 0 },
        yaw: Math.random() * Math.PI * 2,
        pitch: 0,
        hp: MAX_HP,
        rigidBody,
        collider,
        characterController,
        targetPoint: this.randomPatrolPoint(),
        waitTimer: 0,
        state: 'moving',
        respawnTimer: 0,
      };

      this.bots.set(id, bot);
    }
  }

  update(dt: number): void {
    for (const bot of this.bots.values()) {
      switch (bot.state) {
        case 'dead':
          this.updateDead(bot, dt);
          break;
        case 'waiting':
          this.updateWaiting(bot, dt);
          break;
        case 'moving':
          this.updateMoving(bot, dt);
          break;
      }
    }
  }

  private updateDead(bot: Bot, dt: number): void {
    bot.respawnTimer -= dt * 1000;
    if (bot.respawnTimer <= 0) {
      const spawnPoint = this.randomPatrolPoint();
      bot.hp = MAX_HP;
      bot.state = 'moving';
      bot.position = { ...spawnPoint };
      bot.velocity = { x: 0, y: 0, z: 0 };
      bot.targetPoint = this.randomPatrolPoint();
      bot.rigidBody.setNextKinematicTranslation({ x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z });
    }
  }

  private updateWaiting(bot: Bot, dt: number): void {
    bot.waitTimer -= dt * 1000;
    if (bot.waitTimer <= 0) {
      bot.targetPoint = this.randomPatrolPoint();
      bot.state = 'moving';
    }
  }

  private updateMoving(bot: Bot, dt: number): void {
    const dx = bot.targetPoint.x - bot.position.x;
    const dz = bot.targetPoint.z - bot.position.z;
    const distSq = dx * dx + dz * dz;

    // Arrived at target
    if (distSq < 4) { // < 2m
      bot.state = 'waiting';
      bot.waitTimer = 1000 + Math.random() * 2000; // 1-3 seconds
      bot.velocity.x = 0;
      bot.velocity.z = 0;
      return;
    }

    const dist = Math.sqrt(distSq);
    const dirX = dx / dist;
    const dirZ = dz / dist;

    // Compute desired yaw from movement direction
    const desiredYaw = Math.atan2(dirX, dirZ);
    // Smooth yaw turning
    let yawDiff = desiredYaw - bot.yaw;
    // Normalize to -PI..PI
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    bot.yaw += yawDiff * Math.min(1, 3 * dt);

    // Add slight random yaw variation
    bot.yaw += (Math.random() - 0.5) * 0.02;

    const speed = MOVE_SPEED * BOT_SPEED_MULTIPLIER;
    bot.velocity.x = Math.sin(bot.yaw) * speed;
    bot.velocity.z = Math.cos(bot.yaw) * speed;

    // Apply gravity
    bot.velocity.y += GRAVITY * dt;

    const translation = {
      x: bot.velocity.x * dt,
      y: bot.velocity.y * dt,
      z: bot.velocity.z * dt,
    };

    bot.characterController.computeColliderMovement(bot.collider, translation);
    const movement = bot.characterController.computedMovement();
    const currentPos = bot.rigidBody.translation();
    const newPos = {
      x: currentPos.x + movement.x,
      y: currentPos.y + movement.y,
      z: currentPos.z + movement.z,
    };

    bot.rigidBody.setNextKinematicTranslation(newPos);
    bot.position = { x: newPos.x, y: newPos.y, z: newPos.z };

    const grounded = bot.characterController.computedGrounded();
    if (grounded && bot.velocity.y < 0) {
      bot.velocity.y = 0;
    }
  }

  applyDamage(botId: number, damage: number): boolean {
    const bot = this.bots.get(botId);
    if (!bot || bot.state === 'dead') return false;

    bot.hp = Math.max(0, bot.hp - damage);
    if (bot.hp <= 0) {
      bot.state = 'dead';
      bot.respawnTimer = RESPAWN_TIME;
      return true;
    }
    return false;
  }

  getBotStates(): PlayerState[] {
    const states: PlayerState[] = [];
    for (const bot of this.bots.values()) {
      if (bot.state === 'dead') continue;
      states.push({
        id: bot.id,
        position: { ...bot.position },
        velocity: { ...bot.velocity },
        yaw: bot.yaw,
        pitch: bot.pitch,
        hp: bot.hp,
        ammo: MAGAZINE_SIZE,
        isReloading: false,
        isSprinting: false,
        lastProcessedInput: 0,
      });
    }
    return states;
  }

  getBot(id: number): Bot | undefined {
    return this.bots.get(id);
  }

  isBot(id: number): boolean {
    return this.bots.has(id);
  }

  getAllBots(): Bot[] {
    return Array.from(this.bots.values());
  }

  private randomPatrolPoint(): Vec3 {
    const index = Math.floor(Math.random() * BOT_PATROL_POINTS.length);
    return { ...BOT_PATROL_POINTS[index] };
  }
}
