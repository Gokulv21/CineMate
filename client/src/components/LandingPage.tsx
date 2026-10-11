import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Zap,
  Volume2,
  FileVideo,
  ShieldCheck,
  Download,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Sparkles,
  Film,
  Lock,
  Radio,
  Sliders
} from 'lucide-react';
import { Logo } from './Logo.js';
import { LanguageSelector } from './LanguageSelector.js';

interface LandingPageProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onInstallApp?: () => void;
  isInstalled?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onCreateRoom,
  onJoinRoom,
  onInstallApp,
  isInstalled = false
}) => {
  const { t } = useTranslation();

  // Smart Feature Slides about the 2 Watch Modes & Capabilities
  const slides = [
    {
      id: 1,
      badge: 'Mode 01 • Dual Viewing (Local Sync)',
      title: 'Both have the movie? Play in frame-perfect sync',
      description: 'Both you and your partner choose the same movie file locally from your devices. Playback, pause, and seek stay aligned in milliseconds with 0 MB server upload.',
      icon: HardDrive,
      visual: (
        <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center">
          <div className="p-5 rounded-2xl bg-[#141220]/90 border border-rose-500/30 max-w-sm w-full shadow-[0_0_30px_rgba(225,29,72,0.15)] text-left relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">DUAL VIEWING</span>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Synced: 0.00ms
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-950/40">
                <FileVideo className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Movie_4K_TrueHD.mp4</p>
                <p className="text-[11px] text-zinc-400">Direct Device Playback • Zero Upload</p>
              </div>
            </div>
            <div className="mt-3.5 p-2.5 rounded-xl bg-black/50 border border-white/[0.08] text-[11px] text-zinc-300 flex items-center justify-between">
              <span className="text-zinc-400">Host: 01:24:10</span>
              <span className="text-rose-400 font-bold">⇄</span>
              <span className="text-zinc-400">Partner: 01:24:10</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 2,
      badge: 'Mode 02 • Screening Mode (1-Person Stream)',
      title: 'Only 1 person has the movie? Stream live to partner',
      description: 'Host selects the movie and streams audio & video directly to their partner over encrypted WebRTC. Your partner needs 0 MB download — they just sit back and watch live!',
      icon: Radio,
      visual: (
        <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center">
          <div className="p-5 rounded-2xl bg-[#141220]/90 border border-purple-500/30 max-w-sm w-full shadow-[0_0_30px_rgba(168,85,247,0.15)] text-left relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40">SCREENING ↔ VIEWING</span>
              <span className="text-[10px] font-mono text-purple-400 font-bold">0 MB for Partner</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-950/40">
                <Radio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Host Streaming Live</p>
                <p className="text-[11px] text-purple-300">Partner watching live stream</p>
              </div>
            </div>
            <div className="mt-3.5 p-2.5 rounded-xl bg-black/50 border border-white/[0.08] text-[11px] text-zinc-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="font-semibold text-purple-200">100% Peer-to-Peer • Instant Playback</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      badge: 'Step 03 • Audio Tracks & Subtitles',
      title: 'Multi-language audio & external subtitles',
      description: 'Switch between separate audio files (Tamil, English, etc.) and drop in .SRT or .VTT subtitles directly into the cinema player at any time.',
      icon: Film,
      visual: (
        <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center">
          <div className="p-5 rounded-2xl bg-[#141220]/90 border border-rose-500/30 max-w-sm w-full shadow-[0_0_30px_rgba(225,29,72,0.15)]">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span className="font-bold text-white">Language & Audio</span>
              <span className="text-rose-400 font-mono text-[11px] font-bold">Tamil / Dual Audio</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-black/50 border border-rose-500/30">
                <span className="text-[10px] text-rose-400 font-bold block">AUDIO TRACK</span>
                <span className="font-mono text-white text-[11px] font-bold">Tamil (Stereo)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/50 border border-white/[0.08]">
                <span className="text-[10px] text-zinc-400 font-bold block">SUBTITLES</span>
                <span className="font-mono text-white text-[11px] font-bold">English (.srt)</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 4,
      badge: 'Step 04 • Intimate Theater',
      title: 'WebRTC voice chat & live reactions',
      description: 'Talk naturally with studio-grade peer-to-peer audio and react with live emojis without needing Discord, Zoom, or third-party calling apps.',
      icon: Volume2,
      visual: (
        <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center">
          <div className="p-5 rounded-2xl bg-[#141220]/90 border border-purple-500/30 max-w-sm w-full shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <div className="flex items-center justify-around py-2">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)]">
                  <Volume2 className="w-5 h-5" />
                </div>
                <span className="text-xs text-white font-bold mt-1.5">You</span>
                <span className="text-[10px] text-rose-400 font-medium">Speaking</span>
              </div>
              <div className="w-8 h-[2px] bg-gradient-to-r from-rose-500 to-purple-500 rounded-full" />
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 border-2 border-purple-500/60 flex items-center justify-center text-purple-300">
                  <Volume2 className="w-5 h-5" />
                </div>
                <span className="text-xs text-white font-bold mt-1.5">Partner</span>
                <span className="text-[10px] text-zinc-400">Listening</span>
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-white/[0.08] flex items-center justify-center gap-3 text-lg">
              <span className="hover:scale-125 transition-transform cursor-pointer">💚</span>
              <span className="hover:scale-125 transition-transform cursor-pointer">🍿</span>
              <span className="hover:scale-125 transition-transform cursor-pointer">😂</span>
              <span className="hover:scale-125 transition-transform cursor-pointer">🔥</span>
              <span className="hover:scale-125 transition-transform cursor-pointer">👏</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance slides every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => setCurrentSlide((currentSlide + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((currentSlide - 1 + slides.length) % slides.length);

  return (
    <div className="flex flex-col min-h-screen">

      {/* Hero Header Section */}
      <section className="pt-14 pb-10 md:pt-20 md:pb-16 px-4 sm:px-6 max-w-5xl mx-auto text-center relative">

        {/* Cinematic Headline with Gradient & Glow */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white leading-[1.05] max-w-4xl mx-auto font-sans">
          Watch Movies Together. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(244,63,94,0.4)]">
            Perfect Sync. Zero Cloud.
          </span>
        </h1>

        {/* Clear, Engaging Subtitle */}
        <p className="mt-6 text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed font-normal">
          Experience your movies with your partner or friends in synchronized 4K. Dual file sync or 1-person screening stream, built-in encrypted voice chat, and 100% privacy.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onCreateRoom}
            className="cinema-btn-primary w-full sm:w-auto px-8 py-4 rounded-2xl text-base flex items-center justify-center gap-3 cursor-pointer group"
          >
            <Sparkles className="w-5 h-5 text-rose-200 group-hover:rotate-12 transition-transform" />
            <span>Create Watch Room</span>
            <ArrowRight className="w-5 h-5 text-rose-200 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onJoinRoom}
            className="cinema-btn-secondary w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 cursor-pointer shadow-lg"
          >
            <span>Join with Code</span>
          </button>
        </div>

        {/* Made by Zevox branding in Hero */}
        <p className="mt-7 text-xs text-zinc-400 font-medium">
          A product by{' '}
          <a
            href="https://zevox-website.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-rose-400 hover:text-rose-300 underline underline-offset-4 transition-colors"
          >
            ZEVOX
          </a>
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% Private (P2P)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>Dual Sync & Screening</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span>Zero Sign-Up Required</span>
          </span>
        </div>

      </section>

      {/* Smart Sliding Pictures / Carousel Showcase */}
      <section className="px-4 sm:px-6 pb-24 max-w-4xl mx-auto w-full">
        <div className="cinema-surface relative rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_50px_rgba(225,29,72,0.12)]">

          {/* Slide Content Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[340px]">
            {/* Left: Text & Info */}
            <div className="p-7 sm:p-10 flex flex-col justify-between text-left">
              <div>
                <span className="text-xs font-mono uppercase font-bold text-rose-400 tracking-wider block mb-2.5">
                  {slides[currentSlide].badge}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  {slides[currentSlide].title}
                </h3>
                <p className="mt-3.5 text-sm text-zinc-300 leading-relaxed font-normal">
                  {slides[currentSlide].description}
                </p>
              </div>

              {/* Slide Controls & Dots */}
              <div className="mt-8 flex items-center justify-between pt-5 border-t border-white/[0.08]">
                <div className="flex items-center gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${index === currentSlide
                        ? 'w-8 bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                        : 'w-2 bg-white/20 hover:bg-white/40'
                        }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={prevSlide}
                    className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Visual Graphic Preview for Slide */}
            <div className="bg-[#0a0914] border-t md:border-t-0 md:border-l border-white/[0.08] flex items-center justify-center p-4">
              {slides[currentSlide].visual}
            </div>
          </div>

        </div>

        {/* Quick App Install option */}
        {!isInstalled && onInstallApp && (
          <div className="mt-6 text-center">
            <button
              onClick={onInstallApp}
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]"
            >
              <Download className="w-3.5 h-3.5 text-rose-400" />
              <span>Install CineMate as standalone App</span>
            </button>
          </div>
        )}
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 border-t border-white/[0.08] bg-[#090812]/90 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest block mb-2">
              HOW IT WORKS
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
              {t('howItWorks.title')}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-lg mx-auto">
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="cinema-card rounded-3xl p-7 text-left relative overflow-hidden group">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-mono font-black text-sm mb-5 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                01
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
                {t('howItWorks.step1Title')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
                {t('howItWorks.step1Desc')}
              </p>
            </div>

            <div className="cinema-card rounded-3xl p-7 text-left relative overflow-hidden group">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-mono font-black text-sm mb-5 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                02
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
                {t('howItWorks.step2Title')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
                {t('howItWorks.step2Desc')}
              </p>
            </div>

            <div className="cinema-card rounded-3xl p-7 text-left relative overflow-hidden group">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 font-mono font-black text-sm mb-5 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                03
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
                {t('howItWorks.step3Title')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
                {t('howItWorks.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 border-t border-white/[0.08] relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest block mb-2">
              WHY CINEMATE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
              {t('features.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Feature 1: Dual Sync & Screening */}
            <div className="cinema-card rounded-3xl p-7 text-left">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-rose-950/50">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2 tracking-tight">
                {t('features.dualModesTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                {t('features.dualModesDesc')}
              </p>
            </div>

            {/* Feature 2: Frame-Perfect Sync */}
            <div className="cinema-card rounded-3xl p-7 text-left">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-600 to-violet-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-rose-950/50">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2 tracking-tight">
                {t('features.syncTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                {t('features.syncDesc')}
              </p>
            </div>

            {/* Feature 3: WebRTC Voice Chat */}
            <div className="cinema-card rounded-3xl p-7 text-left">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-violet-950/50">
                <Volume2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2 tracking-tight">
                {t('features.voiceTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                {t('features.voiceDesc')}
              </p>
            </div>

            {/* Feature 4: Multi-Audio & Subtitles */}
            <div className="cinema-card rounded-3xl p-7 text-left">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-purple-950/50">
                <FileVideo className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2 tracking-tight">
                {t('features.audioSubsTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                {t('features.audioSubsDesc')}
              </p>
            </div>

            {/* Feature 5: Host & Shared Playback Controls */}
            <div className="cinema-card rounded-3xl p-7 text-left">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-violet-950/50">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2 tracking-tight">
                {t('features.controlsTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                {t('features.controlsDesc')}
              </p>
            </div>

            {/* Feature 6: 100% P2P Privacy */}
            <div className="cinema-card rounded-3xl p-7 text-left">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-emerald-950/50">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2 tracking-tight">
                {t('features.privacyTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
                {t('features.privacyDesc')}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 border-t border-white/[0.08] bg-gradient-to-b from-[#0e0c18] to-[#08070d] text-center px-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            Ready for your movie night?
          </h2>
          <p className="mt-3 text-base text-zinc-300">
            Create a private theater room in seconds and share the code with your partner.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={onCreateRoom}
              className="cinema-btn-primary px-9 py-4 rounded-2xl text-base flex items-center gap-3 cursor-pointer shadow-xl shadow-rose-950/50"
            >
              <Sparkles className="w-5 h-5" />
              <span>Start a Room Now</span>
            </button>
          </div>
        </div>
      </section>

      {/* Minimal Sleek Footer */}
      <footer id="privacy" className="mt-auto border-t border-white/[0.08] py-12 bg-[#06050a] px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <Logo size="sm" />
            <span className="hidden sm:inline text-xs text-zinc-600">•</span>
            <p className="text-xs text-zinc-400">
              Developed by{' '}
              <a
                href="https://zevox-website.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text--400 hover:text-rose-300 underline underline-offset-4 transition-colors"
              >
                ZEVOX
              </a>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-6 pt-4 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p className="text-[11px] text-zinc-500">
            © {new Date().getFullYear()} CineMate • A product of{' '}
            <a
              href="https://zevox-website.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white underline font-semibold transition-colors"
            >
              Zevox
            </a>
          </p>
          <p className="text-[11px] text-zinc-500">
            100% Peer-to-Peer • No media stored on servers
          </p>
        </div>
      </footer>

    </div>
  );
};
