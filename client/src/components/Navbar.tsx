import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Menu, X, PlusCircle, LogIn, Download } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector.js';

interface NavbarProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onInstallApp?: () => void;
  isInstalled?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onCreateRoom, 
  onJoinRoom, 
  onInstallApp,
  isInstalled = false
}) => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full cinema-surface border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/20">
            <Heart className="w-5 h-5 text-emerald-500 fill-emerald-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              CineMate
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {t('nav.howItWorks')}
          </button>
          <button
            onClick={() => scrollToSection('features')}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {t('nav.features')}
          </button>
          <button
            onClick={() => scrollToSection('privacy')}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {t('nav.privacy')}
          </button>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSelector />

          {!isInstalled && onInstallApp && (
            <button
              onClick={onInstallApp}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-800/50 hover:border-emerald-500/50 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Install CineMate as standalone App"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Install App</span>
            </button>
          )}

          <button
            onClick={onJoinRoom}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-900/30 hover:border-emerald-700/50 transition-all flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-400" />
            {t('nav.joinRoom')}
          </button>
          <button
            onClick={onCreateRoom}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 border border-emerald-500/50 hover:shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {t('nav.createRoom')}
          </button>
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-2">
          {!isInstalled && onInstallApp && (
            <button
              onClick={onInstallApp}
              className="p-1.5 rounded-lg text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 flex items-center gap-1 text-xs font-medium"
              title="Install CineMate App"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">App</span>
            </button>
          )}

          <LanguageSelector compact />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-zinc-300" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800/80 bg-[#071610]/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-3 animate-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col space-y-2 pt-1">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-900"
            >
              {t('nav.howItWorks')}
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-900"
            >
              {t('nav.features')}
            </button>
            <button
              onClick={() => scrollToSection('privacy')}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-900"
            >
              {t('nav.privacy')}
            </button>
          </div>
          <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2">
            {!isInstalled && onInstallApp && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onInstallApp();
                }}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-800/60 flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Install CineMate App (PWA)</span>
              </button>
            )}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onJoinRoom();
              }}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-emerald-400" />
              {t('nav.joinRoom')}
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onCreateRoom();
              }}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              {t('nav.createRoom')}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

