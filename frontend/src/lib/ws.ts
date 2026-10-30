/** WebSocket client — production grade with exponential backoff reconnect. */

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname || "127.0.0.1";
    return `ws://${host}:8000/ws/traffic`;
  }
  return "ws://127.0.0.1:8000/ws/traffic";
}

type MessageHandler     = (data: unknown) => void;
type StatusHandler      = (connected: boolean) => void;

class TrafficWebSocket {
  private ws: WebSocket | null                = null;
  private handlers: Set<MessageHandler>       = new Set();
  private statusHandlers: Set<StatusHandler>  = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect  = false;
  private attempt          = 0;           // retry counter for backoff
  private maxDelay         = 30_000;      // max 30 s between retries

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.shouldReconnect = true;
    const url = getWsUrl();

    try {
      this.ws = new WebSocket(url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("[WS] Connected to ATMS live feed ✅");
      this.attempt = 0;                   // reset backoff counter on success
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this._notifyStatus(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.handlers.forEach((h) => h(data));
      } catch { /* ignore non-JSON pings */ }
    };

    this.ws.onclose = () => {
      console.warn("[WS] Disconnected — will retry…");
      this._notifyStatus(false);
      if (this.shouldReconnect) this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
      this._notifyStatus(false);
    };
  }

  /** Exponential backoff: 1s → 2s → 4s → 8s → … → 30s */
  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(1_000 * 2 ** this.attempt, this.maxDelay);
    this.attempt++;
    console.log(`[WS] Retry #${this.attempt} in ${delay / 1000}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private _notifyStatus(connected: boolean): void {
    this.statusHandlers.forEach((h) => h(connected));
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.attempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Subscribe to connection status changes (true = connected, false = disconnected) */
  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const trafficWS = new TrafficWebSocket();
