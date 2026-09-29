import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config/api.js';

interface JoinRoomModalProps {
  isOpen: boolean;
  initialRoomCode?: string;
  onClose: () => void;
  onJoinRoom: (roomId: string, userName: string) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  initialRoomCode = '',
  onClose,
  onJoinRoom
}) => {
  const { t } = useTranslation();
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode.toUpperCase());
    }
  }, [initialRoomCode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = userName.trim();

    if (!cleanCode || !cleanName) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate that room exists
      const response = await fetch(`${API_BASE_URL}/api/rooms/${cleanCode}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError(t('joinModal.notFound'));
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to verify room');
      }

      onJoinRoom(cleanCode, cleanName);
      onClose();
    } catch (err: any) {
      console.error('Join room error:', err);
      setError(t('joinModal.notFound'));
    } finally {
      setIsLoading(false);
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
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <LogIn className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {t('joinModal.title')}
            </h3>
            <p className="text-xs text-zinc-400">
              {t('joinModal.subtitle')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              {t('joinModal.roomCodeLabel')} <span className="text-emerald-500">*</span>
            </label>
            <input
              type="text"
              required
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder={t('joinModal.roomCodePlaceholder')}
              maxLength={8}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-700/80 text-white font-mono tracking-widest uppercase placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              autoFocus={!initialRoomCode}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              {t('joinModal.nameLabel')} <span className="text-emerald-500">*</span>
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t('joinModal.namePlaceholder')}
              maxLength={30}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              autoFocus={!!initialRoomCode}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !roomCode.trim() || !userName.trim()}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('joinModal.submitButton')}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{t('joinModal.submitButton')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
