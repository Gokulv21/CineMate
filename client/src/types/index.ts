export type PlaybackControlMode = 'HOST_ONLY' | 'EVERYONE';

export interface RoomSettings {
  playbackControl: PlaybackControlMode;
  autoSync: boolean;
  voiceChat: boolean;
  chatEnabled: boolean;
  reactionsEnabled: boolean;
}

export interface VideoMetadata {
  fileName: string;
  duration: number;
  size?: number;
  updatedAt: number;
}

export interface Participant {
  id: string;
  name: string;
  joinedAt: number;
  isHost: boolean;
  videoMetadata?: VideoMetadata;
  isMuted?: boolean;
  isSpeaking?: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  updatedAt: number;
  playbackRate: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  type: 'TEXT' | 'SYSTEM' | 'REACTION';
  emoji?: string;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  createdAt: number;
  lastActivityAt: number;
  participants: Participant[];
  playback: PlaybackState;
  settings: RoomSettings;
  chatHistory: ChatMessage[];
}

export type ClientMessage =
  | {
      type: 'JOIN_ROOM';
      roomId: string;
      userName: string;
      participantId?: string;
    }
  | {
      type: 'LEAVE_ROOM';
    }
  | {
      type: 'PLAY';
      position: number;
      timestamp: number;
    }
  | {
      type: 'PAUSE';
      position: number;
    }
  | {
      type: 'SEEK';
      position: number;
    }
  | {
      type: 'SYNC_PING';
      position: number;
      isPlaying: boolean;
      timestamp: number;
    }
  | {
      type: 'VIDEO_METADATA';
      metadata: {
        fileName: string;
        duration: number;
        size?: number;
      };
    }
  | {
      type: 'CHAT';
      message: string;
    }
  | {
      type: 'REACTION';
      emoji: string;
    }
  | {
      type: 'UPDATE_SETTINGS';
      settings: Partial<RoomSettings>;
    }
  | {
      type: 'TRANSFER_HOST';
      newHostId: string;
    }
  | {
      type: 'WEBRTC_OFFER';
      target: string;
      offer: any;
    }
  | {
      type: 'WEBRTC_ANSWER';
      target: string;
      answer: any;
    }
  | {
      type: 'ICE_CANDIDATE';
      target: string;
      candidate: any;
    }
  | {
      type: 'MUTE_STATUS';
      isMuted: boolean;
    };

export type ServerMessage =
  | {
      type: 'ROOM_STATE';
      room: Room;
      yourParticipantId: string;
    }
  | {
      type: 'PARTICIPANT_JOINED';
      participant: Participant;
    }
  | {
      type: 'PARTICIPANT_LEFT';
      participantId: string;
      participantName: string;
      newHostId?: string;
    }
  | {
      type: 'PLAY';
      position: number;
      serverTime: number;
      initiatedBy: string;
    }
  | {
      type: 'PAUSE';
      position: number;
      initiatedBy: string;
    }
  | {
      type: 'SEEK';
      position: number;
      initiatedBy: string;
    }
  | {
      type: 'SYNC_CORRECTION';
      position: number;
      isPlaying: boolean;
      serverTime: number;
    }
  | {
      type: 'VIDEO_METADATA_UPDATED';
      participantId: string;
      metadata: VideoMetadata;
    }
  | {
      type: 'CHAT';
      message: ChatMessage;
    }
  | {
      type: 'REACTION';
      id: string;
      senderId: string;
      senderName: string;
      emoji: string;
      timestamp: number;
    }
  | {
      type: 'SETTINGS_UPDATED';
      settings: RoomSettings;
    }
  | {
      type: 'PARTICIPANT_MUTE_UPDATED';
      participantId: string;
      isMuted: boolean;
    }
  | {
      type: 'WEBRTC_OFFER';
      from: string;
      offer: any;
    }
  | {
      type: 'WEBRTC_ANSWER';
      from: string;
      answer: any;
    }
  | {
      type: 'ICE_CANDIDATE';
      from: string;
      candidate: any;
    }
  | {
      type: 'ERROR';
      code: string;
      message: string;
    };

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  xOffsetPercent: number;
}

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
export type VoiceStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'MUTED' | 'ERROR';
