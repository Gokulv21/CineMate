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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-sm bg-[#0e0d16]/95 border border-rose-500/25 rounded-3xl p-6 sm:p-7 shadow-[0_0_60px_rgba(225,29,72,0.22)] text-left">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-36 h-16 bg-rose-500/25 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <span className="text-[10px] font-mono font-bold tracking-widest text-rose-400 uppercase block mb-1">
          JOIN PRIVATE SCREENING
        </span>
        <h3 className="text-xl font-black text-white tracking-tight">
          Join a Room
        </h3>
        <p className="text-xs text-zinc-400 mt-1 font-medium">
          Enter the 6-character room code to join your partner.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">
              Room Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB7XK9"
              maxLength={8}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141220] border border-white/10 text-white font-mono font-black text-base tracking-widest uppercase placeholder-zinc-600 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 transition-all text-center"
              autoFocus={!initialRoomCode}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">
              Your Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Sarah"
              maxLength={30}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141220] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 transition-all font-medium"
              autoFocus={!!initialRoomCode}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !roomCode.trim() || !userName.trim()}
              className="cinema-btn-primary w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to theater...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
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
