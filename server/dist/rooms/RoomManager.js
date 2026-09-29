const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function generateRoomCode(length = 6) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return result;
}
function generateId() {
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
}
export class RoomManager {
    rooms = new Map();
    emptySince = new Map();
    /**
     * Create a new room with default settings and empty participants list
     */
    createRoom(hostName, customRoomName) {
        let roomId = generateRoomCode();
        while (this.rooms.has(roomId)) {
            roomId = generateRoomCode();
        }
        const hostId = generateId();
        const now = Date.now();
        const defaultSettings = {
            playbackControl: 'HOST_ONLY',
            autoSync: true,
            voiceChat: true,
            chatEnabled: true,
            reactionsEnabled: true
        };
        const initialPlayback = {
            isPlaying: false,
            position: 0,
            updatedAt: now,
            playbackRate: 1.0
        };
        const room = {
            id: roomId,
            name: customRoomName?.trim().slice(0, 50) || 'Movie Night ❤️',
            hostId: hostId,
            createdAt: now,
            lastActivityAt: now,
            participants: [],
            playback: initialPlayback,
            settings: defaultSettings,
            chatHistory: []
        };
        this.rooms.set(roomId, room);
        this.emptySince.delete(roomId);
        return { room, hostParticipantId: hostId };
    }
    /**
     * Get room by ID (case-insensitive)
     */
    getRoom(roomId) {
        return this.rooms.get(roomId.toUpperCase().trim());
    }
    /**
     * Join an existing room. First user to join automatically assumes the host role.
     */
    joinRoom(roomId, userName, existingParticipantId) {
        const room = this.getRoom(roomId);
        if (!room)
            return null;
        const now = Date.now();
        // Check if participant is already connected/registered in room
        if (existingParticipantId) {
            const existing = room.participants.find(p => p.id === existingParticipantId);
            if (existing) {
                existing.name = userName.trim().slice(0, 30) || existing.name;
                room.lastActivityAt = now;
                this.emptySince.delete(room.id);
                return { room, participant: existing };
            }
        }
        const isFirst = room.participants.length === 0;
        const participantId = isFirst && room.hostId ? room.hostId : (existingParticipantId || generateId());
        const participant = {
            id: participantId,
            name: userName.trim().slice(0, 30) || (isFirst ? 'Host' : 'Guest'),
            joinedAt: now,
            isHost: isFirst || room.hostId === participantId,
            isMuted: true
        };
        if (isFirst) {
            room.hostId = participant.id;
        }
        room.participants.push(participant);
        room.lastActivityAt = now;
        this.emptySince.delete(room.id);
        return { room, participant };
    }
    /**
     * Remove a participant from a room
     */
    leaveRoom(roomId, participantId) {
        const room = this.getRoom(roomId);
        if (!room) {
            return { isRoomEmpty: true };
        }
        const index = room.participants.findIndex(p => p.id === participantId);
        if (index === -1) {
            return { room, isRoomEmpty: room.participants.length === 0 };
        }
        const [leftParticipant] = room.participants.splice(index, 1);
        room.lastActivityAt = Date.now();
        let newHostId;
        // If host left and others remain, elect next participant as host
        if (room.hostId === participantId && room.participants.length > 0) {
            const nextHost = room.participants[0];
            nextHost.isHost = true;
            room.hostId = nextHost.id;
            newHostId = nextHost.id;
        }
        if (room.participants.length === 0) {
            this.emptySince.set(room.id, Date.now());
            return { room, leftParticipant, newHostId, isRoomEmpty: true };
        }
        return { room, leftParticipant, newHostId, isRoomEmpty: false };
    }
    canControlPlayback(roomId, participantId) {
        const room = this.getRoom(roomId);
        if (!room)
            return false;
        if (room.settings.playbackControl === 'EVERYONE')
            return true;
        return room.hostId === participantId;
    }
    updatePlayback(roomId, participantId, update) {
        const room = this.getRoom(roomId);
        if (!room)
            return null;
        if (!this.canControlPlayback(roomId, participantId)) {
            return null;
        }
        const now = Date.now();
        if (typeof update.isPlaying === 'boolean') {
            room.playback.isPlaying = update.isPlaying;
        }
        if (typeof update.position === 'number' && !isNaN(update.position)) {
            room.playback.position = Math.max(0, update.position);
        }
        if (typeof update.playbackRate === 'number' && !isNaN(update.playbackRate)) {
            room.playback.playbackRate = Math.min(2.0, Math.max(0.5, update.playbackRate));
        }
        room.playback.updatedAt = now;
        room.lastActivityAt = now;
        return room.playback;
    }
    updateVideoMetadata(roomId, participantId, metadata) {
        const room = this.getRoom(roomId);
        if (!room)
            return null;
        const participant = room.participants.find(p => p.id === participantId);
        if (!participant)
            return null;
        const videoMeta = {
            fileName: metadata.fileName.slice(0, 100),
            duration: Math.max(0, metadata.duration),
            size: metadata.size,
            updatedAt: Date.now()
        };
        participant.videoMetadata = videoMeta;
        room.lastActivityAt = Date.now();
        return videoMeta;
    }
    updateSettings(roomId, participantId, settingsUpdate) {
        const room = this.getRoom(roomId);
        if (!room || room.hostId !== participantId)
            return null;
        room.settings = {
            ...room.settings,
            ...settingsUpdate
        };
        room.lastActivityAt = Date.now();
        return room.settings;
    }
    transferHost(roomId, currentHostId, newHostId) {
        const room = this.getRoom(roomId);
        if (!room || room.hostId !== currentHostId)
            return false;
        const targetParticipant = room.participants.find(p => p.id === newHostId);
        if (!targetParticipant)
            return false;
        const currentHost = room.participants.find(p => p.id === currentHostId);
        if (currentHost)
            currentHost.isHost = false;
        targetParticipant.isHost = true;
        room.hostId = newHostId;
        room.lastActivityAt = Date.now();
        return true;
    }
    setParticipantMuted(roomId, participantId, isMuted) {
        const room = this.getRoom(roomId);
        if (!room)
            return false;
        const participant = room.participants.find(p => p.id === participantId);
        if (!participant)
            return false;
        participant.isMuted = isMuted;
        return true;
    }
    addChatMessage(roomId, msg) {
        const room = this.getRoom(roomId);
        if (!room)
            return null;
        const chatMsg = {
            ...msg,
            id: generateId(),
            timestamp: Date.now(),
            message: msg.message.slice(0, 500)
        };
        room.chatHistory.push(chatMsg);
        if (room.chatHistory.length > 100) {
            room.chatHistory.shift();
        }
        room.lastActivityAt = Date.now();
        return chatMsg;
    }
    cleanupStaleRooms(emptyTimeoutMs = 30 * 60 * 1000, staleTimeoutMs = 2 * 60 * 60 * 1000) {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [roomId, emptyTime] of this.emptySince.entries()) {
            if (now - emptyTime > emptyTimeoutMs) {
                this.rooms.delete(roomId);
                this.emptySince.delete(roomId);
                cleanedCount++;
            }
        }
        for (const [roomId, room] of this.rooms.entries()) {
            if (now - room.lastActivityAt > staleTimeoutMs && room.participants.length === 0) {
                this.rooms.delete(roomId);
                this.emptySince.delete(roomId);
                cleanedCount++;
            }
        }
        return cleanedCount;
    }
    getRoomCount() {
        return this.rooms.size;
    }
}
