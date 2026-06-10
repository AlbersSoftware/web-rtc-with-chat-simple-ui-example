import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {

  private socket!: WebSocket;
  private isConnected = false;
  private messageQueue: any[] = [];

  connect(): void {
    this.socket = new WebSocket('ws://localhost:8080/signal');

    this.socket.onopen = () => {
      console.log('[WS] Connected to backend');
      this.isConnected = true;

      // Flush queued messages
      this.messageQueue.forEach(msg =>
        this.socket.send(JSON.stringify(msg))
      );
      this.messageQueue = [];
    };

    this.socket.onclose = () => {
      console.log('[WS] Disconnected');
      this.isConnected = false;
    };

    this.socket.onerror = (err) => {
      console.error('[WS] Error', err);
    };
  }

  sendMessage(payload: any): void {
    if (this.isConnected) {
      this.socket.send(JSON.stringify(payload));
    } else {
      console.warn('[WS] Queuing message (socket not ready)');
      this.messageQueue.push(payload);
    }
  }

  onMessage(callback: (data: any) => void): void {
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };
  }
}
