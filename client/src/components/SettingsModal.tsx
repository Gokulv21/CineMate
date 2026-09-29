import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sliders, Zap, Mic, MessageSquare, Sparkles } from 'lucide-react';
import type { RoomSettings } from '../types/index.js';
import { LanguageSelector } from './LanguageSelector.js';

interface SettingsModalProps {
  isOpen: boolean;
  isHost: boolean;
  settings: RoomSettings;
  onClose: () => void;
  onUpdateSettings: (newSettings: Partial<RoomSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  isHost,
  settings,
  onClose,
  onUpdateSettings
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label={t('settings.close')}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {t('settings.title')}
            </h3>
            {!isHost && (
              <p className="text-[11px] text-zinc-500">
                Only the host can modify room settings
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              {t('settings.playbackControl')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateSettings({ playbackControl: 'HOST_ONLY' })}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                  settings.playbackControl === 'HOST_ONLY'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                } ${!isHost && 'opacity-60 cursor-not-allowed'}`}
              >
                {t('settings.hostOnly')}
              </button>
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateSettings({ playbackControl: 'EVERYONE' })}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                  settings.playbackControl === 'EVERYONE'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                } ${!isHost && 'opacity-60 cursor-not-allowed'}`}
              >
                {t('settings.everyone')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-zinc-200">{t('settings.autoSync')}</p>
                <p className="text-[10px] text-zinc-500">Auto speed & seek alignment</p>
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.autoSync}
              onChange={(e) => onUpdateSettings({ autoSync: e.target.checked })}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Mic className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-semibold text-zinc-200">{t('settings.voiceChat')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.voiceChat}
              onChange={(e) => onUpdateSettings({ voiceChat: e.target.checked })}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <p className="text-xs font-semibold text-zinc-200">{t('settings.chat')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.chatEnabled}
              onChange={(e) => onUpdateSettings({ chatEnabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-semibold text-zinc-200">{t('settings.reactions')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.reactionsEnabled}
              onChange={(e) => onUpdateSettings({ reactionsEnabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <p className="text-xs font-semibold text-zinc-200">{t('settings.language')}</p>
            <LanguageSelector />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
          >
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
