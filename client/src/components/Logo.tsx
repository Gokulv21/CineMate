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
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl'
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      {/* Simple, Elegant Minimalist Cinema Mark */}
      <div className={`relative ${iconSizes[size]} shrink-0 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center transition-all duration-200 group-hover:border-white/20 group-hover:bg-zinc-800/80 shadow-sm`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 text-white"
        >
          {/* Minimalist Dual Film Frame / Two viewers in sync */}
          <rect x="3" y="5" width="11" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
          <rect x="10" y="5" width="11" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.75" strokeOpacity="0.45" />
          {/* Subtle center shared spark / play point */}
          <polygon points="7.5,9.5 7.5,14.5 11.5,12" fill="currentColor" />
        </svg>
      </div>

      {/* Clean, Refined Wordmark */}
      <span className={`font-semibold tracking-tight text-white font-sans ${textSizes[size]}`}>
        Cine<span className="text-zinc-400 font-normal">Mate</span>
      </span>
    </div>
  );
};
