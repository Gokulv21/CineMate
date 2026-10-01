import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, ArrowRight, Loader2 } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-sm bg-[#111116] border border-white/10 rounded-2xl p-6 shadow-2xl text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {!createdRoomId ? (
          <div>
            <h3 className="text-lg font-semibold text-white tracking-tight">
              {t('createModal.title')}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {t('createModal.subtitle')}
            </p>

            {error && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  {t('createModal.nameLabel')} <span className="text-zinc-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={t('createModal.namePlaceholder')}
                  maxLength={30}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white/30 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  {t('createModal.roomNameLabel')}
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder={t('createModal.roomNamePlaceholder')}
                  maxLength={50}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white/30 transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !userName.trim()}
                  className="w-full py-2.5 rounded-xl font-semibold text-xs text-black bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('createModal.submitButton')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('createModal.submitButton')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold text-white tracking-tight">
              {t('createModal.readyTitle')}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {t('createModal.readySubtitle')}
            </p>

            {/* Room Code Display Box */}
            <div className="mt-4 p-3.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-zinc-500 block">
                  {t('createModal.roomCodeLabel')}
                </span>
                <p className="text-xl font-mono font-bold tracking-wider text-white mt-0.5">
                  {createdRoomId}
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
                    <span className="text-emerald-400 text-xs">{t('createModal.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{t('createModal.copyCode')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Invite link button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="mt-2.5 w-full py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t('createModal.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('createModal.copyLink')}</span>
                </>
              )}
            </button>

            {/* Enter Room button */}
            <button
              type="button"
              onClick={handleEnterRoom}
              className="mt-3.5 w-full py-2.5 rounded-xl font-semibold text-xs text-black bg-white hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>{t('createModal.enterRoom')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
