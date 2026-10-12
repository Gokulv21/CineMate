import React from 'react';
import logoImg from '../assets/Designer.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
  onClick,
  showText = true
}) => {
  const iconSizes = {
    sm: 'w-7 h-7 sm:w-8 sm:h-8 rounded-xl',
    md: 'w-8 h-8 sm:w-9 sm:h-9 rounded-xl',
    lg: 'w-11 h-11 sm:w-12 sm:h-12 rounded-2xl',
    xl: 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl'
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      {/* Official CineMate Brand Emblem */}
      <img
        src={logoImg}
        alt="CineMate"
        className={`${iconSizes[size]} shrink-0 object-contain shadow-[0_0_20px_rgba(244,63,94,0.35)] transition-transform duration-300 group-hover:scale-105 border border-white/10`}
      />

      {/* Brand Title with "Private Theatre" Subtitle */}
      {showText && (
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
      )}
    </div>
  );
};
