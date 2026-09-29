import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { RoomManager } from './rooms/RoomManager.js';
import { WebSocketHandler } from './websocket/WebSocketHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '4000', 10);
const CLIENT_URL = process.env.CLIENT_URL || '*';

const app = express();
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

const roomManager = new RoomManager();

// Create HTTP server & attach WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const wsHandler = new WebSocketHandler(wss, roomManager);

// Stale room cleanup job every 5 minutes
const cleanupInterval = setInterval(() => {
  const cleaned = roomManager.cleanupStaleRooms();
  if (cleaned > 0) {
    console.log(`[ROOM] Cleaned up ${cleaned} stale/empty room(s).`);
  }
}, 5 * 60 * 1000);

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    activeRooms: roomManager.getRoomCount(),
    connectedSockets: wss.clients.size
  });
});

// Create Room via HTTP endpoint
app.post('/api/rooms', (req, res) => {
  const { hostName, roomName } = req.body;
  if (!hostName || typeof hostName !== 'string' || hostName.trim().length === 0) {
    return res.status(400).json({ error: 'Host name is required' });
  }

  const { room, hostParticipantId } = roomManager.createRoom(hostName, roomName);
  res.status(201).json({
    roomId: room.id,
    roomName: room.name,
    hostParticipantId
  });
});

// Check Room existence and basic info
app.get('/api/rooms/:id', (req, res) => {
  const roomId = req.params.id?.trim().toUpperCase();
  const room = roomManager.getRoom(roomId);

  if (!room) {
    return res.status(404).json({ exists: false, error: 'Room not found or expired' });
  }

  res.json({
    exists: true,
    roomId: room.id,
    name: room.name,
    participantCount: room.participants.length,
    createdAt: room.createdAt
  });
});

// Serve static client assets in production if available
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('CineMate API Server is running.');
    }
  });
});

server.listen(PORT, () => {
  console.log(`[SERVER] CineMate backend listening on http://localhost:${PORT}`);
  console.log(`[SERVER] WebSocket available at ws://localhost:${PORT}/ws`);
});

const gracefulShutdown = () => {
  console.log('[SERVER] Shutting down gracefully...');
  clearInterval(cleanupInterval);
  wsHandler.destroy();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export { app, server, roomManager };
