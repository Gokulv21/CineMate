import React from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle, Sparkles } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  canPromptDirectly?: boolean;
  isIOS: boolean;
  isInstalled: boolean;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  onInstall,
  isIOS,
  isInstalled
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-zinc-950 border border-emerald-900/60 shadow-2xl p-6 relative overflow-hidden"
      >
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0">
            <Smartphone className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Install CineMate App</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </h3>
            <p className="text-xs text-zinc-400">
              Run standalone without browser bars or URL entry
            </p>
          </div>
        </div>

        {isInstalled ? (
          <div className="py-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-white">
              CineMate is already installed!
            </p>
            <p className="text-xs text-zinc-400">
              You can launch it directly from your phone's Home Screen or App Drawer anytime.
            </p>
            <button
              onClick={onClose}
              className="w-full mt-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-4 text-left">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Install CineMate directly to your iPhone / iPad home screen in 3 quick steps:
            </p>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Share className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-white">1. Tap Share</span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Tap the <strong>Share</strong> button at the bottom of Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-white">2. Add to Home Screen</span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Scroll down and select <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="font-bold text-xs">3</span>
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-white">3. Tap Add</span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    Tap <strong>Add</strong> at the top right to complete installation.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              Got it!
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span>Fast 1-Tap Access</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                • Launches like a native app without browser URL bar<br/>
                • Keeps full movie screen and rotated landscape view<br/>
                • Instant room join and fast local video loading
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  onInstall();
                  onClose();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Install CineMate</span>
              </button>
              <button
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-medium border border-zinc-800 transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
