import { WebSocket } from 'ws';
import { Vec3, WorldSnapshot, PlayerState, SPAWN_POINTS } from '@dayzcopy/shared';
import { PlayerEntity } from './PlayerEntity';
import { PhysicsWorld } from './PhysicsWorld';
import { BotManager } from './BotManager';

export interface ServerPlayer {
  id: number;
  ws: WebSocket;
  entity: PlayerEntity;
}

export class PlayerManager {
  private players: Map<number, ServerPlayer> = new Map();
  private physicsWorld: PhysicsWorld;
  private botManager: BotManager | null = null;

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld;
  }

  setBotManager(botManager: BotManager): void {
    this.botManager = botManager;
  }

  addPlayer(id: number, ws: WebSocket, spawnPos: Vec3): ServerPlayer {
    const { rigidBody, collider, characterController } = this.physicsWorld.createPlayerBody(spawnPos);
    const entity = new PlayerEntity(id, rigidBody, collider, characterController, spawnPos);
    const player: ServerPlayer = { id, ws, entity };
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: number): void {
    const player = this.players.get(id);
    if (player) {
      this.physicsWorld.removePlayerBody(player.entity.rigidBody, player.entity.collider);
      this.players.delete(id);
    }
  }

  getPlayer(id: number): ServerPlayer | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): ServerPlayer[] {
    return Array.from(this.players.values());
  }

  syncFromPhysics(): void {
    for (const player of this.players.values()) {
      player.entity.syncFromPhysics();
    }
  }

  getSnapshot(tick: number): WorldSnapshot {
    const players: PlayerState[] = [];
    for (const player of this.players.values()) {
      players.push(player.entity.getState());
    }
    // Include bot states - they appear as regular players to the client
    if (this.botManager) {
      players.push(...this.botManager.getBotStates());
    }
    return {
      tick,
      timestamp: performance.now(),
      players,
    };
  }

  getSpawnPosition(): Vec3 {
    const index = Math.floor(Math.random() * SPAWN_POINTS.length);
    return { ...SPAWN_POINTS[index] };
  }
}
