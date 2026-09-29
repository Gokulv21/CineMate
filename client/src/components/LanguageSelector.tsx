import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { changeLanguage } from '../i18n/index.js';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' }
];

interface LanguageSelectorProps {
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        aria-label="Select Language"
      >
        <Globe className="w-3.5 h-3.5 text-zinc-400" />
        <span>{compact ? currentLang.code.toUpperCase() : currentLang.native}</span>
        <ChevronDown className="w-3 h-3 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl bg-zinc-900/95 border border-zinc-700/70 shadow-2xl backdrop-blur-md py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-emerald-500/10 transition-colors"
            >
              <div className="flex flex-col">
                <span className="font-medium">{lang.native}</span>
                <span className="text-[10px] text-zinc-500">{lang.label}</span>
              </div>
              {i18n.language === lang.code && (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
