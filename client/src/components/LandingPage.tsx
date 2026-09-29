import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Heart, 
  Play, 
  ShieldCheck, 
  Mic, 
  Zap, 
  Sparkles, 
  ArrowRight, 
  FileVideo, 
  Users, 
  Lock
} from 'lucide-react';
import { LanguageSelector } from './LanguageSelector.js';

interface LandingPageProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onCreateRoom, onJoinRoom }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-medium text-rose-300 mb-8 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>{t('hero.badge')}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1] max-w-4xl mx-auto">
            {t('hero.title')}
          </h1>

          <p className="mt-6 text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onCreateRoom}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-xl shadow-rose-600/25 border border-rose-500/40 hover:shadow-rose-600/40 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Heart className="w-5 h-5 fill-white" />
              <span>{t('hero.createButton')}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
            <button
              onClick={onJoinRoom}
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users className="w-5 h-5 text-zinc-400" />
              <span>{t('hero.joinButton')}</span>
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{t('brand.privacyBadge')}</span>
          </div>

          {/* Hero Visual Mockup */}
          <div className="mt-16 max-w-4xl mx-auto rounded-2xl cinema-surface border border-zinc-800 p-4 sm:p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-xs font-medium text-zinc-400">CineMate Private Room • AB7XK9</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Synced (0.02s)
                </span>
              </div>
            </div>

            <div className="relative aspect-video rounded-xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black overflow-hidden flex flex-col justify-between p-6 border border-zinc-800/60 my-4">
              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-md shadow-lg">
                  <div className="w-7 h-7 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-xs font-bold">
                    A
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white leading-tight">User A</p>
                    <p className="text-[10px] text-zinc-400">Tokyo • Local Video</p>
                  </div>
                  <Mic className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                </div>

                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-md shadow-lg">
                  <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <div className="text-right">
                    <p className="text-xs font-semibold text-white leading-tight">User B</p>
                    <p className="text-[10px] text-zinc-400">London • Local Video</p>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center text-xs font-bold">
                    B
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center my-auto z-10">
                <div className="w-16 h-16 rounded-2xl bg-rose-600/10 border border-rose-500/30 flex items-center justify-center shadow-2xl relative group">
                  <Play className="w-7 h-7 text-rose-400 fill-rose-400 ml-1" />
                  <div className="absolute -inset-1 rounded-2xl bg-rose-500/20 blur-md -z-10 animate-pulse" />
                </div>
                <p className="text-xs text-zinc-400 font-medium mt-3">Interstellar (2014) • 01:24:32 / 02:49:00</p>
              </div>

              <div className="z-10 bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 backdrop-blur-md">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5">
                  <span className="text-rose-400 font-semibold">01:24:32</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">❤️ 😂 🔥</span>
                  </div>
                  <span>02:49:00</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 w-[50%] rounded-full relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-zinc-950/60 border-y border-zinc-800/60 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {t('howItWorks.title')}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 relative">
              <span className="text-4xl font-black font-mono text-rose-500/20 mb-3 block">01</span>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('howItWorks.step1Title')}</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{t('howItWorks.step1Desc')}</p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 relative">
              <span className="text-4xl font-black font-mono text-rose-500/20 mb-3 block">02</span>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <FileVideo className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('howItWorks.step2Title')}</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{t('howItWorks.step2Desc')}</p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 relative">
              <span className="text-4xl font-black font-mono text-rose-500/20 mb-3 block">03</span>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Heart className="w-5 h-5 fill-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('howItWorks.step3Title')}</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{t('howItWorks.step3Desc')}</p>
            </div>
          </div>

          <div className="mt-12 p-5 rounded-2xl bg-zinc-900/60 border border-rose-500/20 flex items-center justify-center gap-3 text-center">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-xs sm:text-sm text-zinc-300 font-medium">
              {t('howItWorks.privacyNote')}
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {t('features.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('features.syncTitle')}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('features.syncDesc')}</p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Mic className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('features.voiceTitle')}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('features.voiceDesc')}</p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('features.privacyTitle')}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('features.privacyDesc')}</p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('features.reactionsTitle')}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{t('features.reactionsDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer id="privacy" className="mt-auto border-t border-zinc-800/80 py-12 bg-zinc-950 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span className="text-base font-bold text-white tracking-tight">CineMate</span>
            </div>
            <p className="text-xs text-zinc-400 max-w-sm">
              {t('footer.description')}
            </p>
            <p className="text-[11px] text-zinc-500 mt-2 max-w-md">
              {t('footer.privacyStatement')}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <LanguageSelector />
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-zinc-900 text-center">
          <p className="text-[11px] text-zinc-600">
            {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
};
