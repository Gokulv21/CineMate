import React from 'react';
import type { FloatingReaction } from '../types/index.js';

interface ReactionOverlayProps {
  reactions: FloatingReaction[];
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {reactions.map((reaction) => {
        const isGreenHeart = reaction.emoji === '💚';
        return (
          <div
            key={reaction.id}
            style={{
              left: `${reaction.xOffsetPercent}%`,
              bottom: '18%'
            }}
            className="absolute animate-float-up flex flex-col items-center select-none pointer-events-none z-30"
          >
            <span
              className={`text-4xl sm:text-5xl transform transition-transform ${
                isGreenHeart
                  ? 'filter drop-shadow-[0_0_20px_rgba(16,185,129,0.9)] scale-110'
                  : 'filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]'
              }`}
            >
              {reaction.emoji}
            </span>
            <span className="text-[10px] font-bold text-emerald-300 bg-zinc-950/90 px-2.5 py-0.5 rounded-full border border-emerald-500/40 mt-1 shadow-lg backdrop-blur-md">
              {reaction.senderName}
            </span>
          </div>
        );
      })}
    </div>
  );
};
