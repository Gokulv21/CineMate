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
  Share2,
  Users,
  HardDrive,
  Clock
} from 'lucide-react';
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

  // Smart Feature Slides about the App & Usage
  const slides = [
    {
      id: 1,
      badge: 'Step 01 • Instant Setup',
      title: 'Create a private room in 1 tap',
      description: 'Start a room and get an instant 6-letter room code or direct invite link. No account creation, email, or passwords required.',
      icon: Users,
      visual: (
        <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] max-w-sm w-full shadow-lg">
            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">YOUR PRIVATE ROOM</span>
            <p className="text-3xl font-mono font-bold tracking-widest text-white mt-1">#AB7XK9</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <Share2 className="w-3.5 h-3.5 text-zinc-300" />
              <span>Share link with your partner</span>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
              <span>Status: Waiting for partner</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>
      )
    },
    {
      id: 2,
      badge: 'Step 02 • True Local Privacy',
      title: 'Pick any video directly from your device',
      description: 'Each person selects their own video file (MP4, MKV, WebM). The file stays on your computer and is never uploaded to any cloud server.',
      icon: HardDrive,
      visual: (
        <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] max-w-sm w-full shadow-lg text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center text-white shrink-0">
                <FileVideo className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">Interstellar_1080p.mkv</p>
                <p className="text-[11px] text-zinc-500">2.4 GB • Local Storage</p>
              </div>
            </div>
            <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/[0.04] text-[11px] text-zinc-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero server upload • 100% private</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      badge: 'Step 03 • Frame-Perfect Harmony',
      title: 'Sub-second real-time playback sync',
      description: 'When either person plays, pauses, or seeks, both screens stay aligned within milliseconds using continuous clock drift correction.',
      icon: Clock,
      visual: (
        <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] max-w-sm w-full shadow-lg">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span className="font-semibold text-white">Playback Timeline</span>
              <span className="text-emerald-400 font-mono text-[11px]">Sync Drift: 0.01s</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden relative">
              <div className="h-full bg-white w-2/3 rounded-full" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">YOU</span>
                <span className="font-mono text-zinc-200">01:24:32</span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block">PARTNER</span>
                <span className="font-mono text-zinc-200">01:24:32</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 4,
      badge: 'Step 04 • Intimate Cinema',
      title: 'Built-in voice chat & reactions',
      description: 'Talk naturally with low-latency WebRTC audio and react with live emojis without needing Discord, Zoom, or third-party voice apps.',
      icon: Volume2,
      visual: (
        <div className="w-full h-full flex flex-col justify-center items-center p-6 text-center">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] max-w-sm w-full shadow-lg">
            <div className="flex items-center justify-around py-2">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs text-white">
                  G
                </div>
                <span className="text-[11px] text-zinc-300 mt-1">Gokul</span>
                <span className="text-[9px] text-emerald-400">Speaking</span>
              </div>
              <div className="flex gap-1 items-center">
                <span className="w-1 h-3 bg-white/60 rounded-full animate-pulse" />
                <span className="w-1 h-5 bg-white rounded-full animate-pulse" />
                <span className="w-1 h-2 bg-white/60 rounded-full animate-pulse" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs text-white">
                  S
                </div>
                <span className="text-[11px] text-zinc-300 mt-1">Partner</span>
                <span className="text-[9px] text-zinc-500">Listening</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-center gap-2 text-sm">
              <span>❤️</span>
              <span>🍿</span>
              <span>😂</span>
              <span>🔥</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance slides every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => setCurrentSlide((currentSlide + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((currentSlide - 1 + slides.length) % slides.length);

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* Hero Header Section */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16 px-4 sm:px-6 max-w-4xl mx-auto text-center">
        
        {/* Simple Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-zinc-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Local video sync • WebRTC voice • 100% private</span>
        </div>

        {/* Clean, Confident Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.1] max-w-3xl mx-auto font-sans">
          Watch movies together, <br className="hidden sm:inline" />
          <span className="text-zinc-400">in perfect sync.</span>
        </h1>

        {/* Crisp Subtitle */}
        <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Enjoy your personal video files with friends or a partner. Sub-second synchronization and built-in voice chat — your movies never touch any server.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onCreateRoom}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold text-black bg-white hover:bg-zinc-200 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <span>Start a Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onJoinRoom}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-medium text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] active:scale-98 transition-all flex items-center justify-center cursor-pointer"
          >
            <span>Join with Code</span>
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          No registration or uploads required • 100% free
        </p>

      </section>

      {/* Smart Sliding Pictures / Carousel Showcase */}
      <section className="px-4 sm:px-6 pb-20 max-w-4xl mx-auto w-full">
        <div className="relative rounded-2xl bg-[#0e0e13] border border-white/[0.08] overflow-hidden shadow-2xl">
          
          {/* Slide Content Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[320px]">
            {/* Left: Text & Info */}
            <div className="p-6 sm:p-8 flex flex-col justify-between text-left">
              <div>
                <span className="text-[11px] font-mono uppercase font-semibold text-zinc-400 block mb-2">
                  {slides[currentSlide].badge}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                  {slides[currentSlide].title}
                </h3>
                <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {slides[currentSlide].description}
                </p>
              </div>

              {/* Slide Controls & Dots */}
              <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        index === currentSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/20 hover:bg-white/40'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={prevSlide}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Visual Graphic Preview for Slide */}
            <div className="bg-[#09090d] border-t md:border-t-0 md:border-l border-white/[0.06] flex items-center justify-center">
              {slides[currentSlide].visual}
            </div>
          </div>

        </div>

        {/* Quick App Install option */}
        {!isInstalled && onInstallApp && (
          <div className="mt-6 text-center">
            <button
              onClick={onInstallApp}
              className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>Install CineMate as standalone App</span>
            </button>
          </div>
        )}
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 border-t border-white/[0.06] bg-[#0a0a0e]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {t('howItWorks.title')}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="clean-card rounded-2xl p-6 text-left">
              <span className="text-xs font-mono font-semibold text-zinc-500 block mb-3">01</span>
              <h3 className="text-base font-semibold text-white mb-2">
                {t('howItWorks.step1Title')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {t('howItWorks.step1Desc')}
              </p>
            </div>

            <div className="clean-card rounded-2xl p-6 text-left">
              <span className="text-xs font-mono font-semibold text-zinc-500 block mb-3">02</span>
              <h3 className="text-base font-semibold text-white mb-2">
                {t('howItWorks.step2Title')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {t('howItWorks.step2Desc')}
              </p>
            </div>

            <div className="clean-card rounded-2xl p-6 text-left">
              <span className="text-xs font-mono font-semibold text-zinc-500 block mb-3">03</span>
              <h3 className="text-base font-semibold text-white mb-2">
                {t('howItWorks.step3Title')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {t('howItWorks.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {t('features.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            <div className="clean-card rounded-2xl p-6 text-left">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white mb-4">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">
                {t('features.syncTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {t('features.syncDesc')}
              </p>
            </div>

            <div className="clean-card rounded-2xl p-6 text-left">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white mb-4">
                <Volume2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">
                {t('features.voiceTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {t('features.voiceDesc')}
              </p>
            </div>

            <div className="clean-card rounded-2xl p-6 text-left">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white mb-4">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">
                {t('features.privacyTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {t('features.privacyDesc')}
              </p>
            </div>

            <div className="clean-card rounded-2xl p-6 text-left">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white mb-4">
                <FileVideo className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">
                Custom Subtitles & Formats
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Load local .SRT or .VTT subtitles, switch aspect ratios (16:9, 21:9 ultrawide), and enjoy full resolution with zero compression.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Simple Call to Action */}
      <section className="py-16 border-t border-white/[0.06] bg-[#0a0a0e] text-center px-4">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Ready to watch together?
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Create a private room in seconds and share the code with your partner.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={onCreateRoom}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-black bg-white hover:bg-zinc-200 active:scale-98 transition-all cursor-pointer shadow-sm"
            >
              Start a Room Now
            </button>
          </div>
        </div>
      </section>

      {/* Clean Minimal Footer */}
      <footer id="privacy" className="mt-auto border-t border-white/[0.06] py-10 bg-[#08080a] px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">CineMate</span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-500">{t('footer.description')}</span>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-6 pt-4 border-t border-white/[0.04] text-center sm:text-left">
          <p className="text-[11px] text-zinc-500">
            {t('footer.privacyStatement')}
          </p>
        </div>
      </footer>

    </div>
  );
};
