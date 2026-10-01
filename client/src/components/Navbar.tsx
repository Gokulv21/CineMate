import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, Plus, LogIn, Download } from 'lucide-react';
import { Logo } from './Logo.js';
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
    <header className="sticky top-0 z-40 w-full bg-[#08080a]/85 backdrop-blur-md border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
        {/* Brand */}
        <Logo
          size="md"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {t('nav.howItWorks')}
          </button>
          <button
            onClick={() => scrollToSection('features')}
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {t('nav.features')}
          </button>
          <button
            onClick={() => scrollToSection('privacy')}
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Install CineMate App"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onJoinRoom}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5 text-zinc-400" />
            <span>{t('nav.joinRoom')}</span>
          </button>

          <button
            onClick={onCreateRoom}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-black bg-white hover:bg-zinc-200 active:scale-98 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('nav.createRoom')}</span>
          </button>
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-2">
          {!isInstalled && onInstallApp && (
            <button
              onClick={onInstallApp}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              title="Install CineMate App"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          <LanguageSelector compact />

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-[#0c0c10] px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-left py-1 text-sm font-medium text-zinc-300 hover:text-white"
            >
              {t('nav.howItWorks')}
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-left py-1 text-sm font-medium text-zinc-300 hover:text-white"
            >
              {t('nav.features')}
            </button>
            <button
              onClick={() => scrollToSection('privacy')}
              className="text-left py-1 text-sm font-medium text-zinc-300 hover:text-white"
            >
              {t('nav.privacy')}
            </button>
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onJoinRoom();
              }}
              className="w-full py-2.5 rounded-lg text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.08] flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('nav.joinRoom')}</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onCreateRoom();
              }}
              className="w-full py-2.5 rounded-lg text-xs font-semibold text-black bg-white hover:bg-zinc-200 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('nav.createRoom')}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
