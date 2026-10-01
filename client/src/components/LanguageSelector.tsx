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
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 transition-all text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/40 cursor-pointer"
        aria-label="Select Language"
      >
        <Globe className="w-3.5 h-3.5 text-zinc-400" />
        <span>{compact ? currentLang.code.toUpperCase() : currentLang.native}</span>
        <ChevronDown className="w-3 h-3 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-2xl cinema-card border border-white/10 shadow-2xl backdrop-blur-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-semibold">{lang.native}</span>
                <span className="text-[10px] text-zinc-500">{lang.label}</span>
              </div>
              {i18n.language === lang.code && (
                <Check className="w-3.5 h-3.5 text-rose-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
