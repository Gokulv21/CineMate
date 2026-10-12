import React from 'react';
import { DualViewingPlayer, type DualViewingPlayerProps } from './DualViewingPlayer.js';
import { ScreeningPlayer } from './ScreeningPlayer.js';
import type { WatchMode } from '../types/index.js';

export type VideoPlayerProps = DualViewingPlayerProps & {
  roomMode?: WatchMode;
  remoteStream?: MediaStream | null;
  onStartScreeningStream?: (stream: MediaStream) => void;
  onStopScreeningStream?: () => void;
};

export const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  if (props.roomMode === 'SCREENING') {
    return <ScreeningPlayer {...props} />;
  }
  return <DualViewingPlayer {...props} />;
};

export { DualViewingPlayer, ScreeningPlayer };
