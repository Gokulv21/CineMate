import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Heart, 
  Users, 
  Settings as SettingsIcon, 
  Share2, 
  LogOut, 
  Radio, 
  MessageSquare,
  Copy,
  Check
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
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy room id:', err);
    }
  };

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
    <div className="flex flex-col h-screen max-h-screen bg-[#06120e] text-zinc-100 overflow-hidden">
      {/* Header */}
      <header className="h-14 cinema-surface border-b border-emerald-950/60 px-2.5 sm:px-6 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={handleLeaveConfirm}>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            </div>
            <span className="font-bold text-sm tracking-tight hidden md:inline text-white">
              CineMate
            </span>
          </div>

          <span className="text-zinc-600 hidden md:inline">•</span>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate max-w-[90px] xs:max-w-[130px] sm:max-w-xs">
              {room?.name || 'Movie Night 💚'}
            </h2>
            <button
              type="button"
              onClick={handleCopyRoomId}
              className="inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md bg-zinc-900/90 border border-emerald-900/40 hover:border-emerald-500/50 text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-colors shrink-0 cursor-pointer active:scale-95"
              title="Click to copy Room Code"
            >
              <span>{roomId}</span>
              {copiedId ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-500" />
              )}
            </button>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Connection Status Badge */}
          <div 
            className="inline-flex items-center justify-center h-8 px-2 sm:px-2.5 rounded-lg bg-zinc-900/90 border border-emerald-900/30 text-[11px] font-medium text-zinc-300"
            title={
              connectionStatus === 'CONNECTED'
                ? t('room.connected')
                : connectionStatus === 'CONNECTING'
                ? t('room.connecting')
                : t('room.disconnected')
            }
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="ml-1.5 hidden md:inline">
              {connectionStatus === 'CONNECTED'
                ? t('room.connected')
                : connectionStatus === 'CONNECTING'
                ? t('room.connecting')
                : t('room.disconnected')}
            </span>
          </div>

          {/* Online count */}
          <div className="inline-flex items-center justify-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg bg-zinc-900/90 border border-emerald-900/30 text-[11px] font-medium text-zinc-300">
            <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{participantCount}</span>
            <span className="hidden sm:inline">{t('room.online')}</span>
          </div>

          {/* Invite Button */}
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">{t('room.invite')}</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 hover:border-emerald-800/40 transition-colors cursor-pointer"
            aria-label={t('room.settings')}
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
          </button>

          {/* Leave Button */}
          <button
            type="button"
            onClick={handleLeaveConfirm}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900/90 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/50 transition-colors cursor-pointer"
            title={t('room.leave')}
          >
            <LogOut className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </header>

      {/* Main Watch Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2.5 sm:p-4 gap-3 sm:gap-4">
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
              onSendReaction={handleSendReaction}
              reactionsEnabled={room?.settings.reactionsEnabled ?? true}
            />
          </div>

          {/* Mobile Tab Selector */}
          <div className="flex lg:hidden mt-2.5 border-b border-zinc-800/80 shrink-0">
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                mobileTab === 'chat'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('chat.title')} ({messages.length})</span>
            </button>
            <button
              onClick={() => setMobileTab('voice')}
              className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                mobileTab === 'voice'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{t('voice.title')} ({participantCount})</span>
            </button>
          </div>

          {/* Mobile Bottom Sheet/Panel */}
          <div className="lg:hidden flex-1 min-h-[200px] max-h-[280px] mt-2 overflow-hidden">
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
