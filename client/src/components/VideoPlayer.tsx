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
  Lock,
  Sparkles,
  Smartphone,
  RotateCw,
  Scaling,
  Heart,
  Check,
  X
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

  // Aspect ratio & Fit states
  const [fitMode, setFitMode] = useState<VideoFitMode>('contain');
  const [showFitMenu, setShowFitMenu] = useState<boolean>(false);

  // Mobile full view / landscape rotation states
  const [isMobileTheater, setIsMobileTheater] = useState<boolean>(false);
  const [isRotatedLandscape, setIsRotatedLandscape] = useState<boolean>(false);

  // Scrubber hover preview
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  // Heart button burst animation
  const [heartBurst, setHeartBurst] = useState<boolean>(false);

  // Double tap detection
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);
    setFileName(file.name);
    setIsEnded(false);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration);
    onVideoSelected({
      fileName,
      duration: video.duration,
      size: 0
    });
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const handleEnded = () => {
    setIsEnded(true);
    setIsPlaying(false);
    if (onVideoEnded) onVideoEnded();
  };

  const handleInternalPlay = () => {
    setIsPlaying(true);
    setIsEnded(false);
    videoEventHandlers.onPlay();
  };

  const handleInternalPause = () => {
    setIsPlaying(false);
    videoEventHandlers.onPause();
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
    onSeek(target);
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
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error('Fullscreen request failed:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Mobile Full View / Landscape Toggle
  const toggleMobileTheater = async () => {
    const nextTheater = !isMobileTheater;
    setIsMobileTheater(nextTheater);

    if (nextTheater) {
      // Attempt browser screen orientation lock
      try {
        const orientation = screen.orientation as any;
        if (orientation && orientation.lock) {
          await orientation.lock('landscape').catch(() => {});
        }
      } catch (err) {
        console.warn('Orientation lock error:', err);
      }

      // Also request browser fullscreen if available
      if (containerRef.current && !document.fullscreenElement) {
        try {
          await containerRef.current.requestFullscreen();
        } catch {
          // Handled via CSS fullscreen fallback
        }
      }
    } else {
      setIsRotatedLandscape(false);
      try {
        const orientation = screen.orientation as any;
        if (orientation && orientation.unlock) {
          orientation.unlock();
        }
      } catch {
        // Ignore
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Explicit rotate 90 degrees toggle for mobile portrait-locked devices
  const toggleRotateLandscape = () => {
    setIsRotatedLandscape(prev => !prev);
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
  };

  const handleSpeedChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  };

  // Tap handler on the video area (supports single-tap to toggle controls and double-tap for reaction/seek)
  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const clientX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const rect = containerRef.current?.getBoundingClientRect();

    if (now - lastTapRef.current.time < 300 && rect) {
      // Double tap detected!
      const relativeX = clientX - rect.left;
      const width = rect.width;

      if (relativeX < width * 0.35 && canControl) {
        // Double tap left: Rewind 10s
        const next = Math.max(0, currentTime - 10);
        setCurrentTime(next);
        onSeek(next);
      } else if (relativeX > width * 0.65 && canControl) {
        // Double tap right: Forward 10s
        const next = Math.min(duration, currentTime + 10);
        setCurrentTime(next);
        onSeek(next);
      } else {
        // Double tap center: Send green heart reaction!
        triggerGreenHeartReaction();
      }
      lastTapRef.current = { time: 0, x: 0 };
      return;
    }

    lastTapRef.current = { time: now, x: clientX };
    handleUserActivity();
  };

  // Trigger floating green heart reaction
  const triggerGreenHeartReaction = () => {
    if (onSendReaction && reactionsEnabled) {
      onSendReaction('💚');
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 800);
    }
  };

  // Listen for fullscreen exit from ESC or browser button
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen && isMobileTheater) {
        setIsMobileTheater(false);
        setIsRotatedLandscape(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isMobileTheater]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft' && canControl) {
        e.preventDefault();
        const next = Math.max(0, currentTime - 5);
        onSeek(next);
      } else if (e.code === 'ArrowRight' && canControl) {
        e.preventDefault();
        const next = Math.min(duration, currentTime + 5);
        onSeek(next);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        toggleMobileTheater();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, canControl, currentTime, duration, onSeek]);

  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  // Video object-fit and aspect ratio classes
  const getVideoClasses = () => {
    switch (fitMode) {
      case 'cover':
        return 'w-full h-full object-cover scale-[1.03] transition-all duration-300';
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
    { id: 'contain', label: t('video.fitContain', 'Fit to Screen (Contain)'), iconLabel: 'Fit' },
    { id: 'cover', label: t('video.fitCover', 'Fill Screen / Zoom (No Bars)'), iconLabel: 'Zoom' },
    { id: 'fill', label: t('video.fitStretch', 'Stretch (100% Fill)'), iconLabel: 'Stretch' },
    { id: '16-9', label: t('video.aspect16_9', '16:9 Widescreen'), iconLabel: '16:9' },
    { id: '21-9', label: t('video.aspect21_9', '21:9 Ultrawide Cinema'), iconLabel: '21:9' },
    { id: '4-3', label: t('video.aspect4_3', '4:3 Classic TV'), iconLabel: '4:3' }
  ];

  const currentFitOption = FIT_OPTIONS.find(o => o.id === fitMode) || FIT_OPTIONS[0];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleVideoTap}
      className={`relative bg-black overflow-hidden shadow-2xl cinema-screen-shadow border border-emerald-950/40 select-none flex items-center justify-center transition-all ${
        isMobileTheater
          ? `fixed inset-0 z-50 w-screen h-screen rounded-none ${
              isRotatedLandscape ? 'rotate-90 origin-center scale-[1.0]' : ''
            }`
          : 'w-full aspect-video rounded-2xl'
      }`}
      style={
        isMobileTheater && isRotatedLandscape
          ? {
              width: '100vh',
              height: '100vw',
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(90deg)'
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
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPlay={handleInternalPlay}
            onPause={handleInternalPause}
            onSeeking={videoEventHandlers.onSeeking}
            onSeeked={videoEventHandlers.onSeeked}
            className={`${getVideoClasses()} cursor-pointer`}
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
          />

          {/* Floating Green Heart Quick Reaction Button */}
          {reactionsEnabled && onSendReaction && (
            <div className="absolute right-4 bottom-20 sm:bottom-24 z-30 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerGreenHeartReaction();
                }}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-400/50 shadow-xl shadow-emerald-950/70 flex items-center justify-center text-xl transition-all cursor-pointer active:scale-125 ${
                  heartBurst ? 'scale-125 ring-4 ring-emerald-400 ring-opacity-60' : 'hover:scale-110'
                }`}
                title={t('video.sendReaction', 'Send 💚')}
              >
                <Heart className="w-6 h-6 text-white fill-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
              </button>
            </div>
          )}

          {/* Duration mismatch warning */}
          {isDurationMismatched && (
            <div className="absolute top-4 inset-x-4 z-40 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md flex items-center justify-between shadow-2xl animate-in slide-in-from-top-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-amber-300">
                    {t('video.mismatchWarningTitle')}
                  </p>
                  <p className="text-[11px] text-amber-200/80">
                    {t('video.mismatchWarningText')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDismissMismatch(true)}
                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition-colors"
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

          {/* Top Bar HUD */}
          <div
            className={`absolute top-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex items-center justify-between z-20 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isMobileTheater && (
                <button
                  type="button"
                  onClick={toggleMobileTheater}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md transition-all mr-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{t('video.exitFullView', 'Exit')}</span>
                </button>
              )}
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-md">
                {fileName}
              </span>
              <span className="text-[10px] font-mono text-emerald-300 bg-zinc-950/80 px-2 py-0.5 rounded-md border border-emerald-900/40 shrink-0">
                {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Aspect Ratio / Fit Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFitMenu(prev => !prev);
                  }}
                  className="text-[11px] text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-900/40 hover:border-emerald-700/60 transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
                  title="Choose aspect ratio & fit"
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

              {/* Landscape / Rotation Toggle Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isMobileTheater) {
                    toggleMobileTheater();
                  } else {
                    toggleRotateLandscape();
                  }
                }}
                className="text-[11px] text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-900/40 hover:border-emerald-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                title={isMobileTheater ? t('video.rotateLandscape', 'Rotate 90°') : t('video.mobileFullView', 'Mobile Full View')}
              >
                {isMobileTheater ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Rotate</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Full View</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="text-[11px] text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-700/50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span className="hidden sm:inline">{t('video.changeFileButton')}</span>
              </button>
            </div>
          </div>

          {/* Bottom Controls HUD */}
          <div
            className={`absolute bottom-0 inset-x-0 px-3 sm:px-4 pb-3 sm:pb-4 pt-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 z-20 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Scrubber Progress Bar */}
            <div
              className="relative w-full h-3 group/scrub flex items-center cursor-pointer mb-3"
              onMouseMove={handleMouseMoveScrubber}
              onMouseLeave={handleMouseLeaveScrubber}
              onClick={(e) => e.stopPropagation()}
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

            <div className="flex items-center justify-between text-zinc-300">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause();
                  }}
                  disabled={!canControl}
                  className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-white hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700/60 shadow-lg transition-colors cursor-pointer"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  )}
                </button>

                {!canControl && (
                  <div className="hidden md:flex items-center gap-1.5 text-[10px] text-zinc-400 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>{t('video.hostOnlyControl')}</span>
                  </div>
                )}

                <div className="text-xs font-mono text-zinc-300 tracking-wider">
                  <span className="text-white font-medium">{formatTime(currentTime)}</span>
                  <span className="text-zinc-600 mx-1.5">/</span>
                  <span className="text-zinc-400">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3" onClick={(e) => e.stopPropagation()}>
                {/* Volume */}
                <div className="flex items-center gap-1 sm:gap-1.5 group/vol">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
                    aria-label="Toggle mute"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-12 sm:w-20 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                    aria-label="Volume slider"
                  />
                </div>

                {/* Playback rate speed */}
                <div className="relative">
                  <select
                    value={playbackRate}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className="bg-zinc-900/90 hover:bg-zinc-800 text-[11px] font-mono font-medium text-zinc-300 px-2 py-1 rounded-lg border border-zinc-700/60 focus:outline-none cursor-pointer"
                    aria-label="Playback speed"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1.0}>1.0x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2.0}>2.0x</option>
                  </select>
                </div>

                {/* Picture in picture */}
                <button
                  type="button"
                  onClick={togglePiP}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors hidden xs:inline-flex"
                  aria-label="Picture in picture"
                >
                  <PictureInPicture className="w-4 h-4" />
                </button>

                {/* Full View / Landscape Mobile Toggle */}
                <button
                  type="button"
                  onClick={toggleMobileTheater}
                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                    isMobileTheater
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  aria-label="Mobile theater full view"
                  title="Mobile Theater Landscape View"
                >
                  <Smartphone className="w-4 h-4" />
                </button>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
                  aria-label="Toggle fullscreen"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
