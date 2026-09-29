import { Room, Participant, PlaybackState, RoomSettings, ChatMessage, VideoMetadata } from '../types/index.js';

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateRoomCode(length: number = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return result;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private emptySince: Map<string, number> = new Map();

  /**
   * Create a new room with default settings and empty participants list
   */
  public createRoom(hostName: string, customRoomName?: string): { room: Room; hostParticipantId: string } {
    let roomId = generateRoomCode();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const hostId = generateId();
    const now = Date.now();

    const defaultSettings: RoomSettings = {
      playbackControl: 'HOST_ONLY',
      autoSync: true,
      voiceChat: true,
      chatEnabled: true,
      reactionsEnabled: true
    };

    const initialPlayback: PlaybackState = {
      isPlaying: false,
      position: 0,
      updatedAt: now,
      playbackRate: 1.0
    };

    const room: Room = {
      id: roomId,
      name: customRoomName?.trim().slice(0, 50) || 'Movie Night 💚',
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
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase().trim());
  }

  /**
   * Join an existing room. First user to join automatically assumes the host role.
   */
  public joinRoom(
    roomId: string,
    userName: string,
    existingParticipantId?: string
  ): { room: Room; participant: Participant } | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

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

    const participant: Participant = {
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
  public leaveRoom(roomId: string, participantId: string): {
    room?: Room;
    leftParticipant?: Participant;
    newHostId?: string;
    isRoomEmpty: boolean;
  } {
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

    let newHostId: string | undefined;

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

  public canControlPlayback(roomId: string, participantId: string): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;
    if (room.settings.playbackControl === 'EVERYONE') return true;
    return room.hostId === participantId;
  }

  public updatePlayback(
    roomId: string,
    participantId: string,
    update: { isPlaying?: boolean; position?: number; playbackRate?: number }
  ): PlaybackState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

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

  public updateVideoMetadata(
    roomId: string,
    participantId: string,
    metadata: { fileName: string; duration: number; size?: number }
  ): VideoMetadata | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const participant = room.participants.find(p => p.id === participantId);
    if (!participant) return null;

    const videoMeta: VideoMetadata = {
      fileName: metadata.fileName.slice(0, 100),
      duration: Math.max(0, metadata.duration),
      size: metadata.size,
      updatedAt: Date.now()
    };

    participant.videoMetadata = videoMeta;
    room.lastActivityAt = Date.now();

    return videoMeta;
  }

  public updateSettings(
    roomId: string,
    participantId: string,
    settingsUpdate: Partial<RoomSettings>
  ): RoomSettings | null {
    const room = this.getRoom(roomId);
    if (!room || room.hostId !== participantId) return null;

    room.settings = {
      ...room.settings,
      ...settingsUpdate
    };
    room.lastActivityAt = Date.now();

    return room.settings;
  }

  public transferHost(roomId: string, currentHostId: string, newHostId: string): boolean {
    const room = this.getRoom(roomId);
    if (!room || room.hostId !== currentHostId) return false;

    const targetParticipant = room.participants.find(p => p.id === newHostId);
    if (!targetParticipant) return false;

    const currentHost = room.participants.find(p => p.id === currentHostId);
    if (currentHost) currentHost.isHost = false;

    targetParticipant.isHost = true;
    room.hostId = newHostId;
    room.lastActivityAt = Date.now();

    return true;
  }

  public setParticipantMuted(roomId: string, participantId: string, isMuted: boolean): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;

    const participant = room.participants.find(p => p.id === participantId);
    if (!participant) return false;

    participant.isMuted = isMuted;
    return true;
  }

  public addChatMessage(
    roomId: string,
    msg: Omit<ChatMessage, 'id' | 'timestamp'>
  ): ChatMessage | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const chatMsg: ChatMessage = {
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

  public deleteRoom(roomId: string): boolean {
    const normalizedId = roomId.toUpperCase().trim();
    this.emptySince.delete(normalizedId);
    return this.rooms.delete(normalizedId);
  }

  public cleanupStaleRooms(emptyTimeoutMs: number = 2 * 60 * 1000, staleTimeoutMs: number = 30 * 60 * 1000): number {
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

  public getRoomCount(): number {
    return this.rooms.size;
  }
}
