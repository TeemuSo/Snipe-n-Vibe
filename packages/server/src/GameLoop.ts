import { TICK_INTERVAL } from '@dayzcopy/shared';
import { InputProcessor } from './InputProcessor';
import { PhysicsWorld } from './PhysicsWorld';
import { CombatSystem } from './CombatSystem';
import { PlayerManager } from './PlayerManager';
import { LagCompensation } from './LagCompensation';
import { NetworkBroadcaster } from './NetworkBroadcaster';
import { BotManager } from './BotManager';
import { ProjectileManager } from './ProjectileManager';

export class GameLoop {
  private tick: number = 0;
  private running: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private inputProcessor: InputProcessor;
  private physicsWorld: PhysicsWorld;
  private combatSystem: CombatSystem;
  private playerManager: PlayerManager;
  private lagCompensation: LagCompensation;
  private broadcaster: NetworkBroadcaster;
  private botManager: BotManager | null = null;
  private projectileManager: ProjectileManager;

  constructor(
    inputProcessor: InputProcessor,
    physicsWorld: PhysicsWorld,
    combatSystem: CombatSystem,
    playerManager: PlayerManager,
    lagCompensation: LagCompensation,
    broadcaster: NetworkBroadcaster,
    projectileManager: ProjectileManager
  ) {
    this.inputProcessor = inputProcessor;
    this.physicsWorld = physicsWorld;
    this.combatSystem = combatSystem;
    this.playerManager = playerManager;
    this.lagCompensation = lagCompensation;
    this.broadcaster = broadcaster;
    this.projectileManager = projectileManager;
  }

  setBotManager(botManager: BotManager): void {
    this.botManager = botManager;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();

    this.intervalHandle = setInterval(() => {
      if (!this.running) return;

      const now = performance.now();
      this.accumulator += now - this.lastTime;
      this.lastTime = now;

      while (this.accumulator >= TICK_INTERVAL) {
        this.fixedUpdate();
        this.accumulator -= TICK_INTERVAL;
        this.tick++;
      }
    }, 1);
  }

  private fixedUpdate(): void {
    this.inputProcessor.processAll(this.tick);
    if (this.botManager) {
      this.botManager.update(TICK_INTERVAL / 1000);
    }
    this.physicsWorld.step();
    this.combatSystem.processPending(this.tick);
    this.projectileManager.update(TICK_INTERVAL / 1000);
    this.playerManager.syncFromPhysics();
    this.lagCompensation.storeSnapshot(this.tick, this.playerManager.getSnapshot(this.tick));
    this.broadcaster.broadcast(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getTick(): number {
    return this.tick;
  }
}
