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
  Sparkles
} from 'lucide-react';
import type { VideoMetadata } from '../types/index.js';
import { formatTime } from '../lib/utils.js';

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

  // Scrubber hover preview
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

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

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl cinema-screen-shadow border border-zinc-800/80 group select-none flex items-center justify-center"
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
            className="w-20 h-20 rounded-2xl bg-zinc-900 border-2 border-dashed border-zinc-700 hover:border-rose-500/80 flex items-center justify-center mb-5 cursor-pointer group/pick transition-all hover:bg-zinc-800/60 shadow-xl"
          >
            <Film className="w-10 h-10 text-zinc-500 group-hover/pick:text-rose-400 group-hover/pick:scale-110 transition-all" />
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
            className="mt-6 px-6 py-3 rounded-xl font-semibold text-xs uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
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
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlayPause}
          />

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

          {isEnded && (
            <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-3">
                <Sparkles className="w-7 h-7 text-rose-400" />
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
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{t('video.replay')}</span>
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center gap-2 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>{t('video.chooseAnother')}</span>
                </button>
              </div>
            </div>
          )}

          <div
            className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 flex items-center justify-between z-20 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
                {fileName}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/90 px-2 py-0.5 rounded-md border border-zinc-700/60">
                {formatTime(duration)}
              </span>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-700/50 transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3 h-3" />
              <span>{t('video.changeFileButton')}</span>
            </button>
          </div>

          <div
            className={`absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-20 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div
              className="relative w-full h-2 group/scrub flex items-center cursor-pointer mb-3"
              onMouseMove={handleMouseMoveScrubber}
              onMouseLeave={handleMouseLeaveScrubber}
            >
              {hoverTime !== null && (
                <div
                  style={{ left: `${hoverX}px` }}
                  className="absolute -top-7 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-700 shadow-md pointer-events-none whitespace-nowrap"
                >
                  {formatTime(hoverTime)}
                </div>
              )}

              <div className="w-full h-1 group-hover/scrub:h-1.5 bg-zinc-800/80 rounded-full transition-all overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  disabled={!canControl}
                  className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-white hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700/60 shadow-lg transition-colors"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                </button>

                {!canControl && (
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-400 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800">
                    <Lock className="w-3 h-3 text-rose-400" />
                    <span>{t('video.hostOnlyControl')}</span>
                  </div>
                )}

                <div className="text-xs font-mono text-zinc-300 tracking-wider">
                  <span className="text-white font-medium">{formatTime(currentTime)}</span>
                  <span className="text-zinc-600 mx-1.5">/</span>
                  <span className="text-zinc-400">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 group/vol">
                  <button
                    onClick={toggleMute}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
                    aria-label="Toggle mute"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-14 sm:w-20 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                    aria-label="Volume slider"
                  />
                </div>

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

                <button
                  type="button"
                  onClick={togglePiP}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
                  aria-label="Picture in picture"
                >
                  <PictureInPicture className="w-4 h-4" />
                </button>

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
