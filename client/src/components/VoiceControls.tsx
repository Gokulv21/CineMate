import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Volume2, Crown, Radio } from 'lucide-react';
import type { Participant, VoiceStatus } from '../types/index.js';

interface VoiceControlsProps {
  participants: Participant[];
  currentParticipantId: string;
  voiceStatus: VoiceStatus;
  isMuted: boolean;
  isSpeakingLocally: boolean;
  remoteSpeakingPeers?: string[];
  onToggleMute: () => void;
  onRetryVoice: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  participants,
  currentParticipantId,
  voiceStatus,
  isMuted,
  isSpeakingLocally,
  remoteSpeakingPeers = [],
  onToggleMute,
  onRetryVoice
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800/80 p-3 shadow-xl flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <h3 className="text-xs font-bold text-white tracking-wide uppercase">
            {t('voice.title')}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          {voiceStatus === 'CONNECTED' ? (
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              {t('voice.connected')}
            </span>
          ) : voiceStatus === 'CONNECTING' ? (
            <span className="text-amber-400 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              {t('voice.connecting')}
            </span>
          ) : (
            <button
              onClick={onRetryVoice}
              className="text-rose-400 hover:text-emerald-400 underline transition-colors cursor-pointer"
            >
              {t('voice.unavailable')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {participants.map((p) => {
          const isMe = p.id === currentParticipantId;
          const isSpeaking = isMe ? isSpeakingLocally : (remoteSpeakingPeers.includes(p.id) || p.isSpeaking);
          const userMuted = isMe ? isMuted : p.isMuted;

          return (
            <div
              key={p.id}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold transition-all ${
                      isSpeaking
                        ? 'ring-2 ring-emerald-400 bg-emerald-500/30 text-emerald-200'
                        : isMe
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  {isSpeaking && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-ping" />
                  )}
                </div>

                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {p.name} {isMe && `(${t('chat.you')})`}
                  </span>
                  {p.isHost && (
                    <span className="shrink-0 text-[8px] font-bold tracking-wider px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                      <Crown className="w-2.5 h-2.5" />
                      HOST
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isSpeaking && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
                    <Volume2 className="w-3 h-3" />
                    <span className="hidden sm:inline">{t('voice.speaking')}</span>
                  </span>
                )}

                {userMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-zinc-500" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onToggleMute}
        className={`w-full py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
          isMuted
            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
        }`}
      >
        {isMuted ? (
          <>
            <MicOff className="w-3.5 h-3.5 text-rose-400" />
            <span>{t('voice.unmute')}</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" />
            <span>{t('voice.mute')}</span>
          </>
        )}
      </button>
    </div>
  );
};
