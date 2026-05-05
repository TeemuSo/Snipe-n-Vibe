import { InputPayload, PlayerState, MAX_INPUT_BUFFER } from '@dayzcopy/shared';

export interface PredictionEntry {
  seq: number;
  state: PlayerState;
  input: InputPayload;
}

export class Prediction {
  private history: PredictionEntry[] = [];
  private currentSeq = 1;
  private lastAckedSeq = 0;

  getNextSeq(): number {
    return this.currentSeq;
  }

  recordInput(input: InputPayload, stateAfter: PlayerState): number {
    const seq = this.currentSeq;

    this.history.push({ seq, state: stateAfter, input });

    // Keep buffer bounded
    if (this.history.length > MAX_INPUT_BUFFER) {
      this.history.shift();
    }

    this.currentSeq++;
    return seq;
  }

  reconcile(
    serverState: PlayerState,
    serverLastProcessedSeq: number,
    replayFn: (state: PlayerState, input: InputPayload) => PlayerState,
  ): PlayerState | null {
    // Update ack tracking
    this.lastAckedSeq = serverLastProcessedSeq;

    // Find our predicted state at the server's acknowledged seq
    let predictedAtAck: PredictionEntry | undefined;
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i].seq === serverLastProcessedSeq) {
        predictedAtAck = this.history[i];
        break;
      }
    }

    // Prune history entries at or before the acked seq
    let pruneIdx = -1;
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i].seq <= serverLastProcessedSeq) {
        pruneIdx = i;
      } else {
        break;
      }
    }
    if (pruneIdx >= 0) {
      this.history.splice(0, pruneIdx + 1);
    }

    // Check prediction error
    if (predictedAtAck) {
      const dx = serverState.position.x - predictedAtAck.state.position.x;
      const dy = serverState.position.y - predictedAtAck.state.position.y;
      const dz = serverState.position.z - predictedAtAck.state.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Threshold: 0.01 units distance (squared = 0.0001)
      if (distSq < 0.0001) {
        // Prediction was correct, no correction needed
        return null;
      }
    }

    // CORRECTION NEEDED: replay unacknowledged inputs from server state
    let correctedState = serverState;

    for (let i = 0; i < this.history.length; i++) {
      const entry = this.history[i];
      correctedState = replayFn(correctedState, entry.input);
      // Update stored predicted state to the corrected one
      entry.state = correctedState;
    }

    return correctedState;
  }

  getUnackedInputs(): InputPayload[] {
    const result: InputPayload[] = [];
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i].seq > this.lastAckedSeq) {
        result.push(this.history[i].input);
      }
    }
    return result;
  }

  getLastAckedSeq(): number {
    return this.lastAckedSeq;
  }

  reset(): void {
    this.history = [];
    this.currentSeq = 1;
    this.lastAckedSeq = 0;
  }
}
