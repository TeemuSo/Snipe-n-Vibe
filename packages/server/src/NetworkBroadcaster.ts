import { encodeSnapshot, WorldSnapshot } from '@dayzcopy/shared';
import { PlayerManager } from './PlayerManager';

export class NetworkBroadcaster {
  private playerManager: PlayerManager;

  constructor(playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  broadcast(tick: number): void {
    const snapshot = this.playerManager.getSnapshot(tick);

    for (const player of this.playerManager.getAllPlayers()) {
      if (player.ws.readyState !== player.ws.OPEN) continue;
      const buffer = encodeSnapshot(snapshot, player.id);
      player.ws.send(buffer);
    }
  }

  sendToPlayer(playerId: number, buffer: ArrayBuffer): void {
    const player = this.playerManager.getPlayer(playerId);
    if (player && player.ws.readyState === player.ws.OPEN) {
      player.ws.send(buffer);
    }
  }

  broadcastExcept(excludeId: number, buffer: ArrayBuffer): void {
    for (const player of this.playerManager.getAllPlayers()) {
      if (player.id === excludeId) continue;
      if (player.ws.readyState !== player.ws.OPEN) continue;
      player.ws.send(buffer);
    }
  }

  broadcastAll(buffer: ArrayBuffer): void {
    for (const player of this.playerManager.getAllPlayers()) {
      if (player.ws.readyState !== player.ws.OPEN) continue;
      player.ws.send(buffer);
    }
  }
}
