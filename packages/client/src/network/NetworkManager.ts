import { Connection } from './Connection';
import { Prediction } from './Prediction';
import { InterpolationBuffer, InterpolatedState } from './Interpolation';
import {
  MessageType,
  decode,
  encodeInput,
  encodeShoot,
  InputPayload,
  PlayerState,
  Vec3,
  WorldSnapshot,
  TICK_INTERVAL,
} from '@dayzcopy/shared';

export interface RemotePlayerData {
  state: PlayerState;
  interpolation: InterpolationBuffer;
}

export class NetworkManager {
  public connection: Connection;
  public prediction: Prediction;
  private remotePlayers: Map<number, RemotePlayerData> = new Map();
  private localPlayerId = -1;
  private lastSendTime = 0;

  // Callbacks
  public onPlayerJoin: ((id: number, pos: Vec3) => void) | null = null;
  public onPlayerLeave: ((id: number) => void) | null = null;
  public onHitConfirmed: ((hit: boolean, hitType: number) => void) | null = null;
  public onDamageReceived: ((damage: number, shooterId: number) => void) | null = null;
  public onPlayerDied: ((deadId: number, killerId: number) => void) | null = null;
  public onInitReceived: ((playerId: number, snapshot: WorldSnapshot) => void) | null = null;

  constructor() {
    this.connection = new Connection();
    this.prediction = new Prediction();

    this.connection.onConnect = () => {
      // Connection established, waiting for SERVER_INIT
    };

    this.connection.onDisconnect = () => {
      // Could trigger UI notification
    };
  }

  get connected(): boolean {
    return this.connection.connected;
  }

  connect(url: string): void {
    this.connection.connect(url);
  }

  disconnect(): void {
    this.connection.disconnect();
    this.remotePlayers.clear();
    this.prediction.reset();
  }

  sendInput(input: InputPayload, stateAfter: PlayerState): void {
    const now = performance.now();

    // Tag input with next seq
    const seq = this.prediction.getNextSeq();
    input.seq = seq;

    // Always record for prediction (client-side runs at frame rate)
    this.prediction.recordInput(input, stateAfter);

    // Throttle network sends to tick rate
    if (now - this.lastSendTime < TICK_INTERVAL) {
      return;
    }
    this.lastSendTime = now;

    // Encode and send
    const buffer = encodeInput(input);
    this.connection.send(buffer);
  }

  sendShoot(origin: Vec3, direction: Vec3, tick: number): void {
    const seq = this.prediction.getNextSeq();
    const buffer = encodeShoot(seq, origin, direction, tick);
    this.connection.send(buffer);
  }

  processMessages(
    replayFn: (state: PlayerState, input: InputPayload) => PlayerState,
  ): { correctedState: PlayerState | null } {
    const messages = this.connection.drain();
    let correctedState: PlayerState | null = null;

    for (let i = 0; i < messages.length; i++) {
      const { type, data } = decode(messages[i]);

      switch (type) {
        case MessageType.SERVER_INIT: {
          const { playerId, snapshot } = data as { playerId: number; snapshot: WorldSnapshot };
          this.localPlayerId = playerId;

          // Initialize remote players from snapshot and fire onPlayerJoin so the
          // caller can create Three.js meshes for each one (including bots).
          const clientNow = performance.now();
          for (let j = 0; j < snapshot.players.length; j++) {
            const p = snapshot.players[j];
            if (p.id !== playerId) {
              const interpBuffer = new InterpolationBuffer();
              // Use client time so interpolation samples work immediately
              interpBuffer.push(clientNow, p.position, p.yaw, p.pitch);
              this.remotePlayers.set(p.id, { state: p, interpolation: interpBuffer });
              // Fire the join callback so the visual mesh gets created
              if (this.onPlayerJoin) this.onPlayerJoin(p.id, p.position);
            }
          }

          if (this.onInitReceived) this.onInitReceived(playerId, snapshot);
          break;
        }

        case MessageType.SERVER_SNAPSHOT: {
          const snapshot = data as WorldSnapshot & { lastProcessedInput: number };
          const currentRemoteIds = new Set<number>();
          // Use client-local time for interpolation buffer so sample() works
          // correctly — server timestamps are from a different time domain.
          const clientNow = performance.now();

          for (let j = 0; j < snapshot.players.length; j++) {
            const p = snapshot.players[j];

            if (p.id === this.localPlayerId) {
              // Reconcile local player
              const result = this.prediction.reconcile(p, p.lastProcessedInput, replayFn);
              if (result !== null) {
                correctedState = result;
              }
            } else {
              // Remote player
              currentRemoteIds.add(p.id);
              let remote = this.remotePlayers.get(p.id);

              if (!remote) {
                // New player appeared in snapshot
                remote = { state: p, interpolation: new InterpolationBuffer() };
                this.remotePlayers.set(p.id, remote);
                if (this.onPlayerJoin) this.onPlayerJoin(p.id, p.position);
              }

              remote.state = p;
              remote.interpolation.push(clientNow, p.position, p.yaw, p.pitch);
            }
          }

          // Detect players who left (present in our map but not in snapshot)
          for (const [id] of this.remotePlayers) {
            if (!currentRemoteIds.has(id)) {
              this.remotePlayers.delete(id);
              if (this.onPlayerLeave) this.onPlayerLeave(id);
            }
          }
          break;
        }

        case MessageType.SERVER_SHOOT_CONFIRM: {
          const { hit, hitType } = data as { seq: number; hit: boolean; hitType: number };
          if (this.onHitConfirmed) this.onHitConfirmed(hit, hitType);
          break;
        }

        case MessageType.SERVER_PLAYER_HIT: {
          const { shooterId, targetId, damage } = data as {
            shooterId: number;
            targetId: number;
            damage: number;
          };
          if (targetId === this.localPlayerId) {
            if (this.onDamageReceived) this.onDamageReceived(damage, shooterId);
          }
          break;
        }

        case MessageType.SERVER_PLAYER_DIED: {
          const { deadId, killerId } = data as { deadId: number; killerId: number };
          if (this.onPlayerDied) this.onPlayerDied(deadId, killerId);
          break;
        }

        case MessageType.SERVER_PLAYER_JOIN: {
          const { id, position } = data as { id: number; position: Vec3 };
          if (id !== this.localPlayerId) {
            const interpBuffer = new InterpolationBuffer();
            interpBuffer.push(performance.now(), position, 0, 0);
            this.remotePlayers.set(id, {
              state: {
                id,
                position,
                velocity: { x: 0, y: 0, z: 0 },
                yaw: 0,
                pitch: 0,
                hp: 100,
                ammo: 30,
                isReloading: false,
                isSprinting: false,
                lastProcessedInput: 0,
              },
              interpolation: interpBuffer,
            });
            if (this.onPlayerJoin) this.onPlayerJoin(id, position);
          }
          break;
        }

        case MessageType.SERVER_PLAYER_LEAVE: {
          const { id } = data as { id: number };
          this.remotePlayers.delete(id);
          if (this.onPlayerLeave) this.onPlayerLeave(id);
          break;
        }
      }
    }

    return { correctedState };
  }

  getRemotePlayers(): Map<number, RemotePlayerData> {
    return this.remotePlayers;
  }

  getInterpolatedState(id: number, now: number): InterpolatedState | null {
    const remote = this.remotePlayers.get(id);
    if (!remote) return null;
    return remote.interpolation.sample(now);
  }

  isConnected(): boolean {
    return this.connection.connected;
  }

  getLocalPlayerId(): number {
    return this.localPlayerId;
  }

  getRTT(): number {
    return this.connection.rtt;
  }
}
