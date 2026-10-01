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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-sm bg-[#111116] border border-white/10 rounded-2xl p-6 shadow-2xl text-left">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-semibold text-white tracking-tight">
          {t('inviteModal.title')}
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Share your room code or link to watch together
        </p>

        <div className="mt-4 p-3 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">
              {t('inviteModal.roomCode')}
            </span>
            <p className="text-xl font-mono font-bold tracking-wider text-white mt-0.5">
              {roomId}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-zinc-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedCode ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 text-xs">{t('inviteModal.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>{t('inviteModal.copyCode')}</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-mono text-zinc-400 truncate mb-2.5 bg-zinc-900 px-3 py-2 rounded-xl border border-white/5">
            {inviteUrl}
          </p>
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-2.5 rounded-xl font-semibold text-xs text-black bg-white hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{t('inviteModal.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t('inviteModal.copyLink')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
