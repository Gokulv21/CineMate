import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
  onClick
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7 sm:w-8 sm:h-8',
    lg: 'w-9 h-9 sm:w-10 sm:h-10'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl'
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      {/* Raw Cinema Emblem (No bounding box / cards) */}
      <svg
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} shrink-0 transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]`}
      >
        <defs>
          <linearGradient id="cm-raw-grad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f43f5e" />
            <stop offset="0.6" stopColor="#e11d48" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {/* Twin Intertwined Film Reels (Representing Dual Sync / Watching Together) */}
        <circle cx="10" cy="14" r="8" stroke="url(#cm-raw-grad)" strokeWidth="2.2" />
        <circle cx="18" cy="14" r="8" stroke="url(#cm-raw-grad)" strokeWidth="2.2" strokeOpacity="0.8" />
        {/* Film reel accents */}
        <circle cx="7" cy="14" r="1.2" fill="#f43f5e" />
        <circle cx="21" cy="14" r="1.2" fill="#a855f7" />
        {/* Play Glyph in Core */}
        <path d="M12.5 10.5L18.5 14L12.5 17.5V10.5Z" fill="url(#cm-raw-grad)" />
      </svg>

      {/* Brand Title with "Private Theatre" Subtitle */}
      <div className="flex flex-col text-left leading-none">
        <div className={`font-black tracking-tight font-sans ${textSizes[size]} flex items-center`}>
          <span className="text-white">Cine</span>
          <span className="bg-gradient-to-r from-rose-500 via-pink-400 to-violet-400 bg-clip-text text-transparent">
            Mate
          </span>
        </div>
        <span className="text-[7.5px] sm:text-[8.5px] font-bold tracking-[0.24em] uppercase text-rose-400/90 mt-1">
          Private Theatre
        </span>
      </div>
    </div>
  );
};
