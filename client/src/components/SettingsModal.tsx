import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sliders, Zap, Mic, MessageSquare, Sparkles } from 'lucide-react';
import type { RoomSettings, WatchMode } from '../types/index.js';
import { LanguageSelector } from './LanguageSelector.js';

interface SettingsModalProps {
  isOpen: boolean;
  isHost: boolean;
  settings: RoomSettings;
  mode?: WatchMode;
  onClose: () => void;
  onUpdateSettings: (newSettings: Partial<RoomSettings>) => void;
  onUpdateMode?: (mode: WatchMode) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  isHost,
  settings,
  mode = 'DUAL_VIEWING',
  onClose,
  onUpdateSettings,
  onUpdateMode
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-sm bg-[#0e0d16]/95 border border-rose-500/20 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
          aria-label={t('settings.close')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-violet-500/20 border border-rose-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.2)]">
            <Sliders className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {t('settings.title')}
            </h3>
            {!isHost && (
              <p className="text-[11px] text-zinc-500">
                Only the host can modify room settings
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          {/* Watch Mode Selector */}
          <div className="p-3 rounded-xl bg-[#141220]/80 border border-white/[0.08]">
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Theater Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateMode?.('DUAL_VIEWING')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                  mode !== 'SCREENING'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-950/60 font-bold'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/5'
                } ${!isHost && 'opacity-60 cursor-not-allowed'}`}
              >
                Dual Viewing
              </button>
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateMode?.('SCREENING')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                  mode === 'SCREENING'
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md shadow-purple-950/60 font-bold'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/5'
                } ${!isHost && 'opacity-60 cursor-not-allowed'}`}
              >
                Screening (1-Way)
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1.5">
              {mode === 'SCREENING'
                ? 'Host streams video to partner; partner needs 0 MB download.'
                : 'Both partners choose local video file; sub-second playback sync.'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#141220]/80 border border-white/[0.08]">
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              {t('settings.playbackControl')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateSettings({ playbackControl: 'HOST_ONLY' })}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                  settings.playbackControl === 'HOST_ONLY'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-950/60 font-bold'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/5'
                } ${!isHost && 'opacity-60 cursor-not-allowed'}`}
              >
                {t('settings.hostOnly')}
              </button>
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateSettings({ playbackControl: 'EVERYONE' })}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                  settings.playbackControl === 'EVERYONE'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-950/60 font-bold'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/5'
                } ${!isHost && 'opacity-60 cursor-not-allowed'}`}
              >
                {t('settings.everyone')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#141220]/80 border border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-rose-400" />
              <div>
                <p className="text-xs font-medium text-zinc-200">{t('settings.autoSync')}</p>
                <p className="text-[10px] text-zinc-500">Auto speed & seek alignment</p>
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.autoSync}
              onChange={(e) => onUpdateSettings({ autoSync: e.target.checked })}
              className="w-4 h-4 accent-rose-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#141220]/80 border border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <Mic className="w-4 h-4 text-violet-400" />
              <p className="text-xs font-medium text-zinc-200">{t('settings.voiceChat')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.voiceChat}
              onChange={(e) => onUpdateSettings({ voiceChat: e.target.checked })}
              className="w-4 h-4 accent-rose-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#141220]/80 border border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-rose-400" />
              <p className="text-xs font-medium text-zinc-200">{t('settings.chat')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.chatEnabled}
              onChange={(e) => onUpdateSettings({ chatEnabled: e.target.checked })}
              className="w-4 h-4 accent-rose-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#141220]/80 border border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-medium text-zinc-200">{t('settings.reactions')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.reactionsEnabled}
              onChange={(e) => onUpdateSettings({ reactionsEnabled: e.target.checked })}
              className="w-4 h-4 accent-rose-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#141220]/80 border border-white/[0.08]">
            <p className="text-xs font-medium text-zinc-200">{t('settings.language')}</p>
            <LanguageSelector />
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 hover:from-rose-500 hover:to-violet-500 text-xs font-bold text-white transition-all cursor-pointer shadow-lg shadow-rose-950/40"
          >
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
