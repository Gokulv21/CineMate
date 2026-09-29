import React from 'react';
import type { FloatingReaction } from '../types/index.js';

interface ReactionOverlayProps {
  reactions: FloatingReaction[];
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          style={{
            left: `${reaction.xOffsetPercent}%`,
            bottom: '15%'
          }}
          className="absolute animate-float-up flex flex-col items-center select-none"
        >
          <span className="text-4xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] transform hover:scale-125 transition-transform">
            {reaction.emoji}
          </span>
          <span className="text-[10px] font-bold text-zinc-300 bg-zinc-950/80 px-2 py-0.5 rounded-full border border-zinc-700/60 mt-1 shadow-md">
            {reaction.senderName}
          </span>
        </div>
      ))}
    </div>
  );
};
