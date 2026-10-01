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

        <h3 className="text-lg font-semibold text-white tracking-tight">
          Join a Room
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Enter the 6-character room code to join
        </p>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Room Code <span className="text-zinc-500">*</span>
            </label>
            <input
              type="text"
              required
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB7XK9"
              maxLength={8}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white font-mono tracking-wider uppercase placeholder-zinc-500 text-sm focus:outline-none focus:border-white/30 transition-all"
              autoFocus={!initialRoomCode}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Your Name <span className="text-zinc-500">*</span>
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Sarah"
              maxLength={30}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white/30 transition-all"
              autoFocus={!!initialRoomCode}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !roomCode.trim() || !userName.trim()}
              className="w-full py-2.5 rounded-xl font-semibold text-xs text-black bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Join Room</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
