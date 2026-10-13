export class SignalingHandler {
    roomManager;
    messenger;
    constructor(roomManager, messenger) {
        this.roomManager = roomManager;
        this.messenger = messenger;
    }
    handleOffer(roomId, senderId, targetId, offer) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            return false;
        const targetExists = room.participants.some(p => p.id === targetId);
        if (!targetExists)
            return false;
        return this.messenger.sendToParticipant(roomId, targetId, {
            type: 'WEBRTC_OFFER',
            from: senderId,
            offer
        });
    }
    handleAnswer(roomId, senderId, targetId, answer) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            return false;
        const targetExists = room.participants.some(p => p.id === targetId);
        if (!targetExists)
            return false;
        return this.messenger.sendToParticipant(roomId, targetId, {
            type: 'WEBRTC_ANSWER',
            from: senderId,
            answer
        });
    }
    handleIceCandidate(roomId, senderId, targetId, candidate) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            return false;
        const targetExists = room.participants.some(p => p.id === targetId);
        if (!targetExists)
            return false;
        return this.messenger.sendToParticipant(roomId, targetId, {
            type: 'ICE_CANDIDATE',
            from: senderId,
            candidate
        });
    }
    handleStreamOffer(roomId, senderId, targetId, offer) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            return false;
        const targetExists = room.participants.some(p => p.id === targetId);
        if (!targetExists)
            return false;
        return this.messenger.sendToParticipant(roomId, targetId, {
            type: 'STREAM_OFFER',
            from: senderId,
            offer
        });
    }
    handleStreamAnswer(roomId, senderId, targetId, answer) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            return false;
        const targetExists = room.participants.some(p => p.id === targetId);
        if (!targetExists)
            return false;
        return this.messenger.sendToParticipant(roomId, targetId, {
            type: 'STREAM_ANSWER',
            from: senderId,
            answer
        });
    }
    handleStreamIceCandidate(roomId, senderId, targetId, candidate) {
        const room = this.roomManager.getRoom(roomId);
        if (!room)
            return false;
        const targetExists = room.participants.some(p => p.id === targetId);
        if (!targetExists)
            return false;
        return this.messenger.sendToParticipant(roomId, targetId, {
            type: 'STREAM_ICE',
            from: senderId,
            candidate
        });
    }
}
