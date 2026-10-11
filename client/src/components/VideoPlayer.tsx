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
  Film, 
  AlertTriangle, 
  RotateCcw, 
  RotateCw, 
  Lock, 
  Scaling, 
  Heart, 
  Check, 
  ArrowLeft,
  Captions,
  Languages,
  Plus,
  MessageSquare,
  Send,
  X,
  Sun,
  Headphones,
  Mic,
  MicOff
} from 'lucide-react';
import type { VideoMetadata, ChatMessage, FloatingReaction } from '../types/index.js';
import { formatTime } from '../lib/utils.js';
import { ReactionOverlay } from './ReactionOverlay.js';

export type VideoFitMode = 'contain' | 'cover' | 'fill' | '16-9' | '21-9' | '4-3';

export interface SubtitleCue {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  src: string;
  lang: string;
  cues: SubtitleCue[];
}

function parseSubtitleTimestamp(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(cleaned) || 0;
}

function parseSrtOrVtt(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = content.replace(/\r\n|\r/g, '\n');
  const lines = normalized.split('\n');

  let i = 0;
  let cueId = 1;
  while (i < lines.length) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('WEBVTT') || rawLine.startsWith('NOTE') || rawLine.startsWith('STYLE')) {
      i++;
      continue;
    }

    let timeLine = rawLine;
    if (!timeLine.includes('-->') && i + 1 < lines.length && lines[i + 1].includes('-->')) {
      i++;
      timeLine = lines[i].trim();
    }

    if (timeLine.includes('-->')) {
      const parts = timeLine.split('-->');
      const startStr = parts[0]?.trim().split(/\s+/)[0] || '';
      const endStr = parts[1]?.trim().split(/\s+/)[0] || '';
      const start = parseSubtitleTimestamp(startStr);
      const end = parseSubtitleTimestamp(endStr);

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        const clean = lines[i].replace(/<[^>]+>/g, '').trim();
        if (clean) textLines.push(clean);
        i++;
      }

      if (textLines.length > 0 && !isNaN(start) && !isNaN(end) && end > start) {
        cues.push({
          id: cueId++,
          start,
          end,
          text: textLines.join('\n')
        });
      }
    } else {
      i++;
    }
  }
  return cues;
}

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isHost?: boolean;
  canControl: boolean;
  partnerMetadata?: VideoMetadata;
  onVideoSelected: (metadata: { fileName: string; duration: number; size?: number }) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (position: number) => void;
  onReplay: () => void;
  onVideoEnded?: () => void;
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
  videoEventHandlers: {
    onPlay: () => void;
    onPause: () => void;
    onSeeking: () => void;
    onSeeked: () => void;
  };
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  canControl,
  partnerMetadata,
  onVideoSelected,
  onPlay,
  onPause,
  onSeek,
  onReplay,
  onVideoEnded,
  onSendReaction,
  reactionsEnabled = true,
  reactions = [],
  messages = [],
  currentParticipantId = '',
  onSendMessage,
  voiceEnabled = true,
  isVoiceMuted = false,
  onToggleVoiceMute,
  isSpeakingLocally = false,
  partnerIsSpeaking = false,
  partnerName = '',
  videoEventHandlers
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [dismissMismatch, setDismissMismatch] = useState<boolean>(false);

  // Aspect ratio & Fit mode
  const [fitMode, setFitMode] = useState<VideoFitMode>('contain');
  const [showFitMenu, setShowFitMenu] = useState<boolean>(false);

  // Scrubber hover preview
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  // Double-tap skip indicator ('left' | 'right' | null)
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'left' | 'right' | null>(null);

  // Press-and-hold for 2x speed state
  const [isPressAndHold2x, setIsPressAndHold2x] = useState<boolean>(false);
  // Rotated Landscape state (automatic on mobile when entering fullscreen)
  const [isRotatedLandscape, setIsRotatedLandscape] = useState<boolean>(false);

  // VLC-Style Screen Lock state
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(false);
  const [showUnlockOverlay, setShowUnlockOverlay] = useState<boolean>(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // VLC / MX Player Screen Brightness (1.0 = 100%, 0.3 - 1.6)
  const [brightness, setBrightness] = useState<number>(1.0);

  // MX Player Style Gesture Feedback HUD pill
  const [gestureFeedback, setGestureFeedback] = useState<{
    type: 'seek' | 'volume' | 'brightness' | 'back' | null;
    valueText: string;
    subText?: string;
    percent?: number;
  }>({ type: null, valueText: '' });
  const gestureFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // In-Player Live Chat Drawer & Floating Message Toasts
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [inPlayerMessageText, setInPlayerMessageText] = useState<string>('');
  const [floatingMessages, setFloatingMessages] = useState<{ id: string; senderName: string; message: string; timestamp: number }[]>([]);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const chatDrawerEndRef = useRef<HTMLDivElement>(null);
  const [showQuickReactions, setShowQuickReactions] = useState<boolean>(false);

  // Loading, Buffering & Error states for large movie files
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [videoErrorMessage, setVideoErrorMessage] = useState<string | null>(null);

  // Subtitles / Captions (CC)
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [activeSubtitleText, setActiveSubtitleText] = useState<string>('');
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  // Audio Tracks / Languages
  const [audioTracks, setAudioTracks] = useState<{ id: string; label: string; language: string }[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('default');
  const externalAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const [externalAudioTracks, setExternalAudioTracks] = useState<{ id: string; label: string; src: string }[]>([]);
  const [activeExternalAudioId, setActiveExternalAudioId] = useState<string | null>(null);

  // Unified Tracks Popover (Subtitles + Audio in 1 clean dialog)
  const [showTracksMenu, setShowTracksMenu] = useState<boolean>(false);
  const [tracksMenuTab, setTracksMenuTab] = useState<'subtitles' | 'audio'>('subtitles');

  // MKV unsupported warning dismissal
  const [dismissMkvNotice, setDismissMkvNotice] = useState<boolean>(false);

  // References for gesture timing
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleTapFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const wasLongPressRef = useRef<boolean>(false);
  const isPressAndHold2xRef = useRef<boolean>(false);
  isPressAndHold2xRef.current = isPressAndHold2x;
  const controlsOpenAtTouchRef = useRef<boolean>(false);
  const isNativeFullscreenRef = useRef<boolean>(false);

  // Auto-hide timer for controls (VLC / MX Player style: auto-hide after 4.5s of inactivity when playing)
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowFitMenu(false);
        setShowTracksMenu(false);
      }, 4500);
    }
  }, [isPlaying]);

  // Check duration mismatch (> 3 seconds difference)
  const isDurationMismatched = 
    !dismissMismatch &&
    duration > 0 &&
    partnerMetadata &&
    partnerMetadata.duration > 0 &&
    Math.abs(duration - partnerMetadata.duration) > 3.0;

  // Handle local video file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }

    setVideoErrorMessage(null);
    setIsLoadingVideo(true);
    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);
    setFileName(file.name);
    setIsEnded(false);
    setShowControls(true);
  };

  const handleLoadStart = () => {
    setIsLoadingVideo(true);
    setVideoErrorMessage(null);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration);
    setIsLoadingVideo(false);

    // Scan for native audio tracks if supported by browser
    try {
      const nativeAudio = (video as any).audioTracks;
      if (nativeAudio) {
        const populateAudioTracks = () => {
          const found: { id: string; label: string; language: string }[] = [];
          for (let i = 0; i < nativeAudio.length; i++) {
            const track = nativeAudio[i];
            found.push({
              id: track.id || `audio-${i}`,
              label: track.label || track.language || `Audio Track ${i + 1}`,
              language: track.language || 'und'
            });
          }
          if (found.length > 0) {
            setAudioTracks(found);
          }
        };
        populateAudioTracks();
        nativeAudio.onaddtrack = populateAudioTracks;
        nativeAudio.onremovetrack = populateAudioTracks;
        nativeAudio.onchange = populateAudioTracks;
      }
    } catch {}

    onVideoSelected({
      fileName,
      duration: video.duration,
      size: 0
    });
  };

  // Upload and attach external subtitle file (.srt or .vtt)
  const handleSubtitleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const cues = parseSrtOrVtt(text);

      let vttContent = text;
      // Convert SRT to WebVTT
      if (!text.trim().startsWith('WEBVTT')) {
        vttContent = 'WEBVTT\n\n' + text
          .replace(/\r\n|\r/g, '\n')
          .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      }

      const blob = new Blob([vttContent], { type: 'text/vtt' });
      const subUrl = URL.createObjectURL(blob);
      const newSub: SubtitleTrack = {
        id: `sub-${Date.now()}`,
        label: file.name.replace(/\.(srt|vtt)$/i, ''),
        src: subUrl,
        lang: 'en',
        cues
      };

      setSubtitles(prev => [...prev, newSub]);
      setSelectedSubtitle(newSub.id);
      setShowTracksMenu(false);
      resetControlsTimeout();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Synchronize active subtitle track with HTML5 textTracks
  useEffect(() => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const match = subtitles.find(s => s.id === selectedSubtitle);
      if (match && t.label === match.label) {
        t.mode = 'showing';
      } else {
        t.mode = 'disabled';
      }
    }
  }, [selectedSubtitle, subtitles]);

  // Audio track switch handler
  const handleSelectAudioTrack = (trackId: string) => {
    setSelectedAudioTrack(trackId);
    setShowTracksMenu(false);
    resetControlsTimeout();

    if (trackId === 'default') {
      setActiveExternalAudioId(null);
      if (externalAudioRef.current) {
        externalAudioRef.current.pause();
      }
      if (videoRef.current) {
        videoRef.current.muted = isMuted;
      }
    } else {
      const extMatch = externalAudioTracks.find(t => t.id === trackId);
      if (extMatch) {
        setActiveExternalAudioId(extMatch.id);
        if (videoRef.current) {
          videoRef.current.muted = true;
        }
        if (externalAudioRef.current) {
          externalAudioRef.current.src = extMatch.src;
          externalAudioRef.current.currentTime = videoRef.current?.currentTime || 0;
          externalAudioRef.current.volume = volume;
          externalAudioRef.current.muted = isMuted;
          externalAudioRef.current.playbackRate = videoRef.current?.playbackRate || playbackRate;
          if (isPlaying) {
            externalAudioRef.current.play().catch(() => {});
          }
        }
      } else {
        setActiveExternalAudioId(null);
        if (externalAudioRef.current) {
          externalAudioRef.current.pause();
        }
        if (videoRef.current) {
          videoRef.current.muted = isMuted;
          try {
            const nativeAudio = (videoRef.current as any).audioTracks;
            if (nativeAudio) {
              for (let i = 0; i < nativeAudio.length; i++) {
                nativeAudio[i].enabled = (nativeAudio[i].id === trackId);
              }
            }
          } catch {}
        }
      }
    }
  };

  // Upload external audio track (e.g. Tamil language track for a Hindi/Dual-audio movie)
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const audioUrl = URL.createObjectURL(file);
    const newTrack = {
      id: `audio-ext-${Date.now()}`,
      label: file.name.replace(/\.(mp3|m4a|aac|wav|ogg)$/i, ''),
      src: audioUrl
    };

    setExternalAudioTracks(prev => [...prev, newTrack]);
    setActiveExternalAudioId(newTrack.id);
    setSelectedAudioTrack(newTrack.id);

    // Mute video's internal audio so only the selected external audio plays
    if (videoRef.current) {
      videoRef.current.muted = true;
    }

    if (externalAudioRef.current) {
      externalAudioRef.current.src = newTrack.src;
      externalAudioRef.current.currentTime = videoRef.current?.currentTime || 0;
      externalAudioRef.current.volume = volume;
      externalAudioRef.current.muted = isMuted;
      externalAudioRef.current.playbackRate = videoRef.current?.playbackRate || playbackRate;
      if (isPlaying) {
        externalAudioRef.current.play().catch(() => {});
      }
    }

    setShowTracksMenu(false);
    resetControlsTimeout();
    e.target.value = '';
  };

  const handleLoadedData = () => {
    setIsLoadingVideo(false);
    setIsBuffering(false);
  };

  const handleCanPlay = () => {
    setIsLoadingVideo(false);
    setIsBuffering(false);
  };

  const handleWaiting = () => {
    if (isPlaying) {
      setIsBuffering(true);
    }
  };

  const handlePlaying = () => {
    setIsLoadingVideo(false);
    setIsBuffering(false);
    setIsPlaying(true);
  };

  const handleVideoError = () => {
    setIsLoadingVideo(false);
    setIsBuffering(false);
    const err = videoRef.current?.error;
    let msg = 'Failed to load video.';
    if (err?.code === 4) {
      msg = 'This video format or audio codec (e.g. MKV, HEVC / H.265, AC3 audio) is not supported natively by your browser. Please use an MP4 (H.264 / AAC) file.';
    } else if (err?.code === 3) {
      msg = 'Video playback error (decode error). The file may be corrupt or encoded in an unsupported format.';
    } else {
      msg = 'Error reading video stream. For large movies, please ensure it is a standard MP4 file.';
    }
    setVideoErrorMessage(msg);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      const time = video.currentTime;
      setCurrentTime(time);

      // On-screen subtitle cue sync
      if (selectedSubtitle) {
        const track = subtitles.find(s => s.id === selectedSubtitle);
        if (track && track.cues.length > 0) {
          const match = track.cues.find(c => time >= c.start && time <= c.end);
          setActiveSubtitleText(match ? match.text : '');
        } else {
          setActiveSubtitleText('');
        }
      } else {
        setActiveSubtitleText('');
      }

      // Sync external audio drift if > 0.35s
      if (activeExternalAudioId && externalAudioRef.current) {
        if (Math.abs(externalAudioRef.current.currentTime - time) > 0.35) {
          externalAudioRef.current.currentTime = time;
        }
      }
    }
  };

  const handleEnded = () => {
    setIsEnded(true);
    setIsPlaying(false);
    setIsScreenLocked(false);
    setShowUnlockOverlay(false);
    if (externalAudioRef.current) {
      externalAudioRef.current.pause();
      externalAudioRef.current.currentTime = 0;
    }
    setShowControls(true);
    if (onVideoEnded) onVideoEnded();
  };

  const handleInternalPlay = () => {
    setIsPlaying(true);
    setIsEnded(false);
    if (activeExternalAudioId && externalAudioRef.current) {
      if (videoRef.current) {
        externalAudioRef.current.currentTime = videoRef.current.currentTime;
      }
      externalAudioRef.current.play().catch(() => {});
    }
    videoEventHandlers.onPlay();
  };

  const handleInternalPause = () => {
    setIsPlaying(false);
    if (externalAudioRef.current) {
      externalAudioRef.current.pause();
    }
    setShowControls(true);
    videoEventHandlers.onPause();
  };

  const handleInternalSeeking = () => {
    if (externalAudioRef.current && videoRef.current) {
      externalAudioRef.current.currentTime = videoRef.current.currentTime;
    }
    videoEventHandlers.onSeeking();
  };

  const handleInternalSeeked = () => {
    if (externalAudioRef.current && videoRef.current) {
      externalAudioRef.current.currentTime = videoRef.current.currentTime;
    }
    videoEventHandlers.onSeeked();
  };

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current || !canControl || isScreenLocked) return;

    if (videoRef.current.paused) {
      onPlay();
    } else {
      onPause();
    }
  }, [canControl, isScreenLocked, onPlay, onPause, videoRef]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl || isScreenLocked) return;
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (externalAudioRef.current) {
      externalAudioRef.current.currentTime = target;
    }
    onSeek(target);
    resetControlsTimeout();
  };

  const handleMouseMoveScrubber = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isScreenLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHoverTime(percent * duration);
    setHoverX(e.clientX - rect.left);
  };

  const handleMouseLeaveScrubber = () => {
    setHoverTime(null);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (activeExternalAudioId && externalAudioRef.current) {
      externalAudioRef.current.volume = newVol;
      externalAudioRef.current.muted = newVol === 0;
    } else if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
    setIsMuted(newVol === 0);
    resetControlsTimeout();
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (activeExternalAudioId && externalAudioRef.current) {
      externalAudioRef.current.muted = nextMuted;
    } else if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    resetControlsTimeout();
  };

  // Auto-route audio to newly connected Bluetooth earpods or headphones mid-playback
  useEffect(() => {
    const handleDeviceChange = async () => {
      console.log('[VideoPlayer] Audio device change detected: re-routing to active earpods/output device');
      try {
        if (videoRef.current && 'setSinkId' in videoRef.current) {
          await (videoRef.current as any).setSinkId('');
        }
        if (externalAudioRef.current && 'setSinkId' in externalAudioRef.current) {
          await (externalAudioRef.current as any).setSinkId('');
        }
      } catch (err) {
        console.warn('[VideoPlayer] Error updating sinkId on device change:', err);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [videoRef]);

  // Floating messages for landscape/fullscreen view:
  // Whenever new messages arrive from partner, show cute floating toast on top-right of player
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // First mount: mark all existing messages as seen
    if (seenMessageIdsRef.current.size === 0) {
      messages.forEach(m => seenMessageIdsRef.current.add(m.id));
      return;
    }

    const newMsgs = messages.filter(m => !seenMessageIdsRef.current.has(m.id) && m.type !== 'SYSTEM');
    if (newMsgs.length === 0) return;

    newMsgs.forEach(m => {
      seenMessageIdsRef.current.add(m.id);
      const toast = {
        id: m.id,
        senderName: m.senderName,
        message: m.message,
        timestamp: m.timestamp
      };
      setFloatingMessages(prev => [...prev.slice(-2), toast]);

      // Auto dismiss after 4.5s
      setTimeout(() => {
        setFloatingMessages(prev => prev.filter(t => t.id !== toast.id));
      }, 4500);
    });
  }, [messages]);

  // Auto-scroll chat drawer when new messages arrive
  useEffect(() => {
    if (isChatOpen) {
      chatDrawerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  // Unified Fullscreen toggle:
  // On Mobile: Automatically enters fullscreen & locks/rotates into Landscape mode
  // On Laptop/Desktop: Standard fullscreen without rotating
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!isFullscreen && !isRotatedLandscape) {
      const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
        (window.matchMedia && window.matchMedia('(max-width: 1024px) and (hover: none)').matches) ||
        (window.innerHeight > window.innerWidth);

      const el = containerRef.current;
      if (el.requestFullscreen) {
        try {
          await el.requestFullscreen();
          isNativeFullscreenRef.current = true;
        } catch (err) {
          console.warn('Native requestFullscreen failed:', err);
        }
      } else if ((el as any).webkitRequestFullscreen) {
        try {
          await (el as any).webkitRequestFullscreen();
          isNativeFullscreenRef.current = true;
        } catch (err) {
          console.warn('webkitRequestFullscreen failed:', err);
        }
      }

      setIsFullscreen(true);

      // On mobile devices, lock screen orientation to landscape
      if (isMobileDevice) {
        let nativeLocked = false;
        try {
          if (screen.orientation && 'lock' in screen.orientation) {
            await (screen.orientation as any).lock('landscape').catch(() => {});
            nativeLocked = true;
          } else if ((screen as any).lockOrientation) {
            nativeLocked = !!(screen as any).lockOrientation('landscape');
          }
        } catch (err) {
          console.warn('Screen orientation lock failed:', err);
        }

        // If native orientation lock wasn't supported/failed or device is still in portrait,
        // rotate into landscape via CSS so mobile user ALWAYS gets full landscape movie!
        if (!nativeLocked || window.innerHeight > window.innerWidth) {
          setIsRotatedLandscape(true);
        }
      }
    } else {
      await handleExitFullscreen();
    }
    resetControlsTimeout();
  };

  // Exit Fullscreen via Back button or action
  const handleExitFullscreen = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    } else if ((document as any).webkitFullscreenElement) {
      try {
        await (document as any).webkitExitFullscreen();
      } catch {}
    }
    isNativeFullscreenRef.current = false;
    setIsFullscreen(false);
    setIsRotatedLandscape(false);
    if (screen.orientation && 'unlock' in screen.orientation) {
      try { (screen.orientation as any).unlock(); } catch {}
    }
    setShowControls(true);
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
    resetControlsTimeout();
  };

  const handleSpeedChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    if (externalAudioRef.current) {
      externalAudioRef.current.playbackRate = rate;
    }
    setPlaybackRate(rate);
    resetControlsTimeout();
  };

  // Skip helper (+10s or -10s) with animated visual feedback
  const triggerSkip = (direction: 'left' | 'right') => {
    if (!canControl) return;

    if (direction === 'left') {
      const next = Math.max(0, currentTime - 10);
      setCurrentTime(next);
      if (externalAudioRef.current) {
        externalAudioRef.current.currentTime = next;
      }
      onSeek(next);
      setDoubleTapFeedback('left');
    } else {
      const next = Math.min(duration, currentTime + 10);
      setCurrentTime(next);
      if (externalAudioRef.current) {
        externalAudioRef.current.currentTime = next;
      }
      onSeek(next);
      setDoubleTapFeedback('right');
    }

    if (doubleTapFeedbackTimerRef.current) {
      clearTimeout(doubleTapFeedbackTimerRef.current);
    }
    doubleTapFeedbackTimerRef.current = setTimeout(() => {
      setDoubleTapFeedback(null);
    }, 700);

    resetControlsTimeout();
  };

  // =========================================================================
  // VLC / MX PLAYER GESTURES:
  // - Horizontal Swipe: Seek Forward / Backward
  // - Vertical Swipe (Right Half): Volume Up / Down
  // - Vertical Swipe (Left Half): Brightness Up / Down
  // - Left Edge Swipe: Back / Exit Fullscreen
  // - Single Tap: Toggle HUD Controls
  // - Double Tap: Quick Skip 10s
  // - Long Press: 2x Speed
  // Coordinates are mathematically transformed when rotated to landscape!
  // =========================================================================

  const touchTrackingRef = useRef<{
    isTracking: boolean;
    type: 'none' | 'seeking' | 'volume' | 'brightness' | 'backSwipe';
    startX: number;
    startY: number;
    initialTime: number;
    initialVolume: number;
    initialBrightness: number;
    targetTime: number;
    width: number;
    height: number;
    wasLeftEdge: boolean;
  }>({
    isTracking: false,
    type: 'none',
    startX: 0,
    startY: 0,
    initialTime: 0,
    initialVolume: 1,
    initialBrightness: 1,
    targetTime: 0,
    width: 0,
    height: 0,
    wasLeftEdge: false
  });

  const getVisualTouchCoords = (touch: React.Touch | Touch, rect: DOMRect) => {
    if (isRotatedLandscape) {
      // 90deg clockwise CSS rotation:
      // Visual X = distance from container top downwards: touch.clientY - rect.top
      // Visual Y = distance from container right leftwards: rect.right - touch.clientX
      return {
        x: touch.clientY - rect.top,
        y: rect.right - touch.clientX,
        width: rect.height,
        height: rect.width
      };
    } else {
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        width: rect.width,
        height: rect.height
      };
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    if ((e.target as HTMLElement).closest('button, input, select, a, [data-interactive="true"]')) {
      return;
    }
    if (isScreenLocked) {
      setShowUnlockOverlay(true);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = setTimeout(() => {
        setShowUnlockOverlay(false);
        setShowQuickReactions(false);
      }, 2800);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coords = getVisualTouchCoords(e.touches[0], rect);
    pointerStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    wasLongPressRef.current = false;
    controlsOpenAtTouchRef.current = showControls;

    const isLeftEdge = coords.x < Math.min(65, coords.width * 0.12);

    touchTrackingRef.current = {
      isTracking: true,
      type: 'none',
      startX: coords.x,
      startY: coords.y,
      initialTime: currentTime,
      initialVolume: volume,
      initialBrightness: brightness,
      targetTime: currentTime,
      width: coords.width,
      height: coords.height,
      wasLeftEdge: isLeftEdge
    };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (!isLeftEdge) {
      longPressTimerRef.current = setTimeout(() => {
        if (videoRef.current && isPlaying && touchTrackingRef.current.type === 'none') {
          wasLongPressRef.current = true;
          setIsPressAndHold2x(true);
          videoRef.current.playbackRate = 2.0;
          if (externalAudioRef.current) {
            externalAudioRef.current.playbackRate = 2.0;
          }
        }
      }, 380);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isScreenLocked || !touchTrackingRef.current.isTracking || e.touches.length !== 1) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coords = getVisualTouchCoords(e.touches[0], rect);
    const tracking = touchTrackingRef.current;
    const dx = coords.x - tracking.startX;
    const dy = coords.y - tracking.startY;

    // Lock gesture type once movement threshold is crossed
    if (tracking.type === 'none') {
      if (Math.abs(dx) > 16 || Math.abs(dy) > 16) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        if (tracking.wasLeftEdge && dx > 20 && Math.abs(dx) > Math.abs(dy)) {
          tracking.type = 'backSwipe';
        } else if (Math.abs(dx) > Math.abs(dy)) {
          tracking.type = 'seeking';
        } else {
          if (tracking.startX > tracking.width * 0.5) {
            tracking.type = 'volume';
          } else {
            tracking.type = 'brightness';
          }
        }
      }
    }

    if (tracking.type === 'seeking' && canControl) {
      if (e.cancelable) e.preventDefault();
      const seekFactor = Math.min(180, Math.max(60, duration * 0.15));
      const deltaSec = Math.round((dx / (tracking.width * 0.85)) * seekFactor);
      const target = Math.max(0, Math.min(duration, tracking.initialTime + deltaSec));
      tracking.targetTime = target;

      setGestureFeedback({
        type: 'seek',
        valueText: `${deltaSec >= 0 ? '+' : ''}${deltaSec}s`,
        subText: `${formatTime(target)} / ${formatTime(duration)}`,
        percent: (target / (duration || 1)) * 100
      });
    } else if (tracking.type === 'volume') {
      if (e.cancelable) e.preventDefault();
      const deltaVol = -(dy / (tracking.height * 0.7));
      const newVol = Math.max(0, Math.min(1, tracking.initialVolume + deltaVol));
      setVolume(newVol);
      setIsMuted(newVol === 0);
      if (videoRef.current) videoRef.current.volume = newVol;
      if (externalAudioRef.current) externalAudioRef.current.volume = newVol;

      setGestureFeedback({
        type: 'volume',
        valueText: `${Math.round(newVol * 100)}%`,
        percent: newVol * 100
      });
    } else if (tracking.type === 'brightness') {
      if (e.cancelable) e.preventDefault();
      const deltaBright = -(dy / (tracking.height * 0.7));
      const newBright = Math.max(0.3, Math.min(1.6, tracking.initialBrightness + deltaBright));
      setBrightness(newBright);

      setGestureFeedback({
        type: 'brightness',
        valueText: `${Math.round((newBright / 1.0) * 100)}%`,
        percent: Math.round(((newBright - 0.3) / 1.3) * 100)
      });
    } else if (tracking.type === 'backSwipe') {
      if (e.cancelable) e.preventDefault();
      setGestureFeedback({
        type: 'back',
        valueText: dx > 60 ? 'Release to Exit Fullscreen' : 'Swipe to Exit Fullscreen',
        percent: Math.min(100, (dx / 70) * 100)
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isScreenLocked) {
      touchTrackingRef.current.isTracking = false;
      return;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isPressAndHold2xRef.current) {
      setIsPressAndHold2x(false);
      if (videoRef.current) videoRef.current.playbackRate = playbackRate;
      if (externalAudioRef.current) externalAudioRef.current.playbackRate = playbackRate;
      touchTrackingRef.current.isTracking = false;
      return;
    }

    const tracking = touchTrackingRef.current;
    if (tracking.type === 'seeking' && canControl) {
      const target = tracking.targetTime;
      setCurrentTime(target);
      onSeek(target);
      if (externalAudioRef.current) externalAudioRef.current.currentTime = target;
      resetControlsTimeout();
    } else if (tracking.type === 'backSwipe') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const coords = getVisualTouchCoords(e.changedTouches[0], rect);
        const dx = coords.x - tracking.startX;
        if (dx > 55) {
          handleExitFullscreen();
        }
      }
    }

    if (tracking.type !== 'none') {
      if (gestureFeedbackTimerRef.current) clearTimeout(gestureFeedbackTimerRef.current);
      gestureFeedbackTimerRef.current = setTimeout(() => {
        setGestureFeedback({ type: null, valueText: '' });
      }, 550);
      tracking.isTracking = false;
      tracking.type = 'none';
      return;
    }

    // Touch tap / double-tap handling
    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const coords = getVisualTouchCoords(e.changedTouches[0], rect);
      const isRightHalf = coords.x > coords.width / 2;

      if (now - lastTapRef.current.time < 300) {
        if (singleClickTimerRef.current) {
          clearTimeout(singleClickTimerRef.current);
          singleClickTimerRef.current = null;
        }
        triggerSkip(isRightHalf ? 'right' : 'left');
        lastTapRef.current = { time: 0, x: 0, y: 0 };
      } else {
        lastTapRef.current = { time: now, x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);
        const wasOpen = controlsOpenAtTouchRef.current;
        singleClickTimerRef.current = setTimeout(() => {
          if (wasOpen) {
            setShowControls(false);
            setShowFitMenu(false);
            setShowTracksMenu(false);
            setShowQuickReactions(false);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          } else {
            setShowControls(true);
            resetControlsTimeout();
          }
          singleClickTimerRef.current = null;
        }, 260);
      }
    }

    touchTrackingRef.current.isTracking = false;
  };

  // Desktop Mouse pointer handlers (ignores touch events to prevent double processing)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if ((e.target as HTMLElement).closest('button, input, select, a, [data-interactive="true"]')) {
      return;
    }
    if (isScreenLocked) {
      setShowUnlockOverlay(true);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = setTimeout(() => {
        setShowUnlockOverlay(false);
        setShowQuickReactions(false);
      }, 2800);
      return;
    }

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    wasLongPressRef.current = false;
    controlsOpenAtTouchRef.current = showControls;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (videoRef.current && isPlaying) {
        wasLongPressRef.current = true;
        setIsPressAndHold2x(true);
        videoRef.current.playbackRate = 2.0;
        if (externalAudioRef.current) {
          externalAudioRef.current.playbackRate = 2.0;
        }
      }
    }, 380);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || isScreenLocked) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isPressAndHold2xRef.current) {
      setIsPressAndHold2x(false);
      if (videoRef.current) videoRef.current.playbackRate = playbackRate;
      if (externalAudioRef.current) externalAudioRef.current.playbackRate = playbackRate;
      return;
    }

    if (wasLongPressRef.current) return;
    if ((e.target as HTMLElement).closest('button, input, select, a, [data-interactive="true"]')) return;

    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 25 || dy > 25) return;

    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const isRightHalf = (e.clientX - rect.left) > rect.width / 2;

    if (now - lastTapRef.current.time < 300) {
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
        singleClickTimerRef.current = null;
      }
      triggerSkip(isRightHalf ? 'right' : 'left');
      lastTapRef.current = { time: 0, x: 0, y: 0 };
    } else {
      lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);
      const wasOpen = controlsOpenAtTouchRef.current;
      singleClickTimerRef.current = setTimeout(() => {
        if (wasOpen) {
          setShowControls(false);
          setShowFitMenu(false);
          setShowTracksMenu(false);
          setShowQuickReactions(false);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        } else {
          setShowControls(true);
          resetControlsTimeout();
        }
        singleClickTimerRef.current = null;
      }, 260);
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isPressAndHold2xRef.current) {
      setIsPressAndHold2x(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }
      if (externalAudioRef.current) {
        externalAudioRef.current.playbackRate = playbackRate;
      }
    }
  };

  const handlePointerLeave = () => {
    handlePointerCancel();
  };

  // Pointer move inside container resets controls auto-hide timer (mouse hover only)
  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || isScreenLocked) return; // Ignore mobile touch moves or when locked
    if (!showControls) {
      setShowControls(true);
    }
    resetControlsTimeout();
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!isNowFullscreen && isNativeFullscreenRef.current) {
        isNativeFullscreenRef.current = false;
        setIsFullscreen(false);
        setIsRotatedLandscape(false);
        if (screen.orientation && 'unlock' in screen.orientation) {
          try { (screen.orientation as any).unlock(); } catch {}
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Physical orientation & resize listener: turn off CSS rotation if phone turned physically to landscape
  useEffect(() => {
    const handleOrientationOrResize = () => {
      if (window.innerWidth > window.innerHeight && isRotatedLandscape) {
        setIsRotatedLandscape(false);
      }
    };

    window.addEventListener('resize', handleOrientationOrResize);
    window.addEventListener('orientationchange', handleOrientationOrResize);
    return () => {
      window.removeEventListener('resize', handleOrientationOrResize);
      window.removeEventListener('orientationchange', handleOrientationOrResize);
    };
  }, [isRotatedLandscape]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (isScreenLocked) {
        if (e.code === 'Escape' && isFullscreen) {
          handleExitFullscreen();
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
        setShowControls(true);
        resetControlsTimeout();
      } else if (e.code === 'ArrowLeft' && canControl) {
        e.preventDefault();
        triggerSkip('left');
      } else if (e.code === 'ArrowRight' && canControl) {
        e.preventDefault();
        triggerSkip('right');
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'Escape' && isFullscreen) {
        handleExitFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, canControl, isFullscreen, resetControlsTimeout, isScreenLocked]);

  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (doubleTapFeedbackTimerRef.current) clearTimeout(doubleTapFeedbackTimerRef.current);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, [videoSrc]);

  // Video object-fit and aspect ratio classes
  const getVideoClasses = () => {
    switch (fitMode) {
      case 'cover':
        return 'w-full h-full object-cover scale-[1.02] transition-all duration-300';
      case 'fill':
        return 'w-full h-full object-fill transition-all duration-300';
      case '16-9':
        return 'max-w-full max-h-full aspect-video object-cover transition-all duration-300';
      case '21-9':
        return 'max-w-full max-h-full aspect-[21/9] object-cover transition-all duration-300';
      case '4-3':
        return 'max-w-full max-h-full aspect-[4/3] object-contain transition-all duration-300';
      case 'contain':
      default:
        return 'w-full h-full object-contain transition-all duration-300';
    }
  };

  const FIT_OPTIONS: { id: VideoFitMode; label: string; iconLabel: string }[] = [
    { id: 'contain', label: t('video.fitContain', 'Fit (Contain)'), iconLabel: 'Fit' },
    { id: 'cover', label: t('video.fitCover', 'Zoom / Fill (No Bars)'), iconLabel: 'Zoom' },
    { id: 'fill', label: t('video.fitStretch', 'Stretch (100%)'), iconLabel: 'Stretch' },
    { id: '16-9', label: t('video.aspect16_9', '16:9 Widescreen'), iconLabel: '16:9' },
    { id: '21-9', label: t('video.aspect21_9', '21:9 Ultrawide'), iconLabel: '21:9' },
    { id: '4-3', label: t('video.aspect4_3', '4:3 Classic TV'), iconLabel: '4:3' }
  ];

  const currentFitOption = FIT_OPTIONS.find(o => o.id === fitMode) || FIT_OPTIONS[0];

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handleContainerPointerMove}
      className={`bg-black select-none flex items-center justify-center transition-all ${
        isRotatedLandscape
          ? 'fixed z-[9999] rounded-none border-0 overflow-hidden shadow-2xl'
          : isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-0 aspect-auto w-screen h-screen'
          : 'relative w-full aspect-video max-h-full overflow-hidden shadow-2xl rounded-2xl border border-white/10 group'
      }`}
      style={
        isRotatedLandscape
          ? {
              position: 'fixed',
              top: '50%',
              left: '50%',
              width: '100vh',
              height: '100vw',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center center',
              zIndex: 9999,
              maxWidth: '100vh',
              maxHeight: '100vw',
              overflow: 'hidden',
            }
          : undefined
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {!videoSrc ? (
        <div className="flex flex-col items-center justify-center p-8 text-center max-w-md animate-in fade-in zoom-in-95 duration-200">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-dashed border-white/20 hover:border-white/40 flex items-center justify-center mb-4 cursor-pointer group/pick transition-all hover:bg-white/[0.08]"
          >
            <Film className="w-7 h-7 text-zinc-400 group-hover/pick:text-white transition-all" />
          </div>
          
          <h3 className="text-xl font-bold text-white tracking-tight">
            {t('video.chooseMovie')}
          </h3>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            {t('video.localNotice')}
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-6 px-6 py-2.5 rounded-xl font-semibold text-xs text-black bg-white hover:bg-zinc-200 shadow-sm flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{t('video.chooseFileButton')}</span>
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            preload="metadata"
            style={{ filter: brightness !== 1.0 ? `brightness(${brightness})` : undefined }}
            onLoadStart={handleLoadStart}
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={handleLoadedData}
            onCanPlay={handleCanPlay}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onError={handleVideoError}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPlay={handleInternalPlay}
            onPause={handleInternalPause}
            onSeeking={handleInternalSeeking}
            onSeeked={handleInternalSeeked}
            className={`${getVideoClasses()} cursor-pointer transition-all duration-300`}
          >
            {/* Native Subtitle Tracks */}
            {subtitles.map(sub => (
              <track
                key={sub.id}
                kind="subtitles"
                src={sub.src}
                srcLang={sub.lang}
                label={sub.label}
                default={selectedSubtitle === sub.id}
              />
            ))}
          </video>

          {/* Synced External Audio Track Element (e.g. Tamil language audio) */}
          <audio ref={externalAudioRef} preload="auto" className="hidden" />

          {/* Hidden Subtitle File Input */}
          <input
            ref={subtitleInputRef}
            type="file"
            accept=".srt,.vtt"
            onChange={handleSubtitleFileChange}
            className="hidden"
          />

          {/* Hidden Audio Track File Input */}
          <input
            ref={audioFileInputRef}
            type="file"
            accept="audio/*,.m4a,.aac,.mp3,.wav,.ogg"
            onChange={handleAudioFileChange}
            className="hidden"
          />

          {/* ONSCREEN SUBTITLE TEXT OVERLAY (Guaranteed 100% reliable across all browsers & local files) */}
          {activeSubtitleText && (
            <div className="absolute bottom-16 sm:bottom-20 inset-x-4 flex justify-center pointer-events-none z-25 text-center">
              <span className="inline-block px-3.5 py-1.5 rounded-xl bg-black/85 backdrop-blur-xs text-white text-xs sm:text-sm md:text-base font-semibold shadow-2xl border border-white/10 max-w-[88%] whitespace-pre-line tracking-wide drop-shadow-md">
                {activeSubtitleText}
              </span>
            </div>
          )}

          {/* MKV CODEC NOTICE */}
          {fileName.toLowerCase().endsWith('.mkv') && !dismissMkvNotice && (
            <div className="absolute top-16 inset-x-3 sm:inset-x-8 z-40 p-3 sm:p-4 rounded-xl bg-[#111116]/95 border border-white/10 backdrop-blur-md flex items-start justify-between shadow-2xl animate-in slide-in-from-top-3">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Film className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>MKV Format Notice</span>
                    <span className="text-[10px] font-mono text-zinc-300 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">.mkv</span>
                  </p>
                  <p className="text-[11px] sm:text-xs text-zinc-300 leading-relaxed mt-1">
                    Browsers natively play <strong>MP4 (H.264 / AAC)</strong>. 
                    If this movie shows a black screen, it uses HEVC (H.265) video. If it plays in Hindi instead of Tamil, browsers automatically play the 1st audio stream in MKVs.
                  </p>
                  <p className="text-[11px] text-zinc-400 font-medium mt-1.5">
                    💡 Tip: Click the Languages (🌐) button below to load an audio track, or convert the MKV to MP4.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissMkvNotice(true)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-medium transition-colors cursor-pointer shrink-0 ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* LOADING / BUFFERING SPINNER (Large video files) */}
          {(isLoadingVideo || isBuffering) && !videoErrorMessage && (
            <div className="absolute inset-0 z-35 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-none animate-in fade-in duration-200">
              <div className="w-10 h-10 rounded-full border-3 border-white/20 border-t-white animate-spin mb-3 shadow-lg" />
              <span className="text-xs font-semibold text-white tracking-wide font-mono">
                {isLoadingVideo ? 'Loading movie...' : 'Buffering...'}
              </span>
              {isLoadingVideo && (
                <span className="text-[10px] text-zinc-400 mt-1 max-w-xs text-center px-4">
                  Large movies may take a moment to index
                </span>
              )}
            </div>
          )}

          {/* ERROR BANNER FOR UNSUPPORTED CODECS (MKV / HEVC / AC3) */}
          {videoErrorMessage && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 text-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mb-3 text-rose-400 shadow-xl">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mb-2 max-w-md">
                Cannot Play This Video
              </h3>
              <p className="text-xs text-zinc-300 max-w-md leading-relaxed mb-6">
                {videoErrorMessage}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose MP4 Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoErrorMessage(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* PRESS AND HOLD 2X SPEED INDICATOR */}
          {isPressAndHold2x && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/85 border border-white/20 shadow-2xl backdrop-blur-xl">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span className="text-xs font-bold font-mono tracking-wider text-white">
                  2X SPEED ⏩
                </span>
              </div>
            </div>
          )}

          {/* DOUBLE TAP RIPPLE FEEDBACK: LEFT (-10s) */}
          {doubleTapFeedback === 'left' && (
            <div className="absolute inset-y-0 left-0 w-1/2 flex items-center justify-center pointer-events-none z-35 animate-in fade-in zoom-in-90 duration-200">
              <div className="flex flex-col items-center justify-center p-5 rounded-full bg-black/75 border border-white/20 text-white backdrop-blur-md shadow-2xl">
                <RotateCcw className="w-7 h-7 text-white" />
                <span className="text-xs font-bold font-mono mt-1 text-white">-10s</span>
              </div>
            </div>
          )}

          {/* DOUBLE TAP RIPPLE FEEDBACK: RIGHT (+10s) */}
          {doubleTapFeedback === 'right' && (
            <div className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-center pointer-events-none z-35 animate-in fade-in zoom-in-90 duration-200">
              <div className="flex flex-col items-center justify-center p-5 rounded-full bg-black/75 border border-white/20 text-white backdrop-blur-md shadow-2xl">
                <RotateCw className="w-7 h-7 text-white" />
                <span className="text-xs font-bold font-mono mt-1 text-white">+10s</span>
              </div>
            </div>
          )}

          {/* Duration mismatch warning */}
          {isDurationMismatched && (
            <div className="absolute top-4 inset-x-4 z-40 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 backdrop-blur-md flex items-center justify-between shadow-2xl animate-in slide-in-from-top-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-amber-300">
                    {t('video.mismatchWarningTitle')}
                  </p>
                  <p className="text-[10px] text-amber-200/80">
                    {t('video.mismatchWarningText')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDismissMismatch(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition-colors cursor-pointer"
              >
                {t('video.dismissWarning')}
              </button>
            </div>
          )}

          {/* Finished Overlay */}
          {isEnded && (
            <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {t('video.finishedTitle')}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                {fileName} ({formatTime(duration)})
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {canControl && (
                  <button
                    onClick={onReplay}
                    className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{t('video.replay')}</span>
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{t('video.chooseAnother')}</span>
                </button>
              </div>
            </div>
          )}

          {/* TOP BAR HUD (Slides down on click, auto-hides) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            data-interactive="true"
            className={`absolute top-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-all duration-300 flex items-center justify-between z-30 ${
              showControls && !isScreenLocked ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            {/* Left: Back button (if Fullscreen or Rotated Landscape), Movie Title & Duration */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              {(isFullscreen || isRotatedLandscape) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExitFullscreen();
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-white border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 shrink-0"
                  aria-label="Back"
                  title="Back (Exit Fullscreen / Landscape)"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  <span className="text-xs font-semibold text-zinc-200 hidden xs:inline">Back</span>
                </button>
              )}

              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate max-w-[110px] xs:max-w-[180px] sm:max-w-md">
                {fileName}
              </span>
              <span className="text-[10px] font-mono text-zinc-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10 shrink-0">
                {formatTime(duration)}
              </span>

              {/* Partner is speaking badge in top HUD */}
              {partnerIsSpeaking && (
                <div className="hidden xs:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/10 border border-white/20 text-white text-[10px] sm:text-xs font-semibold animate-pulse shadow-md shrink-0">
                  <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white animate-bounce" />
                  <span className="truncate max-w-[80px] sm:max-w-[110px]">{partnerName || 'Partner'}</span>
                </div>
              )}
            </div>

            {/* Right: Unified Player Controls Toolbar (VLC / MX Player style) */}
            <div 
              className="flex items-center bg-black/70 backdrop-blur-xl border border-white/15 rounded-xl p-0.5 shadow-2xl shrink-0" 
              data-interactive="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Quick Voice Mic Button */}
              {voiceEnabled && onToggleVoiceMute && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVoiceMute();
                    }}
                    className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isVoiceMuted
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                        : isSpeakingLocally
                        ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    }`}
                    title={isVoiceMuted ? t('voice.unmute') : t('voice.mute')}
                    aria-label={isVoiceMuted ? t('voice.unmute') : t('voice.mute')}
                  >
                    {isVoiceMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Mic className={`w-3.5 h-3.5 ${isSpeakingLocally ? 'text-black' : 'text-emerald-400'}`} />
                    )}
                    <span className="text-[11px] font-semibold hidden xs:inline">
                      {isVoiceMuted ? t('voice.unmute') : isSpeakingLocally ? t('voice.speaking') : t('voice.mute')}
                    </span>
                  </button>
                  <div className="w-px h-3.5 bg-white/10 mx-0.5" />
                </>
              )}
              {/* Chat Button */}
              {onSendMessage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsChatOpen(prev => !prev);
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isChatOpen
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Live Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold hidden md:inline">Chat</span>
                  {messages && messages.length > 0 && (
                    <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                      {messages.length}
                    </span>
                  )}
                </button>
              )}

              <div className="w-px h-3.5 bg-white/10 mx-0.5" />

              {/* Aspect Ratio / Fit Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFitMenu(prev => !prev);
                  }}
                  className="px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 font-medium cursor-pointer"
                  title="Aspect Ratio & Fit Mode"
                >
                  <Scaling className="w-3.5 h-3.5 text-zinc-300" />
                  <span className="font-semibold text-[11px]">{currentFitOption.iconLabel}</span>
                </button>

                {showFitMenu && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-950/95 border border-emerald-900/60 shadow-2xl backdrop-blur-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80">
                      {t('video.aspectRatio', 'Screen Fit & Ratio')}
                    </div>
                    {FIT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setFitMode(opt.id);
                          setShowFitMenu(false);
                          resetControlsTimeout();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                          fitMode === opt.id
                            ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {fitMode === opt.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-px h-3.5 bg-white/10 mx-0.5" />

              {/* Change video button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                title={t('video.changeFileButton')}
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium hidden sm:inline">{t('video.changeFileButton')}</span>
              </button>
            </div>
          </div>

          {/* VLC Floating Lock Button (Left Edge of Player) */}
          {/* When controls are shown: visible on left side */}
          {showControls && !isScreenLocked && (
            <button
              type="button"
              data-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                setIsScreenLocked(true);
                setShowControls(false);
                setShowFitMenu(false);
                setShowTracksMenu(false);
                setShowQuickReactions(false);
                setIsChatOpen(false);
                setShowUnlockOverlay(false);
                if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
              }}
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/75 hover:bg-black/95 text-zinc-300 hover:text-amber-400 border border-white/20 hover:border-amber-400/60 shadow-2xl backdrop-blur-md flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer group"
              aria-label="Lock screen controls"
              title="Lock Screen Controls"
            >
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-200 group-hover:text-amber-400 transition-colors" />
            </button>
          )}

          {/* VLC Floating Lock Button (COMPLETELY HIDES WHEN IDLE, REVEALS ON SCREEN TAP) */}
          {isScreenLocked && (
            <div
              className={`absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-50 flex items-center transition-all duration-300 ${
                showUnlockOverlay ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'
              }`}
            >
              <button
                type="button"
                data-interactive="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsScreenLocked(false);
                  setShowUnlockOverlay(false);
                  setShowControls(true);
                  resetControlsTimeout();
                }}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/90 hover:bg-black border border-amber-500/80 hover:border-amber-400 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] backdrop-blur-xl flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ring-4 ring-amber-500/25 hover:ring-amber-500/40"
                aria-label="Unlock screen"
                title="Unlock Screen"
              >
                <Lock className="w-5 h-5 text-amber-400" />
              </button>
            </div>
          )}

          {/* Locked Mode Actions: Keep React, Chat and Voice Mic enabled even while screen is locked! */}
          {isScreenLocked && (
            <div
              data-interactive="true"
              onClick={(e) => e.stopPropagation()}
              className={`absolute top-3 sm:top-4 right-3 sm:right-4 z-50 flex items-center gap-1.5 bg-black/85 backdrop-blur-xl border border-white/20 rounded-2xl p-1 shadow-2xl transition-all duration-300 ${
                showUnlockOverlay || isChatOpen || showQuickReactions
                  ? 'opacity-100 scale-100 pointer-events-auto'
                  : 'opacity-0 scale-90 pointer-events-none'
              }`}
            >
              {/* Voice Mic Toggle in Locked Mode */}
              {voiceEnabled && onToggleVoiceMute && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVoiceMute();
                    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
                    unlockTimerRef.current = setTimeout(() => setShowUnlockOverlay(false), 3000);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isVoiceMuted
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 hover:bg-rose-500/40'
                      : isSpeakingLocally
                      ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                  title={isVoiceMuted ? t('voice.unmute') : t('voice.mute')}
                >
                  {isVoiceMuted ? (
                    <MicOff className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Mic className={`w-3.5 h-3.5 ${isSpeakingLocally ? 'text-black' : 'text-emerald-400'}`} />
                  )}
                  <span className="text-[11px] font-semibold">
                    {isVoiceMuted ? t('voice.unmute') : isSpeakingLocally ? t('voice.speaking') : t('voice.mute')}
                  </span>
                </button>
              )}
              {/* React button */}
              {reactionsEnabled && onSendReaction && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQuickReactions(prev => !prev);
                      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
                      unlockTimerRef.current = setTimeout(() => setShowUnlockOverlay(false), 5000);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer text-xs ${
                      showQuickReactions
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-200 hover:text-white'
                    }`}
                    title="Send Reaction"
                  >
                    <Heart className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
                    <span className="font-semibold text-[11px]">React</span>
                  </button>

                  {showQuickReactions && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-full mt-2 right-0 bg-[#111116] border border-white/15 shadow-2xl rounded-2xl p-1.5 backdrop-blur-xl flex items-center gap-1 z-55 animate-in fade-in zoom-in-95"
                    >
                      {['💚', '🍿', '😂', '🔥', '👏'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            onSendReaction(emoji);
                            setShowQuickReactions(false);
                            if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
                            unlockTimerRef.current = setTimeout(() => setShowUnlockOverlay(false), 2000);
                          }}
                          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-xl active:scale-125 transition-transform cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Chat Button */}
              {onSendMessage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsChatOpen(prev => !prev);
                    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
                    if (!isChatOpen) {
                      setShowUnlockOverlay(true);
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isChatOpen
                      ? 'bg-white text-black'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white'
                  }`}
                  title="Live Chat"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Chat</span>
                  {messages && messages.length > 0 && (
                    <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded-full font-mono">
                      {messages.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* CENTER PLAY / PAUSE & SKIP CONTROLS (VLC / MX Player style) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            data-interactive="true"
            className={`absolute inset-0 flex items-center justify-center gap-6 sm:gap-12 pointer-events-none z-20 transition-all duration-300 ${
              showControls && !isScreenLocked ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'
            }`}
          >
            {/* Rewind 10s */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSkip('left');
              }}
              disabled={!canControl}
              className="pointer-events-auto w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-white/10 border border-white/15 text-zinc-200 hover:text-white flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-90 cursor-pointer shadow-xl disabled:opacity-30 disabled:cursor-not-allowed"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="w-5 h-5 text-white" />
              <span className="text-[9px] font-bold text-zinc-300 -mt-0.5">10</span>
            </button>

            {/* Big Center Play / Pause */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
                resetControlsTimeout();
              }}
              disabled={!canControl}
              className="pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-black" />
              ) : (
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-black ml-1" />
              )}
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSkip('right');
              }}
              disabled={!canControl}
              className="pointer-events-auto w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-white/10 border border-white/15 text-zinc-200 hover:text-white flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-90 cursor-pointer shadow-xl disabled:opacity-30 disabled:cursor-not-allowed"
              title="Forward 10 seconds"
            >
              <RotateCw className="w-5 h-5 text-white" />
              <span className="text-[9px] font-bold text-zinc-300 -mt-0.5">10</span>
            </button>
          </div>

          {/* BOTTOM CONTROLS HUD */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            data-interactive="true"
            className={`absolute bottom-0 inset-x-0 px-2 sm:px-4 pb-2 sm:pb-4 pt-6 sm:pt-8 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-all duration-300 z-30 ${
              showControls && !isScreenLocked ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            {/* Scrubber Progress Bar */}
            <div
              className="relative w-full h-3 group/scrub flex items-center cursor-pointer mb-2"
              onMouseMove={handleMouseMoveScrubber}
              onMouseLeave={handleMouseLeaveScrubber}
              onClick={(e) => e.stopPropagation()}
              data-interactive="true"
            >
              {hoverTime !== null && (
                <div
                  style={{ left: `${hoverX}px` }}
                  className="absolute -top-7 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-mono px-2 py-0.5 rounded border border-white/15 shadow-md pointer-events-none whitespace-nowrap"
                >
                  {formatTime(hoverTime)}
                </div>
              )}

              <div className="w-full h-1.5 group-hover/scrub:h-2 bg-white/20 rounded-full transition-all overflow-hidden relative">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>

              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                disabled={!canControl || isScreenLocked}
                onChange={handleSeekChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Seek video position"
              />
            </div>

            {/* Bottom Row controls */}
            <div className="flex items-center justify-between text-zinc-300 gap-1 sm:gap-2 w-full min-w-0">
              {/* Left: Time and Lock badge */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
                <div className="text-[11px] sm:text-xs font-mono text-zinc-300 tracking-tight whitespace-nowrap">
                  <span className="text-white font-medium">{formatTime(currentTime)}</span>
                  <span className="text-zinc-600 mx-1">/</span>
                  <span className="text-zinc-400">{formatTime(duration)}</span>
                </div>

                {!canControl && (
                  <span className="hidden md:inline-block text-[10px] text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                    {t('video.hostOnlyControl')}
                  </span>
                )}
              </div>

              {/* Right: Quick Reaction, Volume, Speed, CC, Audio, Rotate, Fullscreen */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto" data-interactive="true" onClick={(e) => e.stopPropagation()}>
                {/* Send Reactions inside controls HUD */}
                {reactionsEnabled && onSendReaction && (
                  <div className="relative shrink-0 flex items-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuickReactions(prev => !prev);
                        resetControlsTimeout();
                      }}
                      className={`p-1 sm:p-1.5 rounded-lg border transition-all flex items-center gap-1 active:scale-125 cursor-pointer shrink-0 ${
                        showQuickReactions
                          ? 'bg-white text-black border-white'
                          : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-zinc-300 hover:text-white'
                      }`}
                      title="Send Reaction"
                    >
                      <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 fill-emerald-400/20" />
                      <span className="text-[10px] sm:text-[11px] font-semibold hidden md:inline">React</span>
                    </button>

                    {showQuickReactions && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 bg-[#111116] border border-white/10 shadow-2xl rounded-2xl p-1.5 backdrop-blur-xl flex items-center gap-1 z-50 animate-in fade-in zoom-in-95"
                      >
                        {['💚', '🍿', '😂', '🔥', '👏'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              onSendReaction(emoji);
                              setShowQuickReactions(false);
                              resetControlsTimeout();
                            }}
                            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-lg hover:bg-white/[0.08] rounded-xl active:scale-125 transition-transform cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Volume */}
                <div className="flex items-center gap-1 group/vol shrink-0">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1 sm:p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                    aria-label="Toggle mute"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-12 sm:w-16 h-1 bg-zinc-700 rounded-lg cursor-pointer hidden md:inline-block"
                    aria-label="Volume slider"
                  />
                </div>

                {/* Speed selector */}
                <div className="relative shrink-0">
                  <select
                    value={playbackRate}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className="bg-zinc-900/90 hover:bg-zinc-800 text-[10px] sm:text-[11px] font-mono font-medium text-zinc-300 px-1 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg border border-white/10 focus:outline-none cursor-pointer"
                    aria-label="Playback speed"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1.0}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2.0}>2x</option>
                  </select>
                </div>

                {/* Unified Audio & Subtitles / Tracks Button (Clean single button) */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTracksMenu(prev => !prev);
                      setShowFitMenu(false);
                      setShowQuickReactions(false);
                    }}
                    className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                      showTracksMenu || selectedSubtitle || selectedAudioTrack !== 'default'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                    aria-label="Audio & Subtitles"
                    title="Audio Tracks & Subtitles"
                  >
                    <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {(selectedSubtitle || selectedAudioTrack !== 'default') && (
                      <span className="text-[8px] sm:text-[9px] font-bold text-emerald-300">
                        {selectedSubtitle && selectedAudioTrack !== 'default' ? 'AU+CC' : selectedSubtitle ? 'CC' : 'AU'}
                      </span>
                    )}
                  </button>

                  {/* Unified Popover with 2 Clean Tabs: Subtitles & Audio */}
                  {showTracksMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-2 w-64 sm:w-72 rounded-2xl bg-[#111116] border border-white/10 shadow-2xl backdrop-blur-2xl py-2.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                    >
                      {/* Tabs Header */}
                      <div className="px-2.5 pb-2 border-b border-white/[0.08] flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTracksMenuTab('subtitles')}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            tracksMenuTab === 'subtitles'
                              ? 'bg-white text-black shadow-md'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Captions className="w-3.5 h-3.5" />
                          <span>Subtitles</span>
                          {selectedSubtitle && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setTracksMenuTab('audio')}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            tracksMenuTab === 'audio'
                              ? 'bg-white text-black shadow-md'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Languages className="w-3.5 h-3.5" />
                          <span>Audio</span>
                          {selectedAudioTrack !== 'default' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </button>
                      </div>

                      {/* Tab 1: Subtitles Content */}
                      {tracksMenuTab === 'subtitles' && (
                        <div>
                          <div className="max-h-48 overflow-y-auto py-1 px-1">
                            {/* Off */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubtitle(null);
                                setActiveSubtitleText('');
                                resetControlsTimeout();
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-lg transition-colors cursor-pointer ${
                                !selectedSubtitle
                                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                  : 'text-zinc-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <span>Off (No Subtitles)</span>
                              {!selectedSubtitle && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>

                            {/* List of Loaded Subtitles */}
                            {subtitles.map(sub => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSubtitle(sub.id);
                                  resetControlsTimeout();
                                }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-lg transition-colors cursor-pointer ${
                                  selectedSubtitle === sub.id
                                    ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                    : 'text-zinc-300 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                <span className="truncate pr-2">{sub.label}</span>
                                {selectedSubtitle === sub.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              </button>
                            ))}
                          </div>

                          {/* Load Subtitle Button */}
                          <div className="p-2 border-t border-white/[0.08] mt-1">
                            <button
                              type="button"
                              onClick={() => subtitleInputRef.current?.click()}
                              className="w-full py-1.5 px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-emerald-500/30"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Load .SRT / .VTT Subtitle</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Audio Tracks Content */}
                      {tracksMenuTab === 'audio' && (
                        <div>
                          <div className="max-h-48 overflow-y-auto py-1 px-1">
                            {/* Default / Original Track */}
                            <button
                              type="button"
                              onClick={() => handleSelectAudioTrack('default')}
                              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-lg transition-colors cursor-pointer ${
                                selectedAudioTrack === 'default'
                                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                  : 'text-zinc-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <span className="truncate pr-2">Original / Default Audio</span>
                              {selectedAudioTrack === 'default' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>

                            {/* Detected native audio tracks */}
                            {audioTracks.map(track => (
                              <button
                                key={track.id}
                                type="button"
                                onClick={() => handleSelectAudioTrack(track.id)}
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-lg transition-colors cursor-pointer ${
                                  selectedAudioTrack === track.id
                                    ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                    : 'text-zinc-300 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                <span className="truncate pr-2">{track.label}</span>
                                {selectedAudioTrack === track.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              </button>
                            ))}

                            {/* External loaded audio tracks (e.g. Tamil track) */}
                            {externalAudioTracks.map(track => (
                              <button
                                key={track.id}
                                type="button"
                                onClick={() => handleSelectAudioTrack(track.id)}
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-lg transition-colors cursor-pointer ${
                                  selectedAudioTrack === track.id
                                    ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                    : 'text-zinc-300 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                <span className="truncate pr-2 flex items-center gap-1.5 min-w-0">
                                  <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-800/60 shrink-0">
                                    AUDIO
                                  </span>
                                  <span className="truncate">{track.label}</span>
                                </span>
                                {selectedAudioTrack === track.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              </button>
                            ))}
                          </div>

                          {/* Load External Audio / Headphone sync */}
                          <div className="p-2 border-t border-white/[0.08] mt-1 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => audioFileInputRef.current?.click()}
                              className="w-full py-1.5 px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-emerald-500/30"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Load Tamil / Audio Track</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  if (videoRef.current && 'setSinkId' in videoRef.current) {
                                    await (videoRef.current as any).setSinkId('');
                                  }
                                  if (externalAudioRef.current && 'setSinkId' in externalAudioRef.current) {
                                    await (externalAudioRef.current as any).setSinkId('');
                                  }
                                } catch (err) {
                                  console.warn('Sync audio sink error:', err);
                                }
                              }}
                              className="w-full py-1.5 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
                              title="Re-route audio to newly connected Bluetooth earpods or headphones"
                            >
                              <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Re-sync Earpods / Headset</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PiP */}
                <button
                  type="button"
                  onClick={togglePiP}
                  className="p-1 sm:p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors hidden md:inline-flex cursor-pointer shrink-0"
                  aria-label="Picture in picture"
                  title="Picture in Picture"
                >
                  <PictureInPicture className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {/* Fullscreen / Landscape (Single Unified Button: auto-rotates on mobile, standard on laptop) */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1 sm:p-1.5 text-zinc-200 hover:text-white rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 hover:border-emerald-600/50 transition-colors cursor-pointer shrink-0"
                  aria-label="Toggle fullscreen"
                  title={isFullscreen || isRotatedLandscape ? 'Exit Fullscreen' : 'Fullscreen & Landscape'}
                >
                  {isFullscreen || isRotatedLandscape ? (
                    <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  ) : (
                    <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* IN-PLAYER FLOATING REACTIONS */}
          {reactions && reactions.length > 0 && (
            <ReactionOverlay reactions={reactions} />
          )}

          {/* Quick Floating Voice Mic Pill in Fullscreen Mode when controls are idle */}
          {(isFullscreen || isRotatedLandscape) && !showControls && !isScreenLocked && voiceEnabled && onToggleVoiceMute && (
            <button
              type="button"
              data-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVoiceMute();
              }}
              className={`absolute top-3 right-3 z-35 px-2.5 py-1.5 rounded-full backdrop-blur-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-lg border ${
                isVoiceMuted
                  ? 'bg-black/70 hover:bg-black/90 text-rose-300 border-rose-500/40 opacity-80 hover:opacity-100'
                  : isSpeakingLocally
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.9)] opacity-95 animate-pulse'
                  : 'bg-emerald-950/80 hover:bg-emerald-900/95 text-emerald-300 border-emerald-500/40 opacity-80 hover:opacity-100'
              }`}
              title={isVoiceMuted ? t('voice.unmute') : t('voice.mute')}
              aria-label={isVoiceMuted ? t('voice.unmute') : t('voice.mute')}
            >
              {isVoiceMuted ? (
                <MicOff className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Mic className={`w-3.5 h-3.5 ${isSpeakingLocally ? 'text-black' : 'text-emerald-400'}`} />
              )}
              <span className="text-[11px] font-semibold">
                {isVoiceMuted ? t('voice.unmute') : isSpeakingLocally ? t('voice.speaking') : t('voice.mute')}
              </span>
            </button>
          )}

          {/* VLC / MX PLAYER GESTURE FEEDBACK HUD PILL */}
          {gestureFeedback.type && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-35 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex flex-col items-center justify-center px-6 py-4 rounded-2xl bg-black/85 border border-emerald-500/50 text-white shadow-2xl backdrop-blur-xl min-w-[140px]">
                {gestureFeedback.type === 'seek' && (
                  <>
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-lg font-mono">
                      {gestureFeedback.valueText.startsWith('-') ? <RotateCcw className="w-5 h-5" /> : <RotateCw className="w-5 h-5" />}
                      <span>{gestureFeedback.valueText}</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-300 mt-1">
                      {gestureFeedback.subText}
                    </span>
                    <div className="w-28 h-1.5 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${gestureFeedback.percent}%` }} />
                    </div>
                  </>
                )}
                {gestureFeedback.type === 'volume' && (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                      {isMuted || volume === 0 ? <VolumeX className="w-6 h-6 text-rose-400" /> : <Volume2 className="w-6 h-6" />}
                      <span className="font-mono">{gestureFeedback.valueText}</span>
                    </div>
                    <div className="w-28 h-1.5 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${gestureFeedback.percent}%` }} />
                    </div>
                  </>
                )}
                {gestureFeedback.type === 'brightness' && (
                  <>
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-lg">
                      <Sun className="w-6 h-6 text-amber-400" />
                      <span className="font-mono">{gestureFeedback.valueText}</span>
                    </div>
                    <div className="w-28 h-1.5 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${gestureFeedback.percent}%` }} />
                    </div>
                  </>
                )}
                {gestureFeedback.type === 'back' && (
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                    <ArrowLeft className="w-5 h-5 animate-pulse" />
                    <span>{gestureFeedback.valueText}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FLOATING CUTE INCOMING MESSAGE TOASTS (Side / Landscape) */}
          {floatingMessages.length > 0 && !isChatOpen && (
            <div
              className="absolute top-16 right-3 sm:right-6 z-40 flex flex-col gap-2.5 pointer-events-none max-w-[280px] xs:max-w-xs animate-in slide-in-from-right-4 duration-300"
              data-interactive="true"
            >
              {floatingMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsChatOpen(true);
                  }}
                  className="pointer-events-auto p-3 rounded-2xl bg-zinc-950/90 hover:bg-zinc-900 border border-emerald-500/50 shadow-2xl backdrop-blur-xl transition-all cursor-pointer flex items-start gap-2.5 group active:scale-95"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-xs mt-0.5">
                    {msg.senderName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-emerald-400 truncate">
                        {msg.senderName}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-200 mt-0.5 line-clamp-2 break-words leading-snug">
                      {msg.message}
                    </p>
                    <span className="text-[9px] text-emerald-300/80 font-medium group-hover:text-emerald-300 mt-1 inline-flex items-center gap-1">
                      <span>Tap to reply in chat 💬</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* IN-PLAYER LIVE CHAT DRAWER (Google Meet style) */}
          {isChatOpen && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              data-interactive="true"
              className="absolute top-0 right-0 bottom-0 w-80 sm:w-92 max-w-[88vw] bg-zinc-950/95 border-l border-emerald-900/60 shadow-2xl z-45 backdrop-blur-2xl flex flex-col animate-in slide-in-from-right duration-200"
            >
              {/* Header */}
              <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                    Live Chat
                  </h3>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60 font-mono">
                    {messages?.length || 0}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {voiceEnabled && onToggleVoiceMute && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVoiceMute();
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                        isVoiceMuted
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                          : isSpeakingLocally
                          ? 'bg-emerald-500 text-black shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      }`}
                      title={isVoiceMuted ? t('voice.unmute') : t('voice.mute')}
                    >
                      {isVoiceMuted ? (
                        <MicOff className="w-3 h-3 text-rose-400" />
                      ) : (
                        <Mic className={`w-3 h-3 ${isSpeakingLocally ? 'text-black' : 'text-emerald-400'}`} />
                      )}
                      <span>{isVoiceMuted ? t('voice.unmute') : t('voice.mute')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(false)}
                    className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    title="Close Chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                {!messages || messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                    <Heart className="w-8 h-8 text-emerald-500/20 mb-2" />
                    <p className="text-xs text-zinc-400">
                      No messages yet. Send a note to your partner!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === currentParticipantId;
                    const isSystem = msg.type === 'SYSTEM';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-1.5">
                          <span className="text-[10px] text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-2.5 py-0.5 rounded-full text-center max-w-[90%]">
                            {msg.message}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                          <span className={`text-[10px] font-semibold ${isMe ? 'text-emerald-400' : 'text-zinc-400'}`}>
                            {isMe ? 'You' : msg.senderName}
                          </span>
                          <span className="text-[9px] text-zinc-600 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div
                          className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                            isMe
                              ? 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-950/40'
                              : 'bg-zinc-800/90 text-zinc-200 rounded-tl-none border border-zinc-700/60'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatDrawerEndRef} />
              </div>

              {/* Quick Reactions Bar in Drawer */}
              {reactionsEnabled && onSendReaction && (
                <div className="px-2.5 py-1.5 border-t border-zinc-800/60 bg-zinc-900/30 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    {['💚', '🍿', '😂', '🔥', '👏'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onSendReaction(emoji)}
                        className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-zinc-800 active:scale-125 transition-transform cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = inPlayerMessageText.trim();
                  if (!trimmed || !onSendMessage) return;
                  onSendMessage(trimmed);
                  setInPlayerMessageText('');
                }}
                className="p-2.5 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={inPlayerMessageText}
                  onChange={(e) => setInPlayerMessageText(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={500}
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!inPlayerMessageText.trim()}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center cursor-pointer shrink-0"
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
