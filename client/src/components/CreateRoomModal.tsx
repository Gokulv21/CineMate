import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, ArrowRight, Film, Heart, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config/api.js';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string, userName: string) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated
}) => {
  const { t } = useTranslation();
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: userName.trim(),
          roomName: roomName.trim() || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const data = await response.json();
      setCreatedRoomId(data.roomId);
    } catch (err: any) {
      console.error('Room creation error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const inviteUrl = createdRoomId
    ? `${window.location.origin}?room=${createdRoomId}`
    : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const handleCopyCode = async () => {
    if (!createdRoomId) return;
    try {
      await navigator.clipboard.writeText(createdRoomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const handleEnterRoom = () => {
    if (createdRoomId && userName.trim()) {
      onRoomCreated(createdRoomId, userName.trim());
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-2xl overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {!createdRoomId ? (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Heart className="w-5 h-5 text-emerald-500 fill-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {t('createModal.title')}
                </h3>
                <p className="text-xs text-zinc-400">
                  {t('createModal.subtitle')}
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  {t('createModal.nameLabel')} <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={t('createModal.namePlaceholder')}
                  maxLength={30}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  {t('createModal.roomNameLabel')}
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder={t('createModal.roomNamePlaceholder')}
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !userName.trim()}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('createModal.submitButton')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('createModal.submitButton')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="text-center py-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-3">
                <Heart className="w-6 h-6 text-emerald-500 fill-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {t('createModal.readyTitle')}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {t('createModal.readySubtitle')}
              </p>
            </div>

            {/* Room Code Display Box */}
            <div className="mt-5 p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
                  {t('createModal.roomCodeLabel')}
                </span>
                <p className="text-2xl font-mono font-bold tracking-widest text-emerald-400">
                  {createdRoomId}
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
                    <span className="text-emerald-400">{t('createModal.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t('createModal.copyCode')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Invite link button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="mt-3 w-full py-2.5 rounded-xl border border-zinc-700/80 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">{t('createModal.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-zinc-400" />
                  <span>{t('createModal.copyLink')}</span>
                </>
              )}
            </button>

            {/* Enter Room button */}
            <button
              type="button"
              onClick={handleEnterRoom}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <Film className="w-4 h-4" />
              <span>{t('createModal.enterRoom')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
