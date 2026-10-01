import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  Settings as SettingsIcon, 
  Share2, 
  LogOut, 
  Mic,
  MicOff,
  Volume2
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
import { Logo } from './Logo.js';

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
  }, [roomId, userName, t]);

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
    remoteSpeakingPeers,
    partnerIsSpeaking,
    toggleMute,
    retryAudio
  } = useWebRTCVoice({
    myParticipantId,
    participantIds,
    enabled: room?.settings.voiceChat ?? true
  });

  // Smart Audio Ducking: When partner speaks, duck video volume to 35% so their voice is crystal clear
  const previousVolumeRef = useRef<number>(1.0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (partnerIsSpeaking) {
      previousVolumeRef.current = video.volume;
      video.volume = Math.min(video.volume, 0.35);
    } else {
      video.volume = previousVolumeRef.current;
    }
  }, [partnerIsSpeaking]);

  const partner = room?.participants.find(p => p.id !== myParticipantId);
  const partnerName = partner?.name || '';

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
    <div className="flex flex-col h-screen max-h-screen bg-[#08080a] text-zinc-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-14 bg-[#0c0c10]/90 backdrop-blur-md border-b border-white/[0.06] px-2.5 sm:px-6 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Logo size="sm" onClick={handleLeaveConfirm} />

          <span className="text-zinc-600 hidden md:inline">•</span>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs">
              {room?.name || 'Movie Night'}
            </h2>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Partner Speaking Indicator */}
          {partnerIsSpeaking && (
            <div className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium animate-pulse">
              <Volume2 className="w-3.5 h-3.5 shrink-0 text-white" />
              <span className="truncate max-w-[90px] sm:max-w-[130px]">
                {partnerName || 'Partner'}
              </span>
            </div>
          )}

          {/* Quick Voice Mute / Unmute */}
          {room?.settings.voiceChat && (
            <button
              type="button"
              onClick={toggleMute}
              className={`inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer select-none active:scale-95 ${
                isMuted
                  ? 'bg-zinc-900 text-zinc-400 border border-white/10 hover:text-white'
                  : 'bg-white hover:bg-zinc-200 text-black shadow-sm'
              }`}
              title={isMuted ? t('voice.unmute') : t('voice.mute')}
              aria-label={isMuted ? t('voice.unmute') : t('voice.mute')}
            >
              {isMuted ? (
                <>
                  <MicOff className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  <span className="hidden sm:inline font-medium">{t('voice.mute')}</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 shrink-0 text-black" />
                  <span className="hidden sm:inline font-medium">
                    {isSpeakingLocally ? t('voice.speaking') : t('voice.title')}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Connection Status Badge */}
          <div 
            className="inline-flex items-center justify-center h-8 px-2 sm:px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-zinc-300"
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
                  ? 'bg-emerald-400'
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
          <div className="inline-flex items-center justify-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-zinc-300">
            <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>{participantCount}</span>
            <span className="hidden sm:inline">{t('room.online')}</span>
          </div>

          {/* Invite Button */}
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-white hover:bg-zinc-200 text-xs font-semibold text-black active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">{t('room.invite')}</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
            aria-label={t('room.settings')}
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
          </button>

          {/* Leave Button */}
          <button
            type="button"
            onClick={handleLeaveConfirm}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-white/[0.08] transition-colors cursor-pointer"
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
              reactions={reactions}
              messages={messages}
              currentParticipantId={myParticipantId}
              onSendMessage={handleSendMessage}
              voiceEnabled={room?.settings.voiceChat ?? true}
              isVoiceMuted={isMuted}
              onToggleVoiceMute={toggleMute}
              isSpeakingLocally={isSpeakingLocally}
              partnerIsSpeaking={partnerIsSpeaking}
              partnerName={partnerName}
            />
          </div>

          {/* Mobile Bottom Area: Direct Chat without separate tabs! */}
          <div className="lg:hidden flex-1 min-h-[190px] max-h-[260px] mt-2.5 overflow-hidden">
            <ChatPanel
              messages={messages}
              currentParticipantId={myParticipantId}
              onSendMessage={handleSendMessage}
              onSendReaction={handleSendReaction}
              reactionsEnabled={room?.settings.reactionsEnabled ?? true}
            />
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
              remoteSpeakingPeers={remoteSpeakingPeers}
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
