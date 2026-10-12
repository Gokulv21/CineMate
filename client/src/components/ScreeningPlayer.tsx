import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  PictureInPicture, 
  Upload, 
  RotateCcw, 
  Tv, 
  Radio, 
  MessageSquare, 
  Send, 
  X, 
  Mic, 
  MicOff, 
  Scaling, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import type { VideoMetadata, ChatMessage, FloatingReaction, ServerMessage } from '../types/index.js';
import { wsService } from '../services/websocket.js';
import { formatTime } from '../lib/utils.js';
import { ReactionOverlay } from './ReactionOverlay.js';

export interface ScreeningPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isHost?: boolean;
  canControl: boolean;
  remoteStream?: MediaStream | null;
  onStartScreeningStream?: (stream: MediaStream) => void;
  onStopScreeningStream?: () => void;
  partnerMetadata?: VideoMetadata;
  onVideoSelected: (metadata: { fileName: string; duration: number; size?: number }) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (position: number) => void;
  onReplay?: () => void;
  videoEventHandlers?: {
    onPlay: () => void;
    onPause: () => void;
    onSeeking: () => void;
    onSeeked: () => void;
  };
  onSendReaction?: (emoji: string) => void;
  reactionsEnabled?: boolean;
  reactions?: FloatingReaction[];
  messages?: ChatMessage[];
  currentParticipantId?: string;
  onSendMessage?: (text: string) => void;
  voiceEnabled?: boolean;
  isVoiceMuted?: boolean;
  onToggleVoiceMute?: () => void;
  isSpeakingLocally?: boolean;
  partnerIsSpeaking?: boolean;
  partnerName?: string;
}

