import type { ClientMessage, ServerMessage, ConnectionStatus } from '../types/index.js';

export type MessageListener = (msg: ServerMessage) => void;
export type StatusListener = (status: ConnectionStatus) => void;

class RoomWebSocketService {
  private ws: WebSocket | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isIntentionallyClosed = false;

  private currentRoomId: string | null = null;
  private currentUserName: string | null = null;

  public status: ConnectionStatus = 'DISCONNECTED';

  private getWsUrl(): string {
    if (import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }
    const isHttps = window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  public connect(roomId: string, userName: string) {
    const cleanRoomId = roomId.trim().toUpperCase();
    const cleanUserName = userName.trim();

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) &&
      this.currentRoomId === cleanRoomId &&
      this.currentUserName === cleanUserName &&
      !this.isIntentionallyClosed
    ) {
      return;
    }

    this.currentRoomId = cleanRoomId;
    this.currentUserName = cleanUserName;
    this.isIntentionallyClosed = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close();
    }

    this.setStatus('CONNECTING');
    const url = this.getWsUrl();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;

        if (this.currentRoomId && this.currentUserName) {
          this.sendMessage({
            type: 'JOIN_ROOM',
            roomId: this.currentRoomId,
            userName: this.currentUserName,
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          this.notifyMessage(msg);
        } catch (err) {
          console.error('[WEBSOCKET] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        if (!this.isIntentionallyClosed) {
          this.setStatus('RECONNECTING');
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };

      this.ws.onerror = (err) => {
        console.error('[WEBSOCKET] Connection error:', err);
      };
    } catch (err) {
      console.error('[WEBSOCKET] Initialization error:', err);
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isIntentionallyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('DISCONNECTED');
      return;
    }

    const backoffMs = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.currentRoomId && this.currentUserName && !this.isIntentionallyClosed) {
        this.connect(this.currentRoomId, this.currentUserName);
      }
    }, backoffMs);
  }

  public sendMessage(msg: ClientMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
        return true;
      } catch (err) {
        console.error('[WEBSOCKET] Failed to send message:', err);
      }
    }
    return false;
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.sendMessage({ type: 'LEAVE_ROOM' });
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  public addMessageListener(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public addStatusListener(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyMessage(msg: ServerMessage) {
    this.messageListeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('[WEBSOCKET] Listener threw error:', err);
      }
    });
  }
}

export const wsService = new RoomWebSocketService();
