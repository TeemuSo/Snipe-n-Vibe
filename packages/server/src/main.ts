import RAPIER from '@dimforge/rapier3d-compat';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
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
import { ProjectileManager } from './ProjectileManager';
import { ScoreManager } from './ScoreManager';

const BOT_START_ID = 1000;
const BOT_COUNT = 5;

async function main(): Promise<void> {
  await RAPIER.init();

  const physicsWorld = new PhysicsWorld();
  const playerManager = new PlayerManager(physicsWorld);
  const lagCompensation = new LagCompensation();
  const projectileManager = new ProjectileManager(physicsWorld, playerManager);
  const combatSystem = new CombatSystem(playerManager, projectileManager);
  const inputProcessor = new InputProcessor(physicsWorld, playerManager);
  const broadcaster = new NetworkBroadcaster(playerManager);
  const gameLoop = new GameLoop(inputProcessor, physicsWorld, combatSystem, playerManager, lagCompensation, broadcaster, projectileManager);

  // Score manager (persists kills/deaths to scores.json)
  const scoreManager = new ScoreManager();

  // Create and wire up bot manager
  const botManager = new BotManager(physicsWorld, BOT_START_ID);
  botManager.spawnBots(BOT_COUNT);
  playerManager.setBotManager(botManager);
  combatSystem.setBotManager(botManager);
  combatSystem.setScoreManager(scoreManager, BOT_START_ID);
  combatSystem.setBroadcaster(broadcaster);
  projectileManager.setBotManager(botManager);
  gameLoop.setBotManager(botManager);
  console.log(`Spawned ${BOT_COUNT} bots (IDs ${BOT_START_ID}-${BOT_START_ID + BOT_COUNT - 1})`);

  // Register bots in score manager with fun names
  const BOT_NAMES = ['Ghost', 'Viper', 'Shadow', 'Phoenix', 'Reaper'];
  for (let i = 0; i < BOT_COUNT; i++) {
    const botId = BOT_START_ID + i;
    const name = BOT_NAMES[i % BOT_NAMES.length];
    scoreManager.registerPlayer(`bot_${botId}`, name);
  }

  let nextPlayerId = 1;

  const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.glb': 'model/gltf-binary',
  };

  const __dirname = fileURLToPath(new URL('.', import.meta.url));
  const clientDist = join(__dirname, '../../client/dist');

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    let urlPath = req.url?.split('?')[0] || '/';
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = join(clientDist, urlPath);
    if (!filePath.startsWith(clientDist)) {
      res.writeHead(403);
      res.end();
      return;
    }

    try {
      const data = await readFile(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      try {
        const fallback = await readFile(join(clientDist, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fallback);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  });

  httpServer.listen(8080);
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws: WebSocket) => {
    const playerId = nextPlayerId++;
    const spawnPos = playerManager.getSpawnPosition();
    const player = playerManager.addPlayer(playerId, ws, spawnPos);

    // Register player in score manager
    scoreManager.registerPlayer(`player_${playerId}`, `Player ${playerId}`);

    const snapshot = playerManager.getSnapshot(gameLoop.getTick());
    const initBuffer = encodeInit(playerId, snapshot);
    ws.send(initBuffer);

    // Send current scores to the newly connected player
    broadcaster.sendScoresToPlayer(playerId, scoreManager.getScores());

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
        case MessageType.CLIENT_REQUEST_SCORES: {
          broadcaster.sendScoresToPlayer(playerId, scoreManager.getScores());
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