export const ScreeningPlayer: React.FC<ScreeningPlayerProps> = ({
  videoRef,
  isHost = false,
  canControl: _canControl,
  remoteStream = null,
  onStartScreeningStream,
  onStopScreeningStream,
  partnerMetadata,
  onVideoSelected,
  onPlay,
  onPause,
  onSeek,
  onReplay,
  videoEventHandlers,
  onSendReaction,
  reactionsEnabled = true,
  reactions = [],
  messages = [],
  currentParticipantId = '',
  onSendMessage,
  voiceEnabled = true,
  isVoiceMuted = true,
  onToggleVoiceMute,
  isSpeakingLocally = false,
  partnerIsSpeaking: _partnerIsSpeaking = false,
  partnerName = 'Partner'
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedFileRef = useRef<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const capturedStreamRef = useRef<MediaStream | null>(null);

  // Player state
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [viewerMuted, setViewerMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showAutoplayPrompt, setShowAutoplayPrompt] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInputText, setChatInputText] = useState<string>('');
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide controls timer
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
  }, [isPlaying]);

  // Viewer receives remote stream
  useEffect(() => {
    if (!isHost && remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().then(() => {
        setShowAutoplayPrompt(false);
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('[SCREENING VIEWER] Autoplay gesture required:', err);
        setShowAutoplayPrompt(true);
      });
    }
  }, [isHost, remoteStream, videoRef]);

  // Sync partner metadata
  useEffect(() => {
    if (!isHost && partnerMetadata) {
      if (partnerMetadata.fileName) setFileName(partnerMetadata.fileName);
      if (partnerMetadata.duration) setDuration(partnerMetadata.duration);
    }
  }, [isHost, partnerMetadata]);

  // Viewer receives live position updates without altering live stream currentTime
  useEffect(() => {
    if (isHost) return;
    const unsub = wsService.addMessageListener((msg: ServerMessage) => {
      if (msg.type === 'SYNC_CORRECTION' || msg.type === 'PLAY' || msg.type === 'PAUSE' || msg.type === 'SEEK') {
        setCurrentTime(msg.position);
      }
    });
    return () => unsub();
  }, [isHost]);

  // Broadcast local video element stream (video + audio) to WebRTC
  const broadcastLocalStream = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isHost || isScreenSharing) return;

    try {
      // Reuse active captured stream if already established
      if (capturedStreamRef.current) {
        const tracks = capturedStreamRef.current.getTracks();
        if (tracks.length > 0 && tracks.every(t => t.readyState === 'live')) {
          if (onStartScreeningStream) {
            onStartScreeningStream(capturedStreamRef.current);
          }
          return;
        }
      }

      const stream = (video as any).captureStream
        ? (video as any).captureStream(30)
        : (video as any).mozCaptureStream
        ? (video as any).mozCaptureStream(30)
        : null;

      if (stream) {
        // If captureStream does not have an audio track, route via Web Audio API
        if (stream.getAudioTracks().length === 0) {
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = audioContextRef.current || new AudioCtx();
              audioContextRef.current = ctx;
              if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
              }
              if (!mediaElementSourceRef.current) {
                const source = ctx.createMediaElementSource(video);
                mediaElementSourceRef.current = source;
                const dest = ctx.createMediaStreamDestination();
                audioDestinationRef.current = dest;
                source.connect(dest);
                source.connect(ctx.destination);
              }
              if (audioDestinationRef.current) {
                const audioTrack = audioDestinationRef.current.stream.getAudioTracks()[0];
                if (audioTrack && !stream.getAudioTracks().includes(audioTrack)) {
                  stream.addTrack(audioTrack);
                }
              }
            }
          } catch (e) {
            console.warn('[SCREENING] Audio routing notice:', e);
          }
        }

        capturedStreamRef.current = stream;
        console.log('[SCREENING HOST] Broadcasting local stream tracks:', stream.getTracks().map((t: MediaStreamTrack) => `${t.kind}:${t.readyState}`));
        if (onStartScreeningStream) {
          onStartScreeningStream(stream);
        }
      }
    } catch (err) {
      console.warn('[SCREENING HOST] Stream capture error:', err);
    }
  }, [isHost, isScreenSharing, onStartScreeningStream, videoRef]);

  // Host selects local video file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (capturedStreamRef.current) {
      capturedStreamRef.current.getTracks().forEach(t => t.stop());
      capturedStreamRef.current = null;
    }

    if (videoSrc && videoSrc !== 'screen-share-active') {
      URL.revokeObjectURL(videoSrc);
    }
    if (onStopScreeningStream) {
      onStopScreeningStream();
    }

    setIsScreenSharing(false);
    selectedFileRef.current = file.name;
    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);
    setFileName(file.name);
    setShowControls(true);
  };

  // Host loaded metadata
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration);
    broadcastLocalStream();

    const currentName = selectedFileRef.current || fileName || 'Movie';
    onVideoSelected({
      fileName: currentName,
      duration: video.duration,
      size: 0
    });
  };

  // Host starts Tab / Screen sharing
  const handleStartDisplayMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true
      });
      if (stream) {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setIsScreenSharing(true);
        setVideoSrc('screen-share-active');
        const shareName = 'Live Screen / Tab Broadcast';
        setFileName(shareName);
        selectedFileRef.current = shareName;

        stream.getVideoTracks()[0].onended = () => {
          handleStopScreening();
        };

        if (onStartScreeningStream) {
          onStartScreeningStream(stream);
        }
        onVideoSelected({
          fileName: shareName,
          duration: 7200,
          size: 0
        });
      }
    } catch (err) {
      console.warn('[SCREENING] Screen share cancelled or error:', err);
    }
  };

  // Stop Screening
  const handleStopScreening = () => {
    if (capturedStreamRef.current) {
      capturedStreamRef.current.getTracks().forEach(t => t.stop());
      capturedStreamRef.current = null;
    }
    if (videoSrc && videoSrc !== 'screen-share-active') {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(null);
    setFileName('');
    setIsScreenSharing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
    if (onStopScreeningStream) {
      onStopScreeningStream();
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    if (video.paused) {
      video.play().catch(() => {});
      if (isHost && !isScreenSharing) {
        broadcastLocalStream();
      }
      if (isHost && onPlay) onPlay();
    } else {
      video.pause();
      if (isHost && onPause) onPause();
    }
  };

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    if (isHost && onSeek) {
      onSeek(time);
    }
  };

  // Volume
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  };

  // PiP
  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {}
  };

  // Fit Mode classes
  const getFitClass = () => {
    if (fitMode === 'cover') return 'object-cover w-full h-full';
    if (fitMode === 'fill') return 'object-fill w-full h-full';
    return 'object-contain w-full h-full';
  };

  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !onSendMessage) return;
    onSendMessage(chatInputText.trim());
    setChatInputText('');
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
      className="relative w-full h-full bg-black rounded-3xl overflow-hidden select-none border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)] flex items-center justify-center group"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Ambience Glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 via-pink-600/15 to-violet-600/20 rounded-3xl blur-3xl -z-10 pointer-events-none" />

      {/* Floating Reactions */}
      {reactionsEnabled && <ReactionOverlay reactions={reactions} />}

      {/* Permanent Video Element in DOM so ref and srcObject are never detached */}
      <video
        ref={videoRef}
        src={isHost ? (!isScreenSharing ? (videoSrc || undefined) : undefined) : undefined}
        playsInline
        autoPlay={!isHost}
        muted={!isHost ? viewerMuted : isMuted}
        preload="metadata"
        className={`${getFitClass()} cursor-pointer transition-all duration-300 ${
          (isHost && !videoSrc) || (!isHost && !remoteStream) ? 'hidden' : 'block'
        }`}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={() => {
          if (isHost && videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
          if (videoEventHandlers?.onPlay) videoEventHandlers.onPlay();
        }}
        onPause={() => {
          setIsPlaying(false);
          if (videoEventHandlers?.onPause) videoEventHandlers.onPause();
        }}
        onEnded={() => {
          setIsPlaying(false);
        }}
      />

      {/* STATE 1: HOST SETUP (No movie selected yet) */}
      {isHost && !videoSrc && (
        <div className="flex flex-col items-center justify-center p-6 text-center max-w-lg animate-in fade-in zoom-in-95 duration-200 z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/25 via-pink-500/15 to-violet-500/25 border border-purple-500/40 flex items-center justify-center mb-4 text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.4)] animate-pulse">
            <Radio className="w-8 h-8" />
          </div>

          <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 mb-3 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            SCREENING BROADCAST STUDIO (1-WAY LIVE STREAM)
          </span>

          <h3 className="text-xl font-black text-white tracking-tight">
            Broadcast a Movie to {partnerName || 'Your Partner'}
          </h3>
          <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
            In Screening Mode, you stream the movie live over WebRTC. {partnerName || 'Your partner'} watches your live broadcast in real time — they do not need to download or select any file!
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={handleStartDisplayMedia}
              className="p-4 rounded-2xl border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 flex flex-col items-center gap-2 text-center transition-all cursor-pointer shadow-lg hover:scale-[1.02] active:scale-95 group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform">
                <Tv className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">Share Tab / Screen</span>
              <span className="text-[10px] text-zinc-400">Stream browser tab or window with native sound (Fastest & 60 FPS)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 rounded-2xl border border-pink-500/40 bg-pink-950/30 hover:bg-pink-900/50 flex flex-col items-center gap-2 text-center transition-all cursor-pointer shadow-lg hover:scale-[1.02] active:scale-95 group"
            >
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-300 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">Choose Movie File</span>
              <span className="text-[10px] text-zinc-400">Select an MP4/MKV video file from your device to broadcast</span>
            </button>
          </div>

          <div className="mt-5 pt-3 border-t border-white/[0.08] text-[11px] text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Encrypted WebRTC P2P direct stream • Zero server storage</span>
          </div>
        </div>
      )}

      {/* STATE 2: VIEWER WAITING LOUNGE (Partner waiting for Host to stream) */}
      {!isHost && !remoteStream && (
        <div className="flex flex-col items-center justify-center p-6 text-center max-w-md animate-in fade-in duration-200 z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/40 flex items-center justify-center mb-4 text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.35)] animate-pulse">
            <Tv className="w-8 h-8" />
          </div>

          <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 mb-3 shadow-[0_0_12px_rgba(168,85,247,0.2)]">
            LIVE SCREENING RECEIVER
          </span>

          <h3 className="text-xl font-bold text-white tracking-tight">
            {partnerMetadata?.fileName 
              ? `${partnerName || 'Host'} is preparing "${partnerMetadata.fileName}"`
              : `Waiting for ${partnerName || 'Host'} to broadcast...`}
          </h3>

          <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
            {partnerMetadata?.fileName
              ? 'Connecting to live broadcast stream... Video will start automatically when host plays!'
              : `${partnerName || 'Host'} is selecting the movie to screen. Relax — you do NOT need to download or select any file!`}
          </p>

          <div className="mt-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-[11px] text-purple-300">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span>Live Stream Receiver Ready • 0 MB Download Needed</span>
          </div>
        </div>
      )}

      {/* STATE 3: ACTIVE SCREENING PLAYBACK (Host streaming or Viewer watching) */}
      {Boolean((isHost && videoSrc) || (!isHost && remoteStream)) && (
        <>
          {/* Autoplay unlock prompt for Viewer */}
          {!isHost && showAutoplayPrompt && (
            <div
              onClick={() => {
                setViewerMuted(false);
                if (videoRef.current) {
                  videoRef.current.muted = false;
                  videoRef.current.play().then(() => setShowAutoplayPrompt(false)).catch(() => {});
                }
              }}
              className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-3.5 cursor-pointer p-4 text-center select-none"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-rose-600 text-white flex items-center justify-center shadow-[0_0_35px_rgba(168,85,247,0.7)] animate-pulse border border-purple-400/40">
                <Play className="w-8 h-8 fill-white ml-1" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">Tap to Watch Live Stream</span>
              <span className="text-xs text-zinc-300 max-w-xs leading-relaxed">
                {partnerName || 'Host'} is broadcasting {fileName ? `"${fileName}"` : 'the movie'}. Tap anywhere to start video and sound!
              </span>
            </div>
          )}

          {/* Quick Unmute Audio Pill for Viewer on Mobile / Chrome */}
          {!isHost && viewerMuted && !showAutoplayPrompt && (
            <button
              type="button"
              onClick={() => {
                setViewerMuted(false);
                if (videoRef.current) {
                  videoRef.current.muted = false;
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-[0_0_25px_rgba(244,63,94,0.7)] flex items-center gap-2 cursor-pointer animate-bounce border border-rose-400/40"
            >
              <VolumeX className="w-4 h-4 text-white" />
              <span>Tap to Unmute Live Movie Sound</span>
            </button>
          )}


          {/* Top Live Screening Status Pill */}
          <div className={`absolute top-3 left-3 z-30 transition-opacity duration-300 flex items-center gap-2 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-purple-500/40 shadow-lg text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-purple-300">
                {isHost ? `BROADCASTING TO ${partnerName ? partnerName.toUpperCase() : 'PARTNER'}` : `LIVE FROM ${partnerName ? partnerName.toUpperCase() : 'HOST'}`}
              </span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-xs font-semibold truncate max-w-[150px] sm:max-w-xs">
                {fileName || 'Movie Stream'}
              </span>
            </div>

            {isHost && (
              <button
                type="button"
                onClick={handleStopScreening}
                className="px-2.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Stop current broadcast and switch movie"
              >
                <RefreshCw className="w-3 h-3 text-purple-400" />
                <span className="hidden sm:inline">Switch</span>
              </button>
            )}
          </div>

          {/* Quick Voice Mic Button in top right */}
          {voiceEnabled && onToggleVoiceMute && (
            <div className={`absolute top-3 right-3 z-30 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
              <button
                type="button"
                onClick={onToggleVoiceMute}
                className={`p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg flex items-center gap-1.5 ${
                  isVoiceMuted
                    ? 'bg-black/75 border-white/10 text-zinc-400 hover:text-white'
                    : 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                }`}
                title={isVoiceMuted ? t('voice.unmute') : t('voice.mute')}
              >
                {isVoiceMuted ? (
                  <MicOff className="w-4 h-4 text-zinc-400" />
                ) : (
                  <Mic className="w-4 h-4 text-rose-400 animate-pulse" />
                )}
                <span className="text-[11px] font-bold hidden sm:inline pr-1">
                  {isVoiceMuted ? 'Muted' : isSpeakingLocally ? 'Speaking' : 'Voice On'}
                </span>
              </button>
            </div>
          )}

          {/* Center Play / Pause Big Button on click (Host only) */}
          {isHost && (
            <div 
              onClick={togglePlay}
              className={`absolute inset-0 flex items-center justify-center cursor-pointer transition-opacity duration-300 ${
                showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-rose-600 text-white flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:scale-105 active:scale-95 transition-all">
                {isPlaying ? <Pause className="w-7 h-7 fill-white" /> : <Play className="w-7 h-7 fill-white ml-0.5" />}
              </div>
            </div>
          )}

          {/* Bottom Controls Bar */}
          <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3 sm:p-4 z-30 transition-opacity duration-300 flex flex-col gap-2 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}>
            {/* Scrubber (Host can scrub timeline, Viewer sees progress) */}
            {duration > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-zinc-300">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={isHost ? handleSeek : undefined}
                  disabled={!isHost}
                  className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:cursor-default"
                />
                <span className="text-[11px] font-mono text-zinc-400">
                  {formatTime(duration)}
                </span>
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Host Play/Pause toggle */}
                {isHost && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>
                )}

                {/* Replay */}
                {isHost && onReplay && (
                  <button
                    type="button"
                    onClick={onReplay}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Replay"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {/* Volume slider */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleVolumeChange(isMuted ? 1.0 : 0)}
                    className="p-2 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 sm:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>

              {/* Right Side Options */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Aspect Ratio Fit */}
                <button
                  type="button"
                  onClick={() => {
                    const modes: ('contain' | 'cover' | 'fill')[] = ['contain', 'cover', 'fill'];
                    const next = modes[(modes.indexOf(fitMode) + 1) % modes.length];
                    setFitMode(next);
                  }}
                  className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title={`Fit Mode: ${fitMode}`}
                >
                  <Scaling className="w-3.5 h-3.5 text-purple-400" />
                  <span className="capitalize hidden sm:inline">{fitMode}</span>
                </button>

                {/* Reactions Picker */}
                {reactionsEnabled && onSendReaction && (
                  <div className="flex items-center gap-1 px-1 bg-white/5 rounded-xl border border-white/10">
                    {['❤️', '😂', '🔥', '🍿'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onSendReaction(emoji)}
                        className="p-1 hover:scale-125 transition-transform text-sm cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Chat Drawer Toggle */}
                {onSendMessage && (
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer relative ${
                      isChatOpen
                        ? 'bg-purple-500/25 border-purple-500/50 text-purple-300'
                        : 'bg-white/10 border-white/10 text-zinc-300 hover:text-white'
                    }`}
                    title="Toggle Chat"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                )}

                {/* PiP */}
                <button
                  type="button"
                  onClick={togglePip}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture className="w-4 h-4" />
                </button>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mini In-Video Chat Drawer */}
          {isChatOpen && onSendMessage && (
            <div className="absolute right-3 bottom-20 top-16 w-72 sm:w-80 bg-[#0e0d16]/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-3 shadow-2xl flex flex-col z-40 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                  Theater Chat
                </span>
                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white cursor-pointer rounded-lg hover:bg-white/10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 text-xs">
                {messages.length === 0 ? (
                  <p className="text-zinc-500 text-center py-6 text-[11px]">No messages yet</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-2 rounded-xl ${
                        m.senderId === currentParticipantId
                          ? 'bg-purple-600/30 border border-purple-500/30 ml-4 text-right text-purple-100'
                          : m.senderId === 'SYSTEM'
                          ? 'bg-white/5 text-zinc-400 text-center text-[11px]'
                          : 'bg-white/10 border border-white/10 mr-4 text-left text-zinc-200'
                      }`}
                    >
                      {m.senderId !== 'SYSTEM' && (
                        <p className="text-[10px] text-zinc-400 font-bold mb-0.5">
                          {m.senderName}
                        </p>
                      )}
                      <p>{m.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessageSubmit} className="pt-2 border-t border-white/10 flex gap-1.5">
                <input
                  type="text"
                  value={chatInputText}
                  onChange={(e) => setChatInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};
