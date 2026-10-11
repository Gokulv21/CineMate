import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  roomId: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  roomId,
  onClose
}) => {
  const { t } = useTranslation();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const inviteUrl = `${window.location.origin}?room=${roomId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Copy link error:', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Copy code error:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-sm bg-[#0e0d16]/95 border border-rose-500/25 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-white tracking-tight">
          {t('inviteModal.title')}
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Share your room code or link to watch together
        </p>

        <div className="mt-4 p-3.5 rounded-xl bg-[#141220]/90 border border-rose-500/30 flex items-center justify-between shadow-[0_0_20px_rgba(244,63,94,0.1)]">
          <div>
            <span className="text-[10px] uppercase font-mono text-rose-400 font-bold block">
              {t('inviteModal.roomCode')}
            </span>
            <p className="text-2xl font-mono font-black tracking-widest text-white mt-0.5">
              {roomId}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-xs">{t('inviteModal.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t('inviteModal.copyCode')}</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-3.5">
          <p className="text-[11px] font-mono text-zinc-400 truncate mb-3 bg-[#141220]/70 px-3 py-2 rounded-xl border border-white/5">
            {inviteUrl}
          </p>
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-rose-600 via-rose-500 to-violet-600 hover:from-rose-500 hover:to-violet-500 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-950/50 active:scale-95"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>{t('inviteModal.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{t('inviteModal.copyLink')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
