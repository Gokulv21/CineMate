import { RoomManager } from '../rooms/RoomManager.js';
import { ServerMessage } from '../types/index.js';

export interface PeerMessenger {
  sendToParticipant(roomId: string, targetParticipantId: string, message: ServerMessage): boolean;
}

export class SignalingHandler {
  constructor(
    private roomManager: RoomManager,
    private messenger: PeerMessenger
  ) {}

  public handleOffer(roomId: string, senderId: string, targetId: string, offer: any): boolean {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return false;

    const targetExists = room.participants.some(p => p.id === targetId);
    if (!targetExists) return false;

    return this.messenger.sendToParticipant(roomId, targetId, {
      type: 'WEBRTC_OFFER',
      from: senderId,
      offer
    });
  }

  public handleAnswer(roomId: string, senderId: string, targetId: string, answer: any): boolean {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return false;

    const targetExists = room.participants.some(p => p.id === targetId);
    if (!targetExists) return false;

    return this.messenger.sendToParticipant(roomId, targetId, {
      type: 'WEBRTC_ANSWER',
      from: senderId,
      answer
    });
  }

  public handleIceCandidate(roomId: string, senderId: string, targetId: string, candidate: any): boolean {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return false;

    const targetExists = room.participants.some(p => p.id === targetId);
    if (!targetExists) return false;

    return this.messenger.sendToParticipant(roomId, targetId, {
      type: 'ICE_CANDIDATE',
      from: senderId,
      candidate
    });
  }
}
