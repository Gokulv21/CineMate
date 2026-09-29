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
  Sparkles, 
  Scaling, 
  Heart, 
  Check, 
  ArrowLeft,
  Captions,
  Languages,
  Plus
} from 'lucide-react';
import type { VideoMetadata } from '../types/index.js';
import { formatTime } from '../lib/utils.js';

export type VideoFitMode = 'contain' | 'cover' | 'fill' | '16-9' | '21-9' | '4-3';

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
  // Rotated Landscape state (manual toggle or when in fullscreen on mobile)
  const [isRotatedLandscape, setIsRotatedLandscape] = useState<boolean>(false);

  // Loading, Buffering & Error states for large movie files
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [videoErrorMessage, setVideoErrorMessage] = useState<string | null>(null);

  // Subtitles / Captions (CC)
  const [subtitles, setSubtitles] = useState<{ id: string; label: string; src: string; lang: string }[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState<boolean>(false);
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  // Audio Tracks / Languages
  const [audioTracks, setAudioTracks] = useState<{ id: string; label: string; language: string }[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('default');
  const [showAudioMenu, setShowAudioMenu] = useState<boolean>(false);
  const externalAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const [externalAudioTracks, setExternalAudioTracks] = useState<{ id: string; label: string; src: string }[]>([]);
  const [activeExternalAudioId, setActiveExternalAudioId] = useState<string | null>(null);

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
        setShowSubtitleMenu(false);
        setShowAudioMenu(false);
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

      let vttContent = text;
      // Convert SRT to WebVTT
      if (!text.trim().startsWith('WEBVTT')) {
        vttContent = 'WEBVTT\n\n' + text
          .replace(/\r\n|\r/g, '\n')
          .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      }

      const blob = new Blob([vttContent], { type: 'text/vtt' });
      const subUrl = URL.createObjectURL(blob);
      const newSub = {
        id: `sub-${Date.now()}`,
        label: file.name.replace(/\.(srt|vtt)$/i, ''),
        src: subUrl,
        lang: 'en'
      };

      setSubtitles(prev => [...prev, newSub]);
      setSelectedSubtitle(newSub.id);
      setShowSubtitleMenu(false);
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
    setShowAudioMenu(false);
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

    setShowAudioMenu(false);
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
      setCurrentTime(video.currentTime);
      // Sync external audio drift if > 0.35s
      if (activeExternalAudioId && externalAudioRef.current) {
        if (Math.abs(externalAudioRef.current.currentTime - video.currentTime) > 0.35) {
          externalAudioRef.current.currentTime = video.currentTime;
        }
      }
    }
  };

  const handleEnded = () => {
    setIsEnded(true);
    setIsPlaying(false);
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
    if (!videoRef.current || !canControl) return;

    if (videoRef.current.paused) {
      onPlay();
    } else {
      onPause();
    }
  }, [canControl, onPlay, onPause, videoRef]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl) return;
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (externalAudioRef.current) {
      externalAudioRef.current.currentTime = target;
    }
    onSeek(target);
    resetControlsTimeout();
  };

  const handleMouseMoveScrubber = (e: React.MouseEvent<HTMLDivElement>) => {
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

  // Fullscreen toggle with orientation lock
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      // 1. Attempt native Fullscreen
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

      // On mobile portrait screen (height > width), automatically rotate to landscape!
      if (window.innerHeight > window.innerWidth) {
        setIsRotatedLandscape(true);
      }

      // 2. Lock screen orientation to landscape if supported
      try {
        if (screen.orientation && 'lock' in screen.orientation) {
          await (screen.orientation as any).lock('landscape').catch(() => {});
        } else if ((screen as any).lockOrientation) {
          (screen as any).lockOrientation('landscape');
        }
      } catch (err) {
        console.warn('Screen orientation lock failed:', err);
      }
    } else {
      await handleExitFullscreen();
    }
    resetControlsTimeout();
  };

  // Toggle Rotated Landscape directly (VLC / MX player style)
  const toggleRotateLandscape = () => {
    if (!isFullscreen && !isRotatedLandscape) {
      setIsFullscreen(true);
      setIsRotatedLandscape(true);
    } else if (isRotatedLandscape) {
      setIsRotatedLandscape(false);
    } else {
      setIsRotatedLandscape(true);
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
  // GESTURE HANDLING: Single Click (Toggle HUD), Double Click (Skip 10s),
  // and Press & Hold (2x Speed Stream like YouTube / MX Player)
  // =========================================================================

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If clicking on an interactive control element, don't trigger gestures
    if ((e.target as HTMLElement).closest('button, input, select, a, [data-interactive="true"]')) {
      return;
    }

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    wasLongPressRef.current = false;
    // Snapshot controls visibility at the instant touch begins
    controlsOpenAtTouchRef.current = showControls;

    // Start Long-Press timer: hold for 380ms ➔ 2x Speed
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
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // If we were holding for 2x speed, restore original speed immediately
    if (isPressAndHold2xRef.current) {
      setIsPressAndHold2x(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }
      if (externalAudioRef.current) {
        externalAudioRef.current.playbackRate = playbackRate;
      }
      return;
    }

    // If it was a long-press release, do not trigger single/double clicks
    if (wasLongPressRef.current) {
      return;
    }

    // If clicking on an interactive control element, don't handle screen tap
    if ((e.target as HTMLElement).closest('button, input, select, a, [data-interactive="true"]')) {
      return;
    }

    // Verify pointer didn't move too much (to ignore drags)
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 25 || dy > 25) {
      return;
    }

    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    let isRightHalf = false;
    if (isRotatedLandscape) {
      // 90deg clockwise: top of phone is visual left (-10s), bottom of phone is visual right (+10s)
      isRightHalf = (e.clientY - rect.top) > rect.height / 2;
    } else {
      const clickX = e.clientX - rect.left;
      isRightHalf = clickX > rect.width / 2;
    }

    // Check if this is a Double Tap (within 300ms of previous tap)
    if (now - lastTapRef.current.time < 300) {
      // Cancel pending single-click toggle
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
        singleClickTimerRef.current = null;
      }

      // Trigger 10 seconds skip!
      triggerSkip(isRightHalf ? 'right' : 'left');
      lastTapRef.current = { time: 0, x: 0, y: 0 };
    } else {
      // Record first tap
      lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };

      // Set single-click timer (260ms) to toggle controls HUD (VLC / MX Player style)
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
      }
      const wasOpen = controlsOpenAtTouchRef.current;
      singleClickTimerRef.current = setTimeout(() => {
        if (wasOpen) {
          setShowControls(false);
          setShowFitMenu(false);
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
    if (e.pointerType === 'touch') return; // Ignore mobile touch moves
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
  }, [togglePlayPause, canControl, isFullscreen, resetControlsTimeout]);

  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (doubleTapFeedbackTimerRef.current) clearTimeout(doubleTapFeedbackTimerRef.current);
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
          : 'relative w-full h-full overflow-hidden shadow-2xl cinema-screen-shadow border border-emerald-950/40 group aspect-video'
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
            className="w-20 h-20 rounded-2xl bg-[#091a13] border-2 border-dashed border-emerald-800/60 hover:border-emerald-500 flex items-center justify-center mb-5 cursor-pointer group/pick transition-all hover:bg-[#0c241b] shadow-xl"
          >
            <Film className="w-10 h-10 text-emerald-400/70 group-hover/pick:text-emerald-400 group-hover/pick:scale-110 transition-all" />
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
            className="mt-6 px-6 py-3 rounded-xl font-semibold text-xs uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
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

          {/* MKV CODEC NOTICE: Informs user if an MKV file cannot decode video frames or multi-audio */}
          {fileName.toLowerCase().endsWith('.mkv') && !dismissMkvNotice && (
            <div className="absolute top-16 inset-x-3 sm:inset-x-8 z-40 p-3 sm:p-4 rounded-xl bg-black/90 border border-emerald-500/50 backdrop-blur-md flex items-start justify-between shadow-2xl animate-in slide-in-from-top-3">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Film className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>MKV Format Notice</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60">.mkv</span>
                  </p>
                  <p className="text-[11px] sm:text-xs text-zinc-300 leading-relaxed mt-1">
                    Browsers natively play <strong>MP4 (H.264 / AAC)</strong>. 
                    If this movie shows a black screen, it uses HEVC (H.265) video. If it plays in Hindi instead of Tamil, browsers automatically play the 1st audio stream in MKVs.
                  </p>
                  <p className="text-[11px] text-emerald-300 font-semibold mt-1.5">
                    💡 Tip: Click the Languages (🌐) button below to load a Tamil audio track (.m4a/.mp3), or convert the MKV to MP4 with VLC/HandBrake.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissMkvNotice(true)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer shrink-0 ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* LOADING / BUFFERING SPINNER (Large video files) */}
          {(isLoadingVideo || isBuffering) && !videoErrorMessage && (
            <div className="absolute inset-0 z-35 flex flex-col items-center justify-center bg-black/55 backdrop-blur-xs pointer-events-none animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin mb-3 shadow-lg shadow-emerald-950/80" />
              <span className="text-xs font-semibold text-emerald-300 tracking-wide font-mono">
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
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mb-3 text-rose-400 shadow-xl shadow-rose-950/50">
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
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose MP4 Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoErrorMessage(null)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* PRESS AND HOLD 2X SPEED INDICATOR (YouTube / MX Player style) */}
          {isPressAndHold2x && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/85 border border-emerald-400/70 shadow-2xl shadow-emerald-500/40 backdrop-blur-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold font-mono tracking-wider text-emerald-300">
                  2X SPEED ⏩
                </span>
              </div>
            </div>
          )}

          {/* DOUBLE TAP RIPPLE FEEDBACK: LEFT (-10s) */}
          {doubleTapFeedback === 'left' && (
            <div className="absolute inset-y-0 left-0 w-1/2 flex items-center justify-center pointer-events-none z-35 animate-in fade-in zoom-in-90 duration-200">
              <div className="flex flex-col items-center justify-center p-5 rounded-full bg-black/75 border border-emerald-400/60 text-emerald-300 backdrop-blur-md shadow-2xl shadow-emerald-950/80">
                <RotateCcw className="w-8 h-8 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold font-mono mt-1 text-white">-10s</span>
              </div>
            </div>
          )}

          {/* DOUBLE TAP RIPPLE FEEDBACK: RIGHT (+10s) */}
          {doubleTapFeedback === 'right' && (
            <div className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-center pointer-events-none z-35 animate-in fade-in zoom-in-90 duration-200">
              <div className="flex flex-col items-center justify-center p-5 rounded-full bg-black/75 border border-emerald-400/60 text-emerald-300 backdrop-blur-md shadow-2xl shadow-emerald-950/80">
                <RotateCw className="w-8 h-8 text-emerald-400 animate-pulse" />
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
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition-colors"
              >
                {t('video.dismissWarning')}
              </button>
            </div>
          )}

          {/* Finished Overlay */}
          {isEnded && (
            <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-3">
                <Sparkles className="w-7 h-7 text-emerald-400" />
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
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
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
              showControls ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            {/* Left: Back button (if Fullscreen or Rotated Landscape), Rotate button & Movie Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              {(isFullscreen || isRotatedLandscape) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExitFullscreen();
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-zinc-900/80 hover:bg-emerald-950/60 text-white border border-emerald-900/40 hover:border-emerald-600/60 flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
                  aria-label="Back"
                  title="Back (Exit Fullscreen / Landscape)"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  <span className="text-xs font-semibold text-zinc-200 hidden xs:inline">Back</span>
                </button>
              )}

              {/* Rotate Screen button (Landscape / Portrait) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRotateLandscape();
                }}
                className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-1.5 ${
                  isRotatedLandscape
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-900/50'
                    : 'bg-zinc-900/80 hover:bg-emerald-950/60 text-zinc-300 hover:text-white border-emerald-900/40 hover:border-emerald-600/60'
                }`}
                aria-label="Rotate Orientation"
                title={isRotatedLandscape ? 'Switch to Portrait' : 'Rotate to Landscape'}
              >
                <RotateCw className={`w-4 h-4 ${isRotatedLandscape ? 'text-white' : 'text-emerald-400'}`} />
                <span className="text-[11px] font-semibold hidden xs:inline">
                  {isRotatedLandscape ? 'Portrait' : 'Landscape'}
                </span>
              </button>

              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate max-w-[120px] xs:max-w-[200px] sm:max-w-md">
                {fileName}
              </span>
              <span className="text-[10px] font-mono text-emerald-300 bg-zinc-950/80 px-2 py-0.5 rounded-md border border-emerald-900/40 shrink-0">
                {formatTime(duration)}
              </span>
            </div>

            {/* Right: Aspect Fit Selector & Change File */}
            <div className="flex items-center gap-2" data-interactive="true">
              {/* Aspect Ratio / Fit Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFitMenu(prev => !prev);
                  }}
                  className="text-xs text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-emerald-900/40 hover:border-emerald-600/60 transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
                  title="Aspect Ratio & Fit Mode"
                >
                  <Scaling className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold">{currentFitOption.iconLabel}</span>
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

              {/* Change video button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-700/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                title={t('video.changeFileButton')}
              >
                <Upload className="w-3 h-3 text-zinc-400" />
                <span className="hidden sm:inline">{t('video.changeFileButton')}</span>
              </button>
            </div>
          </div>

          {/* CENTER PLAY / PAUSE & SKIP CONTROLS (VLC / MX Player style) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            data-interactive="true"
            className={`absolute inset-0 flex items-center justify-center gap-6 sm:gap-12 pointer-events-none z-20 transition-all duration-300 ${
              showControls ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'
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
              className="pointer-events-auto w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-emerald-950/60 border border-emerald-900/40 hover:border-emerald-600/60 text-zinc-200 hover:text-white flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-90 cursor-pointer shadow-xl disabled:opacity-30 disabled:cursor-not-allowed"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="w-5 h-5 text-emerald-400" />
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
              className="pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white border-2 border-emerald-400/60 flex items-center justify-center shadow-2xl shadow-emerald-950/80 backdrop-blur-md transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 sm:w-9 sm:h-9 fill-white" />
              ) : (
                <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-white ml-1" />
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
              className="pointer-events-auto w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-emerald-950/60 border border-emerald-900/40 hover:border-emerald-600/60 text-zinc-200 hover:text-white flex flex-col items-center justify-center backdrop-blur-md transition-all active:scale-90 cursor-pointer shadow-xl disabled:opacity-30 disabled:cursor-not-allowed"
              title="Forward 10 seconds"
            >
              <RotateCw className="w-5 h-5 text-emerald-400" />
              <span className="text-[9px] font-bold text-zinc-300 -mt-0.5">10</span>
            </button>
          </div>

          {/* BOTTOM CONTROLS HUD (Slides up on click, auto-hides) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            data-interactive="true"
            className={`absolute bottom-0 inset-x-0 px-2 sm:px-4 pb-2 sm:pb-4 pt-6 sm:pt-8 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-all duration-300 z-30 ${
              showControls ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
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
                  className="absolute -top-7 -translate-x-1/2 bg-zinc-950 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-900/60 shadow-md pointer-events-none whitespace-nowrap"
                >
                  {formatTime(hoverTime)}
                </div>
              )}

              <div className="w-full h-1.5 group-hover/scrub:h-2 bg-zinc-800/80 rounded-full transition-all overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>

              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                disabled={!canControl}
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
                  <div className="hidden md:flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span className="hidden lg:inline">{t('video.hostOnlyControl')}</span>
                  </div>
                )}
              </div>

              {/* Right: Quick Reaction 💚, Volume, Speed, CC, Audio, Rotate, Fullscreen */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto" data-interactive="true" onClick={(e) => e.stopPropagation()}>
                {/* Send 💚 Reaction inside controls HUD */}
                {reactionsEnabled && onSendReaction && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendReaction('💚');
                      resetControlsTimeout();
                    }}
                    className="p-1 sm:p-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 active:scale-125 cursor-pointer shrink-0"
                    title="Send 💚 Reaction"
                  >
                    <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-emerald-400 text-emerald-400" />
                    <span className="text-[10px] sm:text-[11px] font-semibold hidden md:inline">React</span>
                  </button>
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
                      <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
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
                    className="bg-zinc-900/90 hover:bg-zinc-800 text-[10px] sm:text-[11px] font-mono font-medium text-zinc-300 px-1 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg border border-zinc-700/60 focus:outline-none cursor-pointer"
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

                {/* Subtitles / Captions (CC) */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSubtitleMenu(prev => !prev);
                      setShowAudioMenu(false);
                      setShowFitMenu(false);
                    }}
                    className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-0.5 shrink-0 ${
                      selectedSubtitle
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                    aria-label="Subtitles & Captions"
                    title="Subtitles & Captions (CC)"
                  >
                    <Captions className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {selectedSubtitle && (
                      <span className="text-[8px] sm:text-[9px] font-bold text-emerald-300">CC</span>
                    )}
                  </button>

                  {/* Subtitle Selection Popover */}
                  {showSubtitleMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-2 w-52 sm:w-56 rounded-xl bg-zinc-950/95 border border-emerald-900/60 shadow-2xl backdrop-blur-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80 flex items-center justify-between">
                        <span>Subtitles / Captions</span>
                        <span className="text-emerald-400 font-mono text-[9px]">{subtitles.length} available</span>
                      </div>

                      <div className="max-h-48 overflow-y-auto py-1">
                        {/* Off */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubtitle(null);
                            setShowSubtitleMenu(false);
                            resetControlsTimeout();
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                            !selectedSubtitle
                              ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                              : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                          }`}
                        >
                          <span>Off</span>
                          {!selectedSubtitle && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>

                        {/* Subtitle tracks list */}
                        {subtitles.map(sub => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setSelectedSubtitle(sub.id);
                              setShowSubtitleMenu(false);
                              resetControlsTimeout();
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                              selectedSubtitle === sub.id
                                ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                            }`}
                          >
                            <span className="truncate pr-2">{sub.label}</span>
                            {selectedSubtitle === sub.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </button>
                        ))}
                      </div>

                      {/* Add Subtitle File button */}
                      <div className="p-1.5 border-t border-zinc-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            subtitleInputRef.current?.click();
                          }}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-emerald-500/30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Load .SRT / .VTT Subtitle</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audio Language / Track Selector */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAudioMenu(prev => !prev);
                      setShowSubtitleMenu(false);
                      setShowFitMenu(false);
                    }}
                    className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-0.5 shrink-0 ${
                      selectedAudioTrack !== 'default'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                    aria-label="Audio Tracks & Languages"
                    title="Audio Tracks & Languages"
                  >
                    <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {selectedAudioTrack !== 'default' && (
                      <span className="text-[8px] sm:text-[9px] font-bold text-emerald-300">AU</span>
                    )}
                  </button>

                  {/* Audio Track Selection Popover */}
                  {showAudioMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-2 w-56 sm:w-64 rounded-xl bg-zinc-950/95 border border-emerald-900/60 shadow-2xl backdrop-blur-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80 flex items-center justify-between">
                        <span>Audio Track / Language</span>
                        {(audioTracks.length > 0 || externalAudioTracks.length > 0) && (
                          <span className="text-emerald-400 font-mono text-[9px]">
                            {1 + audioTracks.length + externalAudioTracks.length} tracks
                          </span>
                        )}
                      </div>

                      <div className="max-h-48 overflow-y-auto py-1">
                        {/* Default / Original Track */}
                        <button
                          type="button"
                          onClick={() => handleSelectAudioTrack('default')}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                            selectedAudioTrack === 'default'
                              ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                              : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                          }`}
                        >
                          <span className="truncate pr-2">Original / Default</span>
                          {selectedAudioTrack === 'default' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>

                        {/* Native detected tracks */}
                        {audioTracks.map(track => (
                          <button
                            key={track.id}
                            type="button"
                            onClick={() => handleSelectAudioTrack(track.id)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                              selectedAudioTrack === track.id
                                ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                            }`}
                          >
                            <span className="truncate pr-2">{track.label}</span>
                            {selectedAudioTrack === track.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </button>
                        ))}

                        {/* User loaded external audio tracks (e.g. Tamil .m4a / .aac / .mp3) */}
                        {externalAudioTracks.map(track => (
                          <button
                            key={track.id}
                            type="button"
                            onClick={() => handleSelectAudioTrack(track.id)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                              selectedAudioTrack === track.id
                                ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
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

                        {audioTracks.length === 0 && externalAudioTracks.length === 0 && (
                          <div className="px-3 py-1.5 text-[11px] text-zinc-400 italic">
                            1 audio stream active
                          </div>
                        )}
                      </div>

                      {/* Add External Audio Track button */}
                      <div className="p-2 border-t border-zinc-800/80 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            audioFileInputRef.current?.click();
                          }}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-emerald-500/30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Load Tamil / Audio Track</span>
                        </button>
                        <p className="text-[10px] text-zinc-400 leading-tight px-1 text-center">
                          Select an external .m4a, .aac, .mp3 or .wav audio file for Tamil
                        </p>
                      </div>
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

                {/* Rotate Landscape */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRotateLandscape();
                  }}
                  className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 border ${
                    isRotatedLandscape
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950'
                      : 'bg-zinc-900/80 hover:bg-emerald-950/60 text-zinc-300 hover:text-white border-emerald-900/50 hover:border-emerald-600/60'
                  }`}
                  aria-label="Rotate Orientation"
                  title={isRotatedLandscape ? 'Switch to Portrait' : 'Rotate to Landscape'}
                >
                  <RotateCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRotatedLandscape ? 'text-white' : 'text-emerald-400'}`} />
                </button>

                {/* Fullscreen / Expand */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1 sm:p-1.5 text-zinc-200 hover:text-white rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 hover:border-emerald-600/50 transition-colors cursor-pointer shrink-0"
                  aria-label="Toggle fullscreen"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen & Landscape'}
                >
                  {isFullscreen ? (
                    <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  ) : (
                    <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
