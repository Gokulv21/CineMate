import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from './RoomManager.js';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it('creates a room and first user joining becomes the host', () => {
    const { room, hostParticipantId } = manager.createRoom('Gokul', 'Interstellar Night');
    expect(room.id).toBeDefined();
    expect(room.id.length).toBe(6);
    expect(room.name).toBe('Interstellar Night');
    expect(hostParticipantId).toBeDefined();

    // First user joins and claims host
    const joinResult = manager.joinRoom(room.id, 'Gokul');
    expect(joinResult).not.toBeNull();
    expect(joinResult?.room.participants.length).toBe(1);
    expect(joinResult?.participant.name).toBe('Gokul');
    expect(joinResult?.participant.isHost).toBe(true);
    expect(joinResult?.participant.id).toBe(room.hostId);
    expect(room.playback.isPlaying).toBe(false);
    expect(room.playback.position).toBe(0);
  });

  it('allows a guest to join an existing room', () => {
    const { room } = manager.createRoom('HostUser');
    const hostJoin = manager.joinRoom(room.id, 'HostUser');
    const guestJoin = manager.joinRoom(room.id, 'PartnerUser');

    expect(hostJoin?.participant.isHost).toBe(true);
    expect(guestJoin).not.toBeNull();
    expect(guestJoin?.room.participants.length).toBe(2);
    expect(guestJoin?.participant.name).toBe('PartnerUser');
    expect(guestJoin?.participant.isHost).toBe(false);
  });

  it('rejects joining a non-existent room', () => {
    const joinResult = manager.joinRoom('NONEXIST', 'Guest');
    expect(joinResult).toBeNull();
  });

  it('controls playback when host only is selected', () => {
    const { room } = manager.createRoom('HostUser');
    const hostJoin = manager.joinRoom(room.id, 'HostUser')!;
    const guestJoin = manager.joinRoom(room.id, 'GuestUser')!;

    // Host can update
    const playUpdate = manager.updatePlayback(room.id, hostJoin.participant.id, { isPlaying: true, position: 42 });
    expect(playUpdate?.isPlaying).toBe(true);
    expect(playUpdate?.position).toBe(42);

    // Guest cannot update in HOST_ONLY mode
    const guestAttempt = manager.updatePlayback(room.id, guestJoin.participant.id, { isPlaying: false, position: 10 });
    expect(guestAttempt).toBeNull();

    // Change setting to EVERYONE
    manager.updateSettings(room.id, hostJoin.participant.id, { playbackControl: 'EVERYONE' });
    const guestSuccess = manager.updatePlayback(room.id, guestJoin.participant.id, { isPlaying: false, position: 10 });
    expect(guestSuccess?.isPlaying).toBe(false);
    expect(guestSuccess?.position).toBe(10);
  });

  it('handles participant leave and reassigns host if host leaves', () => {
    const { room } = manager.createRoom('Host');
    const hostJoin = manager.joinRoom(room.id, 'Host')!;
    const guestJoin = manager.joinRoom(room.id, 'Guest')!;

    const leaveResult = manager.leaveRoom(room.id, hostJoin.participant.id);
    expect(leaveResult.isRoomEmpty).toBe(false);
    expect(leaveResult.newHostId).toBe(guestJoin.participant.id);
    expect(leaveResult.room?.participants[0].isHost).toBe(true);
  });

  it('records chat messages and updates video metadata', () => {
    const { room } = manager.createRoom('Host');
    const hostJoin = manager.joinRoom(room.id, 'Host')!;

    const meta = manager.updateVideoMetadata(room.id, hostJoin.participant.id, {
      fileName: 'movie.mp4',
      duration: 7200,
      size: 1048576
    });
    expect(meta?.duration).toBe(7200);

    const chat = manager.addChatMessage(room.id, {
      senderId: hostJoin.participant.id,
      senderName: hostJoin.participant.name,
      message: 'Hello world!',
      type: 'TEXT'
    });
    expect(chat?.message).toBe('Hello world!');
    expect(room.chatHistory.length).toBe(1);
  });
});
