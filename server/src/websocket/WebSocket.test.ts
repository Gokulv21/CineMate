import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from '../rooms/RoomManager.js';
import { WebSocketHandler } from './WebSocketHandler.js';
import { ServerMessage } from '../types/index.js';

describe('Together Real-Time WebSocket & Sync Flow', () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let roomManager: RoomManager;
  let wsHandler: WebSocketHandler;
  let port: number;

  beforeAll(async () => {
    roomManager = new RoomManager();
    server = http.createServer();
    wss = new WebSocketServer({ server, path: '/ws' });
    wsHandler = new WebSocketHandler(wss, roomManager);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as any;
        port = address.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    wsHandler.destroy();
    for (const client of wss.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve) => {
      wss.close(() => {
        server.close(() => resolve());
      });
    });
  });

  it('completes full sync lifecycle between Host (User A) and Guest (User B)', async () => {
    const { room: initialRoom } = roomManager.createRoom('Gokul', 'Interstellar Movie Night');
    const roomId = initialRoom.id;

    // Connect Client A (Host)
    const clientA = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>((resolve) => {
      clientA.on('open', () => resolve());
    });

    const clientAMessages: ServerMessage[] = [];
    clientA.on('message', (data) => {
      clientAMessages.push(JSON.parse(data.toString()));
    });

    // Client A joins room (first to join, so becomes host)
    clientA.send(
      JSON.stringify({
        type: 'JOIN_ROOM',
        roomId,
        userName: 'Gokul'
      })
    );

    // Wait for ROOM_STATE on Client A
    await new Promise((r) => setTimeout(r, 150));
    const hostState = clientAMessages.find((m) => m.type === 'ROOM_STATE') as any;
    expect(hostState).toBeDefined();
    expect(hostState.room.participants[0].isHost).toBe(true);

    // Connect Client B (Guest)
    const clientB = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>((resolve) => {
      clientB.on('open', () => resolve());
    });

    const clientBMessages: ServerMessage[] = [];
    clientB.on('message', (data) => {
      clientBMessages.push(JSON.parse(data.toString()));
    });

    // Client B joins room
    clientB.send(
      JSON.stringify({
        type: 'JOIN_ROOM',
        roomId,
        userName: 'Partner'
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    expect(clientBMessages.some((m) => m.type === 'ROOM_STATE')).toBe(true);
    expect(clientAMessages.some((m) => m.type === 'PARTICIPANT_JOINED')).toBe(true);

    // Host sends PLAY
    clientA.send(
      JSON.stringify({
        type: 'PLAY',
        position: 120.5,
        timestamp: Date.now()
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    const playMsg = clientBMessages.find((m) => m.type === 'PLAY') as any;
    expect(playMsg).toBeDefined();
    expect(playMsg.position).toBe(120.5);

    // Host sends PAUSE
    clientA.send(
      JSON.stringify({
        type: 'PAUSE',
        position: 145.2
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    const pauseMsg = clientBMessages.find((m) => m.type === 'PAUSE') as any;
    expect(pauseMsg).toBeDefined();
    expect(pauseMsg.position).toBe(145.2);

    // Host sends SEEK
    clientA.send(
      JSON.stringify({
        type: 'SEEK',
        position: 300.0
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    const seekMsg = clientBMessages.find((m) => m.type === 'SEEK') as any;
    expect(seekMsg).toBeDefined();
    expect(seekMsg.position).toBe(300.0);

    // Guest sends CHAT
    clientB.send(
      JSON.stringify({
        type: 'CHAT',
        message: 'This movie looks incredible!'
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    const chatOnA = clientAMessages.find(
      (m) => m.type === 'CHAT' && (m as any).message?.message === 'This movie looks incredible!'
    );
    expect(chatOnA).toBeDefined();

    // Host sends REACTION
    clientA.send(
      JSON.stringify({
        type: 'REACTION',
        emoji: '❤️'
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    const reactionOnB = clientBMessages.find(
      (m) => m.type === 'REACTION' && (m as any).emoji === '❤️'
    );
    expect(reactionOnB).toBeDefined();

    // Clean disconnect
    clientA.close();
    clientB.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});
