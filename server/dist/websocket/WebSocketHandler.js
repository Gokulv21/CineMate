import { WebSocket } from 'ws';
import { SignalingHandler } from '../signaling/SignalingHandler.js';
export class WebSocketHandler {
    wss;
    roomManager;
    signalingHandler;
    // Mapping ws -> session info
    sessions = new Map();
    // Mapping roomId -> Map<participantId, WebSocket>
    roomSockets = new Map();
    // Ping interval
    heartbeatInterval = null;
    constructor(wss, roomManager) {
        this.wss = wss;
        this.roomManager = roomManager;
        this.signalingHandler = new SignalingHandler(roomManager, this);
        this.setupHeartbeat();
        this.setupConnectionListener();
    }
    setupHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                const session = this.sessions.get(ws);
                if (session) {
                    if (!session.isAlive) {
                        console.log(`[WEBSOCKET] Client timeout for participant: ${session.participantId}`);
                        ws.terminate();
                        return;
                    }
                    session.isAlive = false;
                }
                try {
                    ws.ping();
                }
                catch {
                    ws.terminate();
                }
            });
        }, 30000);
    }
    setupConnectionListener() {
        this.wss.on('connection', (ws, req) => {
            console.log(`[WEBSOCKET] New connection established from ${req.socket.remoteAddress}`);
            ws.on('pong', () => {
                const session = this.sessions.get(ws);
                if (session) {
                    session.isAlive = true;
                }
            });
            ws.on('message', (rawData) => {
                this.handleMessage(ws, rawData);
            });
            ws.on('close', () => {
                this.handleDisconnect(ws);
            });
            ws.on('error', (err) => {
                console.error('[WEBSOCKET] Socket error:', err.message);
                this.handleDisconnect(ws);
            });
        });
    }
    handleMessage(ws, rawData) {
        try {
            const dataStr = rawData.toString();
            if (dataStr.length > 65536) {
                // Drop oversized payloads (64KB max)
                console.warn('[WEBSOCKET] Dropping oversized message');
                return;
            }
            const msg = JSON.parse(dataStr);
            if (!msg || typeof msg.type !== 'string') {
                return;
            }
            const session = this.sessions.get(ws);
            // Rate limit check: max 60 messages per second
            if (session) {
                const now = Date.now();
                if (now - session.lastMessageReset > 1000) {
                    session.messageCount = 0;
                    session.lastMessageReset = now;
                }
                session.messageCount++;
                if (session.messageCount > 60) {
                    console.warn(`[WEBSOCKET] Rate limit exceeded by ${session.participantId}`);
                    return;
                }
            }
            this.processClientMessage(ws, msg, session);
        }
        catch (err) {
            console.error('[WEBSOCKET] Message parse error:', err.message);
            this.sendError(ws, 'INVALID_PAYLOAD', 'Malformed message received');
        }
    }
    processClientMessage(ws, msg, session) {
        switch (msg.type) {
            case 'JOIN_ROOM': {
                this.handleJoinRoom(ws, msg.roomId, msg.userName, msg.participantId);
                break;
            }
            case 'LEAVE_ROOM': {
                this.handleDisconnect(ws);
                break;
            }
            case 'PLAY': {
                if (!session)
                    return;
                const room = this.roomManager.getRoom(session.roomId);
                if (!room)
                    return;
                if (!this.roomManager.canControlPlayback(session.roomId, session.participantId)) {
                    this.sendError(ws, 'PERMISSION_DENIED', 'Only host can control playback');
                    return;
                }
                const playback = this.roomManager.updatePlayback(session.roomId, session.participantId, {
                    isPlaying: true,
                    position: msg.position
                });
                if (playback) {
                    this.broadcastToRoom(session.roomId, {
                        type: 'PLAY',
                        position: playback.position,
                        serverTime: Date.now(),
                        initiatedBy: session.participantId
                    });
                }
                break;
            }
            case 'PAUSE': {
                if (!session)
                    return;
                if (!this.roomManager.canControlPlayback(session.roomId, session.participantId)) {
                    this.sendError(ws, 'PERMISSION_DENIED', 'Only host can control playback');
                    return;
                }
                const playback = this.roomManager.updatePlayback(session.roomId, session.participantId, {
                    isPlaying: false,
                    position: msg.position
                });
                if (playback) {
                    this.broadcastToRoom(session.roomId, {
                        type: 'PAUSE',
                        position: playback.position,
                        initiatedBy: session.participantId
                    });
                }
                break;
            }
            case 'SEEK': {
                if (!session)
                    return;
                if (!this.roomManager.canControlPlayback(session.roomId, session.participantId)) {
                    this.sendError(ws, 'PERMISSION_DENIED', 'Only host can control playback');
                    return;
                }
                const playback = this.roomManager.updatePlayback(session.roomId, session.participantId, {
                    position: msg.position
                });
                if (playback) {
                    this.broadcastToRoom(session.roomId, {
                        type: 'SEEK',
                        position: playback.position,
                        initiatedBy: session.participantId
                    });
                }
                break;
            }
            case 'SYNC_PING': {
                if (!session)
                    return;
                const room = this.roomManager.getRoom(session.roomId);
                if (!room || room.hostId !== session.participantId)
                    return;
                // If host sends sync ping, update server state and broadcast correction to guests
                this.roomManager.updatePlayback(session.roomId, session.participantId, {
                    position: msg.position,
                    isPlaying: msg.isPlaying
                });
                this.broadcastToRoomExcept(session.roomId, session.participantId, {
                    type: 'SYNC_CORRECTION',
                    position: msg.position,
                    isPlaying: msg.isPlaying,
                    serverTime: Date.now()
                });
                break;
            }
            case 'VIDEO_METADATA': {
                if (!session)
                    return;
                const meta = this.roomManager.updateVideoMetadata(session.roomId, session.participantId, msg.metadata);
                if (meta) {
                    this.broadcastToRoom(session.roomId, {
                        type: 'VIDEO_METADATA_UPDATED',
                        participantId: session.participantId,
                        metadata: meta
                    });
                    // Add system message
                    const sysMsg = this.roomManager.addChatMessage(session.roomId, {
                        senderId: 'SYSTEM',
                        senderName: 'CineMate',
                        message: `${session.userName} selected "${meta.fileName}"`,
                        type: 'SYSTEM'
                    });
                    if (sysMsg) {
                        this.broadcastToRoom(session.roomId, {
                            type: 'CHAT',
                            message: sysMsg
                        });
                    }
                }
                break;
            }
            case 'CHAT': {
                if (!session)
                    return;
                const text = msg.message?.trim();
                if (!text)
                    return;
                const chatMsg = this.roomManager.addChatMessage(session.roomId, {
                    senderId: session.participantId,
                    senderName: session.userName,
                    message: text,
                    type: 'TEXT'
                });
                if (chatMsg) {
                    this.broadcastToRoom(session.roomId, {
                        type: 'CHAT',
                        message: chatMsg
                    });
                }
                break;
            }
            case 'REACTION': {
                if (!session)
                    return;
                const emoji = msg.emoji?.trim().slice(0, 10);
                if (!emoji)
                    return;
                const reactionId = Math.random().toString(36).substring(2, 9);
                const timestamp = Date.now();
                this.broadcastToRoom(session.roomId, {
                    type: 'REACTION',
                    id: reactionId,
                    senderId: session.participantId,
                    senderName: session.userName,
                    emoji,
                    timestamp
                });
                break;
            }
            case 'UPDATE_SETTINGS': {
                if (!session)
                    return;
                const updated = this.roomManager.updateSettings(session.roomId, session.participantId, msg.settings);
                if (updated) {
                    this.broadcastToRoom(session.roomId, {
                        type: 'SETTINGS_UPDATED',
                        settings: updated
                    });
                }
                else {
                    this.sendError(ws, 'PERMISSION_DENIED', 'Only host can update room settings');
                }
                break;
            }
            case 'TRANSFER_HOST': {
                if (!session)
                    return;
                const ok = this.roomManager.transferHost(session.roomId, session.participantId, msg.newHostId);
                if (ok) {
                    const room = this.roomManager.getRoom(session.roomId);
                    if (room) {
                        // Broadcast fresh state to all
                        this.broadcastToRoom(session.roomId, {
                            type: 'ROOM_STATE',
                            room,
                            yourParticipantId: '' // replaced individually or updated
                        });
                    }
                }
                break;
            }
            case 'MUTE_STATUS': {
                if (!session)
                    return;
                this.roomManager.setParticipantMuted(session.roomId, session.participantId, msg.isMuted);
                this.broadcastToRoom(session.roomId, {
                    type: 'PARTICIPANT_MUTE_UPDATED',
                    participantId: session.participantId,
                    isMuted: msg.isMuted
                });
                break;
            }
            case 'WEBRTC_OFFER': {
                if (!session)
                    return;
                this.signalingHandler.handleOffer(session.roomId, session.participantId, msg.target, msg.offer);
                break;
            }
            case 'WEBRTC_ANSWER': {
                if (!session)
                    return;
                this.signalingHandler.handleAnswer(session.roomId, session.participantId, msg.target, msg.answer);
                break;
            }
            case 'ICE_CANDIDATE': {
                if (!session)
                    return;
                this.signalingHandler.handleIceCandidate(session.roomId, session.participantId, msg.target, msg.candidate);
                break;
            }
            default:
                console.warn(`[WEBSOCKET] Unknown message type: ${msg.type}`);
        }
    }
    handleJoinRoom(ws, roomId, userName, participantId) {
        const formattedRoomId = roomId.trim().toUpperCase();
        const joinResult = this.roomManager.joinRoom(formattedRoomId, userName, participantId);
        if (!joinResult) {
            this.sendError(ws, 'ROOM_NOT_FOUND', 'This room does not exist or has expired.');
            return;
        }
        const { room, participant } = joinResult;
        // Register session
        const session = {
            roomId: room.id,
            participantId: participant.id,
            userName: participant.name,
            isAlive: true,
            messageCount: 0,
            lastMessageReset: Date.now()
        };
        this.sessions.set(ws, session);
        // Register in roomSockets
        if (!this.roomSockets.has(room.id)) {
            this.roomSockets.set(room.id, new Map());
        }
        this.roomSockets.get(room.id).set(participant.id, ws);
        console.log(`[ROOM] ${participant.name} (${participant.id}) joined room ${room.id}. Total: ${room.participants.length}`);
        // Send complete current room state to joining participant
        this.sendMessage(ws, {
            type: 'ROOM_STATE',
            room,
            yourParticipantId: participant.id
        });
        // Notify other room participants
        this.broadcastToRoomExcept(room.id, participant.id, {
            type: 'PARTICIPANT_JOINED',
            participant
        });
        // Add and broadcast system join message
        const joinMsg = this.roomManager.addChatMessage(room.id, {
            senderId: 'SYSTEM',
            senderName: 'CineMate',
            message: `${participant.name} joined the room.`,
            type: 'SYSTEM'
        });
        if (joinMsg) {
            this.broadcastToRoom(room.id, {
                type: 'CHAT',
                message: joinMsg
            });
        }
    }
    handleDisconnect(ws) {
        const session = this.sessions.get(ws);
        if (!session)
            return;
        this.sessions.delete(ws);
        const roomMap = this.roomSockets.get(session.roomId);
        const isCurrentSocket = roomMap?.get(session.participantId) === ws;
        if (!isCurrentSocket) {
            // Stale or superseded socket, do not remove active participant
            return;
        }
        roomMap.delete(session.participantId);
        if (roomMap.size === 0) {
            this.roomSockets.delete(session.roomId);
        }
        const leaveResult = this.roomManager.leaveRoom(session.roomId, session.participantId);
        console.log(`[ROOM] ${session.userName} left room ${session.roomId}. Remaining: ${leaveResult.room?.participants.length ?? 0}`);
        if (leaveResult.room && !leaveResult.isRoomEmpty) {
            this.broadcastToRoom(session.roomId, {
                type: 'PARTICIPANT_LEFT',
                participantId: session.participantId,
                participantName: session.userName,
                newHostId: leaveResult.newHostId
            });
            // System chat announcement
            const leftMsg = this.roomManager.addChatMessage(session.roomId, {
                senderId: 'SYSTEM',
                senderName: 'CineMate',
                message: `${session.userName} left the room.`,
                type: 'SYSTEM'
            });
            if (leftMsg) {
                this.broadcastToRoom(session.roomId, {
                    type: 'CHAT',
                    message: leftMsg
                });
            }
        }
    }
    broadcastToRoom(roomId, message) {
        const roomMap = this.roomSockets.get(roomId);
        if (!roomMap)
            return;
        const data = JSON.stringify(message);
        for (const clientWs of roomMap.values()) {
            if (clientWs.readyState === WebSocket.OPEN) {
                try {
                    clientWs.send(data);
                }
                catch (err) {
                    console.error('[WEBSOCKET] Broadcast send error:', err.message);
                }
            }
        }
    }
    broadcastToRoomExcept(roomId, excludedParticipantId, message) {
        const roomMap = this.roomSockets.get(roomId);
        if (!roomMap)
            return;
        const data = JSON.stringify(message);
        for (const [pId, clientWs] of roomMap.entries()) {
            if (pId !== excludedParticipantId && clientWs.readyState === WebSocket.OPEN) {
                try {
                    clientWs.send(data);
                }
                catch (err) {
                    console.error('[WEBSOCKET] BroadcastExcept send error:', err.message);
                }
            }
        }
    }
    sendToParticipant(roomId, targetParticipantId, message) {
        const roomMap = this.roomSockets.get(roomId);
        if (!roomMap)
            return false;
        const targetWs = roomMap.get(targetParticipantId);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            try {
                targetWs.send(JSON.stringify(message));
                return true;
            }
            catch (err) {
                console.error('[WEBSOCKET] Direct message error:', err.message);
            }
        }
        return false;
    }
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    sendError(ws, code, message) {
        this.sendMessage(ws, {
            type: 'ERROR',
            code,
            message
        });
    }
    destroy() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }
}
