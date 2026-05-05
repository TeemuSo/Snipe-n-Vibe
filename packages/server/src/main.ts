import RAPIER from '@dimforge/rapier3d-compat';
import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  decodeInput,
  decodeShoot,
  encodeInit,
  encodePlayerJoin,
  encodePlayerLeave,
} from '@dayzcopy/shared';
import { GameLoop } from './GameLoop';
import { PlayerManager } from './PlayerManager';
import { PhysicsWorld } from './PhysicsWorld';
import { CombatSystem } from './CombatSystem';
import { NetworkBroadcaster } from './NetworkBroadcaster';
import { InputProcessor } from './InputProcessor';
import { LagCompensation } from './LagCompensation';
import { BotManager } from './BotManager';

const BOT_START_ID = 1000;
const BOT_COUNT = 5;

async function main(): Promise<void> {
  await RAPIER.init();

  const physicsWorld = new PhysicsWorld();
  const playerManager = new PlayerManager(physicsWorld);
  const lagCompensation = new LagCompensation();
  const combatSystem = new CombatSystem(physicsWorld, playerManager, lagCompensation);
  const inputProcessor = new InputProcessor(physicsWorld, playerManager);
  const broadcaster = new NetworkBroadcaster(playerManager);
  const gameLoop = new GameLoop(inputProcessor, physicsWorld, combatSystem, playerManager, lagCompensation, broadcaster);

  // Create and wire up bot manager
  const botManager = new BotManager(physicsWorld, BOT_START_ID);
  botManager.spawnBots(BOT_COUNT);
  playerManager.setBotManager(botManager);
  combatSystem.setBotManager(botManager);
  gameLoop.setBotManager(botManager);
  console.log(`Spawned ${BOT_COUNT} bots (IDs ${BOT_START_ID}-${BOT_START_ID + BOT_COUNT - 1})`);

  let nextPlayerId = 1;

  const wss = new WebSocketServer({ port: 8080 });

  wss.on('connection', (ws: WebSocket) => {
    const playerId = nextPlayerId++;
    const spawnPos = playerManager.getSpawnPosition();
    const player = playerManager.addPlayer(playerId, ws, spawnPos);

    const snapshot = playerManager.getSnapshot(gameLoop.getTick());
    const initBuffer = encodeInit(playerId, snapshot);
    ws.send(initBuffer);

    const joinBuffer = encodePlayerJoin(playerId, spawnPos);
    for (const other of playerManager.getAllPlayers()) {
      if (other.id !== playerId && other.ws.readyState === WebSocket.OPEN) {
        other.ws.send(joinBuffer);
      }
    }

    ws.on('message', (data: Buffer | ArrayBuffer) => {
      let buffer: ArrayBuffer;
      if (data instanceof ArrayBuffer) {
        buffer = data;
      } else {
        // Copy from Buffer into a proper ArrayBuffer
        const copy = new Uint8Array(data.byteLength);
        copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        buffer = copy.buffer;
      }

      if (buffer.byteLength < 1) return;

      const view = new DataView(buffer);
      const type: MessageType = view.getUint8(0);

      switch (type) {
        case MessageType.CLIENT_INPUT: {
          const input = decodeInput(buffer);
          player.entity.queueInput(input);
          break;
        }
        case MessageType.CLIENT_SHOOT: {
          const shoot = decodeShoot(buffer);
          combatSystem.queueShot(playerId, shoot.seq, shoot.origin, shoot.direction, shoot.tick);
          break;
        }
      }
    });

    ws.on('close', () => {
      playerManager.removePlayer(playerId);
      const leaveBuffer = encodePlayerLeave(playerId);
      for (const other of playerManager.getAllPlayers()) {
        if (other.ws.readyState === WebSocket.OPEN) {
          other.ws.send(leaveBuffer);
        }
      }
    });
  });

  gameLoop.start();
  console.log('Server running on port 8080');
}

main();
