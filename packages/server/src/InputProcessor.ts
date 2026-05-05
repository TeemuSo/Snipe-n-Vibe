import { PhysicsWorld } from './PhysicsWorld';
import { PlayerManager } from './PlayerManager';

export class InputProcessor {
  private physicsWorld: PhysicsWorld;
  private playerManager: PlayerManager;

  constructor(physicsWorld: PhysicsWorld, playerManager: PlayerManager) {
    this.physicsWorld = physicsWorld;
    this.playerManager = playerManager;
  }

  processAll(tick: number): void {
    for (const player of this.playerManager.getAllPlayers()) {
      const entity = player.entity;
      const inputsToProcess = entity.inputQueue.splice(0, 2);

      for (const input of inputsToProcess) {
        entity.processInput(input, this.physicsWorld.getWorld());
      }
    }
  }
}
