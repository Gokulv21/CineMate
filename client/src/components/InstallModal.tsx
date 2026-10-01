import React from 'react';
import { Download, X, Share, PlusSquare, CheckCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-[#111116] border border-white/10 shadow-2xl p-6 relative text-left"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-semibold text-white tracking-tight">
          Install CineMate
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Open directly in full screen without browser URL bars
        </p>

        {isInstalled ? (
          <div className="py-4 text-center space-y-3">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-medium text-white">
              CineMate is installed!
            </p>
            <p className="text-xs text-zinc-400">
              You can launch it anytime from your home screen or applications menu.
            </p>
            <button
              onClick={onClose}
              className="w-full mt-2 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : isIOS ? (
          <div className="mt-4 space-y-3 text-left">
            <p className="text-xs text-zinc-300">
              Install to your iPhone or iPad home screen:
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900 border border-white/[0.06]">
                <Share className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-300">1. Tap <strong>Share</strong> in Safari</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900 border border-white/[0.06]">
                <PlusSquare className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-300">2. Tap <strong>Add to Home Screen</strong></span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-2 py-2.5 rounded-xl bg-white text-black font-semibold text-xs transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-left">
            <div className="p-3 rounded-xl bg-zinc-900 border border-white/[0.06] text-xs text-zinc-300 leading-relaxed">
              • Clean full-screen cinema view<br/>
              • Instant 1-tap launch from home screen<br/>
              • Works offline and preserves room history
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  onInstall();
                  onClose();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
              <button
                onClick={onClose}
                className="py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium border border-white/[0.08] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
