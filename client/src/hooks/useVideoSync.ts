import { useEffect, useRef, useCallback } from 'react';
import { wsService } from '../services/websocket.js';
import type { ServerMessage, PlaybackState } from '../types/index.js';

interface UseVideoSyncProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isHost: boolean;
  canControl: boolean;
  autoSyncEnabled: boolean;
  initialPlayback?: PlaybackState;
}

export function useVideoSync({
  videoRef,
  isHost,
  canControl,
  autoSyncEnabled,
  initialPlayback
}: UseVideoSyncProps) {
  const isRemoteUpdateRef = useRef<boolean>(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rateResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !initialPlayback) return;

    if (Math.abs(video.currentTime - initialPlayback.position) > 0.5) {
      isRemoteUpdateRef.current = true;
      video.currentTime = initialPlayback.position;
    }

    if (initialPlayback.isPlaying && video.paused) {
      isRemoteUpdateRef.current = true;
      video.play().catch(() => {
        console.warn('[SYNC] Autoplay prevented, waiting for user interaction');
      });
    } else if (!initialPlayback.isPlaying && !video.paused) {
      isRemoteUpdateRef.current = true;
      video.pause();
    }
  }, [initialPlayback, videoRef]);

  useEffect(() => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);

    if (isHost && autoSyncEnabled) {
      syncIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.paused || isSeekingRef.current) return;

        wsService.sendMessage({
          type: 'SYNC_PING',
          position: video.currentTime,
          isPlaying: !video.paused,
          timestamp: Date.now()
        });
      }, 3000);
    }

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isHost, autoSyncEnabled, videoRef]);

  useEffect(() => {
    const unsubscribe = wsService.addMessageListener((msg: ServerMessage) => {
      const video = videoRef.current;
      if (!video) return;

      switch (msg.type) {
        case 'PLAY': {
          isRemoteUpdateRef.current = true;
          const elapsed = Math.max(0, (Date.now() - msg.serverTime) / 1000);
          const targetTime = msg.position + elapsed;

          if (Math.abs(video.currentTime - targetTime) > 0.4) {
            video.currentTime = targetTime;
          }

          video.play().catch((err) => {
            console.warn('[SYNC] Play failed (browser autoplay restriction):', err);
          });
          break;
        }

        case 'PAUSE': {
          isRemoteUpdateRef.current = true;
          video.currentTime = msg.position;
          video.pause();
          break;
        }

        case 'SEEK': {
          isRemoteUpdateRef.current = true;
          video.currentTime = msg.position;
          break;
        }

        case 'SYNC_CORRECTION': {
          if (isHost || !autoSyncEnabled) return;

          const elapsed = Math.max(0, (Date.now() - msg.serverTime) / 1000);
          const expectedPos = msg.isPlaying ? msg.position + elapsed : msg.position;
          const diff = expectedPos - video.currentTime;
          const absDiff = Math.abs(diff);

          if (msg.isPlaying && video.paused) {
            isRemoteUpdateRef.current = true;
            video.play().catch(() => {});
          } else if (!msg.isPlaying && !video.paused) {
            isRemoteUpdateRef.current = true;
            video.pause();
          }

          if (absDiff < 0.25) {
            if (video.playbackRate !== 1.0) {
              video.playbackRate = 1.0;
            }
          } else if (absDiff <= 1.0) {
            const newRate = diff > 0 ? 1.06 : 0.94;
            video.playbackRate = newRate;

            if (rateResetTimeoutRef.current) clearTimeout(rateResetTimeoutRef.current);
            rateResetTimeoutRef.current = setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.playbackRate = 1.0;
              }
            }, 2000);
          } else {
            isRemoteUpdateRef.current = true;
            video.currentTime = expectedPos;
            video.playbackRate = 1.0;
          }
          break;
        }
      }
    });

    return () => {
      unsubscribe();
      if (rateResetTimeoutRef.current) clearTimeout(rateResetTimeoutRef.current);
    };
  }, [videoRef, isHost, autoSyncEnabled]);

  const triggerPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !canControl) return;

    video.play().catch((err) => console.warn('[SYNC] Play error:', err));
    wsService.sendMessage({
      type: 'PLAY',
      position: video.currentTime,
      timestamp: Date.now()
    });
  }, [canControl, videoRef]);

  const triggerPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || !canControl) return;

    video.pause();
    wsService.sendMessage({
      type: 'PAUSE',
      position: video.currentTime
    });
  }, [canControl, videoRef]);

  const triggerSeek = useCallback((targetPosition: number) => {
    const video = videoRef.current;
    if (!video || !canControl) return;

    video.currentTime = targetPosition;
    wsService.sendMessage({
      type: 'SEEK',
      position: targetPosition
    });
  }, [canControl, videoRef]);

  const triggerReplay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !canControl) return;

    video.currentTime = 0;
    video.play().catch(() => {});
    wsService.sendMessage({
      type: 'SEEK',
      position: 0
    });
    wsService.sendMessage({
      type: 'PLAY',
      position: 0,
      timestamp: Date.now()
    });
  }, [canControl, videoRef]);

  const handleLocalPlay = useCallback(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    if (!canControl) {
      videoRef.current?.pause();
      return;
    }
    const video = videoRef.current;
    if (video) {
      wsService.sendMessage({
        type: 'PLAY',
        position: video.currentTime,
        timestamp: Date.now()
      });
    }
  }, [canControl, videoRef]);

  const handleLocalPause = useCallback(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    if (!canControl) {
      videoRef.current?.play().catch(() => {});
      return;
    }
    const video = videoRef.current;
    if (video) {
      wsService.sendMessage({
        type: 'PAUSE',
        position: video.currentTime
      });
    }
  }, [canControl, videoRef]);

  const handleLocalSeeking = useCallback(() => {
    isSeekingRef.current = true;
  }, []);

  const handleLocalSeeked = useCallback(() => {
    isSeekingRef.current = false;
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    if (!canControl) return;
    const video = videoRef.current;
    if (video) {
      wsService.sendMessage({
        type: 'SEEK',
        position: video.currentTime
      });
    }
  }, [canControl, videoRef]);

  return {
    triggerPlay,
    triggerPause,
    triggerSeek,
    triggerReplay,
    eventHandlers: {
      onPlay: handleLocalPlay,
      onPause: handleLocalPause,
      onSeeking: handleLocalSeeking,
      onSeeked: handleLocalSeeked
    }
  };
}
