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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-sm bg-[#111116] border border-white/10 rounded-2xl p-6 shadow-2xl text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label={t('settings.close')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Sliders className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              {t('settings.title')}
            </h3>
            {!isHost && (
              <p className="text-[11px] text-zinc-500">
                Only the host can modify room settings
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-zinc-900 border border-white/[0.06]">
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              {t('settings.playbackControl')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateSettings({ playbackControl: 'HOST_ONLY' })}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all ${
                  settings.playbackControl === 'HOST_ONLY'
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                } ${!isHost && 'opacity-60 cursor-not-allowed'}`}
              >
                {t('settings.hostOnly')}
              </button>
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onUpdateSettings({ playbackControl: 'EVERYONE' })}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all ${
                  settings.playbackControl === 'EVERYONE'
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                } ${!isHost && 'opacity-60 cursor-not-allowed'}`}
              >
                {t('settings.everyone')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-white" />
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
              className="w-4 h-4 accent-white rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Mic className="w-4 h-4 text-white" />
              <p className="text-xs font-medium text-zinc-200">{t('settings.voiceChat')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.voiceChat}
              onChange={(e) => onUpdateSettings({ voiceChat: e.target.checked })}
              className="w-4 h-4 accent-white rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-white" />
              <p className="text-xs font-medium text-zinc-200">{t('settings.chat')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.chatEnabled}
              onChange={(e) => onUpdateSettings({ chatEnabled: e.target.checked })}
              className="w-4 h-4 accent-white rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-white" />
              <p className="text-xs font-medium text-zinc-200">{t('settings.reactions')}</p>
            </div>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={settings.reactionsEnabled}
              onChange={(e) => onUpdateSettings({ reactionsEnabled: e.target.checked })}
              className="w-4 h-4 accent-white rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-white/[0.06]">
            <p className="text-xs font-medium text-zinc-200">{t('settings.language')}</p>
            <LanguageSelector />
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-xs font-semibold text-black transition-colors cursor-pointer shadow-sm"
          >
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
