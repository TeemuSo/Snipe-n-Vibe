const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RTT_ALPHA = 0.2; // EMA smoothing factor

export class Connection {
  private ws: WebSocket | null = null;
  private inboundQueue: ArrayBuffer[] = [];
  private reconnectDelay = INITIAL_RECONNECT_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string = '';
  private shouldReconnect = true;
  private rttPingSentAt = 0;

  public connected = false;
  public rtt = 0;
  public onConnect: (() => void) | null = null;
  public onDisconnect: (() => void) | null = null;

  connect(url: string): void {
    this.url = url;
    this.shouldReconnect = true;
    this.createSocket(url);
  }

  private createSocket(url: string): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
    }

    this.inboundQueue = [];

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = INITIAL_RECONNECT_DELAY;
      if (this.onConnect) this.onConnect();
    };

    ws.onmessage = (event: MessageEvent) => {
      this.inboundQueue.push(event.data as ArrayBuffer);
    };

    ws.onclose = () => {
      this.connected = false;
      if (this.onDisconnect) this.onDisconnect();
      this.scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('[Connection] WebSocket error:', err);
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer !== null) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect && !this.connected) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
        this.createSocket(this.url);
      }
    }, this.reconnectDelay);
  }

  send(buffer: ArrayBuffer): void {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(buffer);
    }
  }

  drain(): ArrayBuffer[] {
    const messages = this.inboundQueue;
    this.inboundQueue = [];
    return messages;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect on intentional close
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Call when sending a ping/timestamp to measure RTT.
   * Invoke markRTTPingSent() before sending, then markRTTPongReceived() when the response arrives.
   */
  markRTTPingSent(): void {
    this.rttPingSentAt = performance.now();
  }

  markRTTPongReceived(): void {
    if (this.rttPingSentAt > 0) {
      const sample = performance.now() - this.rttPingSentAt;
      // Exponential moving average
      this.rtt = this.rtt === 0 ? sample : this.rtt * (1 - RTT_ALPHA) + sample * RTT_ALPHA;
      this.rttPingSentAt = 0;
    }
  }
}
