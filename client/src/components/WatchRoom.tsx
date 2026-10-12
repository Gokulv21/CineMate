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
import { DualViewingPlayer } from './DualViewingPlayer.js';
import { ScreeningPlayer } from './ScreeningPlayer.js';
import { ChatPanel } from './ChatPanel.js';
import { VoiceControls } from './VoiceControls.js';
import { SettingsModal } from './SettingsModal.js';
import { InviteModal } from './InviteModal.js';
import { ReactionOverlay } from './ReactionOverlay.js';
import { Logo } from './Logo.js';

interface WatchRoomProps {
  roomId: string;
  userName: string;
  participantId?: string;
  onLeave: () => void;
}

export const WatchRoom: React.FC<WatchRoomProps> = ({
  roomId,
  userName,
  participantId,
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
    wsService.connect(roomId, userName, participantId);

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

        case 'MODE_UPDATED': {
          setRoom(prev => prev ? { ...prev, mode: msg.mode } : null);
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

  const [screeningStream, setScreeningStream] = useState<MediaStream | null>(null);
  const [remoteScreeningStream, setRemoteScreeningStream] = useState<MediaStream | null>(null);

  const isScreeningMode = room?.mode === 'SCREENING';
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
    enabled: room?.settings.voiceChat ?? true,
    isScreeningMode,
    isHost,
    screeningStream,
    onRemoteScreeningStream: setRemoteScreeningStream
  });

  const handleToggleMode = useCallback(() => {
    if (!isHost || !room) return;
    const nextMode = room.mode === 'SCREENING' ? 'DUAL_VIEWING' : 'SCREENING';
    wsService.sendMessage({
      type: 'UPDATE_MODE',
      mode: nextMode
    });
    setRoom(prev => prev ? { ...prev, mode: nextMode } : null);
  }, [isHost, room]);

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

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-screen cinema-ambient-bg text-zinc-100">
        <div className="w-12 h-12 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_35px_rgba(244,63,94,0.6)]" />
        <p className="text-base font-bold text-white tracking-wide">Connecting to CineMate Theater...</p>
        <p className="text-xs text-zinc-400 mt-1 font-medium">Synchronizing encrypted session</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen cinema-ambient-bg text-zinc-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-14 bg-[#0a0912]/85 backdrop-blur-xl border-b border-white/[0.08] px-2.5 sm:px-6 flex items-center justify-between shrink-0 z-40 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Logo size="sm" onClick={handleLeaveConfirm} />

          <span className="text-zinc-600 hidden md:inline">•</span>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs">
              {room?.name || 'Movie Night'}
            </h2>
            {room?.mode === 'SCREENING' ? (
              <button
                type="button"
                onClick={isHost ? handleToggleMode : undefined}
                className={`hidden sm:inline-flex text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.3)] shrink-0 items-center gap-1 ${
                  isHost ? 'hover:bg-purple-500/35 cursor-pointer active:scale-95 transition-all' : 'cursor-default'
                }`}
                title={isHost ? 'Host: Click to switch to Dual Viewing (Both have movie file)' : 'Screening Mode: Host streams to Viewer'}
              >
                <span>Screening ↔ Viewing</span>
                {isHost && <span className="text-[8px] bg-purple-500/40 px-1 rounded text-white">Switch</span>}
              </button>
            ) : (
              <button
                type="button"
                onClick={isHost ? handleToggleMode : undefined}
                className={`hidden sm:inline-flex text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.3)] shrink-0 items-center gap-1 ${
                  isHost ? 'hover:bg-rose-500/35 cursor-pointer active:scale-95 transition-all' : 'cursor-default'
                }`}
                title={isHost ? 'Host: Click to switch to Screening Mode (Host Broadcast)' : 'Dual Viewing: Both users have movie file'}
              >
                <span>Viewing ↔ Viewing</span>
                {isHost && <span className="text-[8px] bg-rose-500/40 px-1 rounded text-white">Switch</span>}
              </button>
            )}
          </div>
        </div>

        {/* Right Controls: Unified Single-Line Toolbar Pill */}
        <div className="flex items-center bg-[#141220]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl shrink-0">
          {/* Partner Speaking Indicator */}
          {partnerIsSpeaking && (
            <>
              <div className="inline-flex items-center gap-1.5 px-2 py-1 text-white text-xs font-semibold animate-pulse">
                <Volume2 className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span className="truncate max-w-[75px] sm:max-w-[120px]">
                  {partnerName || 'Partner'}
                </span>
              </div>
              <div className="w-px h-3.5 bg-white/10 mx-0.5" />
            </>
          )}

          {/* Quick Voice Mute / Unmute */}
          {room?.settings.voiceChat && (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isMuted
                    ? 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                    : 'text-rose-400 hover:text-rose-300 bg-rose-500/10'
                }`}
                title={isMuted ? t('voice.unmute') : t('voice.mute')}
                aria-label={isMuted ? t('voice.unmute') : t('voice.mute')}
              >
                {isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                )}
                <span className="text-[11px] hidden sm:inline">
                  {isMuted ? t('voice.mute') : isSpeakingLocally ? t('voice.speaking') : t('voice.title')}
                </span>
              </button>
              <div className="w-px h-3.5 bg-white/10 mx-0.5" />
            </>
          )}

          {/* Connection Status & Online Count */}
          <div 
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 font-medium"
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
                  ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
            <span className="font-mono text-[11px] font-bold">{participantCount}</span>
          </div>

          <div className="w-px h-3.5 bg-white/10 mx-0.5" />

          {/* Invite Button */}
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="p-1.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer font-medium"
            title={t('room.invite')}
          >
            <Share2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[11px] font-semibold hidden sm:inline">{t('room.invite')}</span>
          </button>

          <div className="w-px h-3.5 bg-white/10 mx-0.5" />

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={t('room.settings')}
            aria-label={t('room.settings')}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-white/10 mx-0.5" />

          {/* Leave Button */}
          <button
            type="button"
            onClick={handleLeaveConfirm}
            className="p-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors cursor-pointer"
            title={t('room.leave')}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Watch Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4">
        {/* Left Column: Video Viewport & Floating Reactions */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          {/* Dedicated Stable Video Viewport maintaining 16:9 movie view */}
          <div className="relative w-full aspect-video max-h-[50vh] sm:max-h-[60vh] flex items-center justify-center shrink-0 mx-auto">
            {/* Ambient Ambilight Glow behind theater screen */}
            <div className="absolute -inset-3 bg-gradient-to-r from-rose-600/20 via-purple-600/15 to-pink-600/20 rounded-3xl blur-2xl -z-10 pointer-events-none" />
            <ReactionOverlay reactions={reactions} />

            {isScreeningMode ? (
              <ScreeningPlayer
                videoRef={videoRef}
                isHost={isHost}
                canControl={canControl}
                remoteStream={remoteScreeningStream}
                onStartScreeningStream={(stream) => setScreeningStream(stream)}
                onStopScreeningStream={() => setScreeningStream(null)}
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
            ) : (
              <DualViewingPlayer
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
            )}
          </div>

          {/* Mobile Bottom Area: Direct Chat fills remaining height cleanly */}
          <div className="lg:hidden flex-1 min-h-0 mt-2 overflow-hidden flex flex-col">
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
