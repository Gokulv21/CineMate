import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Heart } from 'lucide-react';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Heart className="w-5 h-5 text-emerald-500 fill-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {t('inviteModal.title')}
            </h3>
            <p className="text-xs text-zinc-400">
              Share this with your partner to watch together
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 mb-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
              {t('inviteModal.roomCode')}
            </span>
            <p className="text-2xl font-mono font-bold tracking-widest text-emerald-400">
              {roomId}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">{t('inviteModal.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t('inviteModal.copyCode')}</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 mb-5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 block mb-1">
            {t('inviteModal.inviteLink')}
          </span>
          <p className="text-xs font-mono text-zinc-300 truncate mb-3 bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800">
            {inviteUrl}
          </p>
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
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
