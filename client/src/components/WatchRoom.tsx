import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Heart, 
  Users, 
  Settings as SettingsIcon, 
  Share2, 
  LogOut, 
  Radio, 
  MessageSquare
} from 'lucide-react';
import type { 
  Room, 
  ChatMessage, 
  FloatingReaction, 
  ConnectionStatus, 
  ServerMessage,
  VideoMetadata,
  RoomSettings
} from '../types/index.js';
import { wsService } from '../services/websocket.js';
import { useWebRTCVoice } from '../hooks/useWebRTCVoice.js';
import { useVideoSync } from '../hooks/useVideoSync.js';
import { VideoPlayer } from './VideoPlayer.js';
import { ChatPanel } from './ChatPanel.js';
import { VoiceControls } from './VoiceControls.js';
import { SettingsModal } from './SettingsModal.js';
import { InviteModal } from './InviteModal.js';
import { ReactionOverlay } from './ReactionOverlay.js';

interface WatchRoomProps {
  roomId: string;
  userName: string;
  onLeave: () => void;
}

export const WatchRoom: React.FC<WatchRoomProps> = ({
  roomId,
  userName,
  onLeave
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string>('');
  const myParticipantIdRef = useRef<string>('');
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'voice'>('chat');
  const [partnerMetadata, setPartnerMetadata] = useState<VideoMetadata | undefined>(undefined);

  useEffect(() => {
    wsService.connect(roomId, userName);

    const unsubStatus = wsService.addStatusListener((status) => {
      setConnectionStatus(status);
    });

    const unsubMsg = wsService.addMessageListener((msg: ServerMessage) => {
      switch (msg.type) {
        case 'ROOM_STATE': {
          setRoom(msg.room);
          if (msg.yourParticipantId) {
            myParticipantIdRef.current = msg.yourParticipantId;
            setMyParticipantId(msg.yourParticipantId);
          }
          setMessages(msg.room.chatHistory || []);

          const partner = msg.room.participants.find(p => p.id !== msg.yourParticipantId && p.videoMetadata);
          if (partner?.videoMetadata) {
            setPartnerMetadata(partner.videoMetadata);
          }
          break;
        }

        case 'PARTICIPANT_JOINED': {
          setRoom(prev => prev ? {
            ...prev,
            participants: [...prev.participants.filter(p => p.id !== msg.participant.id), msg.participant]
          } : null);
          break;
        }

        case 'PARTICIPANT_LEFT': {
          setRoom(prev => {
            if (!prev) return null;
            const updated = prev.participants.filter(p => p.id !== msg.participantId);
            const newHostId = msg.newHostId || prev.hostId;
            return {
              ...prev,
              hostId: newHostId,
              participants: updated.map(p => ({
                ...p,
                isHost: p.id === newHostId
              }))
            };
          });
          break;
        }

        case 'VIDEO_METADATA_UPDATED': {
          setRoom(prev => {
            if (!prev) return null;
            return {
              ...prev,
              participants: prev.participants.map(p => 
                p.id === msg.participantId ? { ...p, videoMetadata: msg.metadata } : p
              )
            };
          });

          if (msg.participantId !== myParticipantIdRef.current) {
            setPartnerMetadata(msg.metadata);
          }
          break;
        }

        case 'CHAT': {
          setMessages(prev => [...prev, msg.message]);
          break;
        }

        case 'REACTION': {
          const newReaction: FloatingReaction = {
            id: msg.id,
            emoji: msg.emoji,
            senderName: msg.senderName,
            xOffsetPercent: 20 + Math.random() * 60
          };
          setReactions(prev => [...prev, newReaction]);

          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== newReaction.id));
          }, 2400);
          break;
        }

        case 'SETTINGS_UPDATED': {
          setRoom(prev => prev ? { ...prev, settings: msg.settings } : null);
          break;
        }

        case 'PARTICIPANT_MUTE_UPDATED': {
          setRoom(prev => {
            if (!prev) return null;
            return {
              ...prev,
              participants: prev.participants.map(p => 
                p.id === msg.participantId ? { ...p, isMuted: msg.isMuted } : p
              )
            };
          });
          break;
        }

        case 'ERROR': {
          console.error('[ROOM ERROR]:', msg.message);
          if (msg.code === 'ROOM_NOT_FOUND') {
            alert(t('errors.invalidRoom'));
            onLeaveRef.current();
          }
          break;
        }
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
      wsService.disconnect();
    };
  }, [roomId, userName]);

  const isHost = room ? room.hostId === myParticipantId : false;
  const canControl = room 
    ? (room.settings.playbackControl === 'EVERYONE' || isHost)
    : false;

  const { 
    triggerPlay, 
    triggerPause, 
    triggerSeek, 
    triggerReplay, 
    eventHandlers 
  } = useVideoSync({
    videoRef,
    isHost,
    canControl,
    autoSyncEnabled: room?.settings.autoSync ?? true,
    initialPlayback: room?.playback
  });

  const participantIds = room?.participants.map(p => p.id) || [];
  const {
    voiceStatus,
    isMuted,
    isSpeakingLocally,
    toggleMute,
    retryAudio
  } = useWebRTCVoice({
    myParticipantId,
    participantIds,
    enabled: room?.settings.voiceChat ?? true
  });

  const handleVideoSelected = useCallback((metadata: { fileName: string; duration: number; size?: number }) => {
    wsService.sendMessage({
      type: 'VIDEO_METADATA',
      metadata
    });
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    wsService.sendMessage({
      type: 'CHAT',
      message: text
    });
  }, []);

  const handleSendReaction = useCallback((emoji: string) => {
    wsService.sendMessage({
      type: 'REACTION',
      emoji
    });
  }, []);

  const handleUpdateSettings = useCallback((newSettings: Partial<RoomSettings>) => {
    wsService.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: newSettings
    });
  }, []);

  const handleLeaveConfirm = () => {
    if (window.confirm(t('room.leaveConfirm'))) {
      wsService.disconnect();
      onLeave();
    }
  };

  const participantCount = room?.participants.length || 1;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#07080b] text-zinc-100 overflow-hidden">
      {/* Header */}
      <header className="h-14 cinema-surface border-b border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleLeaveConfirm}>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            </div>
            <span className="font-bold text-sm tracking-tight hidden sm:inline text-white">
              CineMate
            </span>
          </div>

          <span className="text-zinc-600 hidden sm:inline">•</span>

          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-semibold text-zinc-200 truncate max-w-[140px] sm:max-w-xs">
              {room?.name || 'Movie Night ❤️'}
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-rose-400">
              {roomId}
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-[10px]">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-400'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-zinc-300 font-medium hidden md:inline">
              {connectionStatus === 'CONNECTED'
                ? t('room.connected')
                : connectionStatus === 'CONNECTING'
                ? t('room.connecting')
                : t('room.disconnected')}
            </span>
          </div>

          {/* Online count */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-[10px] text-zinc-300">
            <Users className="w-3 h-3 text-rose-400" />
            <span>{participantCount} {t('room.online')}</span>
          </div>

          {/* Invite Button */}
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-800 hover:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">{t('room.invite')}</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
            aria-label={t('room.settings')}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Leave Button */}
          <button
            type="button"
            onClick={handleLeaveConfirm}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/50 transition-colors cursor-pointer"
            title={t('room.leave')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Watch Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 sm:p-4 gap-4">
        {/* Left Column: Video Viewport & Floating Reactions */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          <div className="relative flex-1 flex items-center justify-center min-h-0">
            <ReactionOverlay reactions={reactions} />

            <VideoPlayer
              videoRef={videoRef}
              isHost={isHost}
              canControl={canControl}
              partnerMetadata={partnerMetadata}
              onVideoSelected={handleVideoSelected}
              onPlay={triggerPlay}
              onPause={triggerPause}
              onSeek={triggerSeek}
              onReplay={triggerReplay}
              videoEventHandlers={eventHandlers}
            />
          </div>

          {/* Mobile Tab Selector */}
          <div className="flex lg:hidden mt-3 border-b border-zinc-800 shrink-0">
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                mobileTab === 'chat'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-zinc-400'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('chat.title')} ({messages.length})</span>
            </button>
            <button
              onClick={() => setMobileTab('voice')}
              className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                mobileTab === 'voice'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-zinc-400'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{t('voice.title')} ({participantCount})</span>
            </button>
          </div>

          {/* Mobile Bottom Sheet/Panel */}
          <div className="lg:hidden flex-1 min-h-[220px] max-h-[300px] mt-2 overflow-hidden">
            {mobileTab === 'chat' ? (
              <ChatPanel
                messages={messages}
                currentParticipantId={myParticipantId}
                onSendMessage={handleSendMessage}
                onSendReaction={handleSendReaction}
                reactionsEnabled={room?.settings.reactionsEnabled ?? true}
              />
            ) : (
              <VoiceControls
                participants={room?.participants || []}
                currentParticipantId={myParticipantId}
                voiceStatus={voiceStatus}
                isMuted={isMuted}
                isSpeakingLocally={isSpeakingLocally}
                onToggleMute={toggleMute}
                onRetryVoice={retryAudio}
              />
            )}
          </div>
        </div>

        {/* Right Column: Desktop Chat & Voice Sidebar */}
        <aside className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 gap-3.5 h-full">
          {room?.settings.voiceChat && (
            <VoiceControls
              participants={room?.participants || []}
              currentParticipantId={myParticipantId}
              voiceStatus={voiceStatus}
              isMuted={isMuted}
              isSpeakingLocally={isSpeakingLocally}
              onToggleMute={toggleMute}
              onRetryVoice={retryAudio}
            />
          )}

          <div className="flex-1 min-h-0">
            <ChatPanel
              messages={messages}
              currentParticipantId={myParticipantId}
              onSendMessage={handleSendMessage}
              onSendReaction={handleSendReaction}
              reactionsEnabled={room?.settings.reactionsEnabled ?? true}
            />
          </div>
        </aside>
      </div>

      <InviteModal
        isOpen={isInviteOpen}
        roomId={roomId}
        onClose={() => setIsInviteOpen(false)}
      />

      {room && (
        <SettingsModal
          isOpen={isSettingsOpen}
          isHost={isHost}
          settings={room.settings}
          onClose={() => setIsSettingsOpen(false)}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
    </div>
  );
};
