import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Copy, 
  Check, 
  ArrowRight, 
  Loader2, 
  ShieldCheck, 
  Sparkles,
  Sliders
} from 'lucide-react';
import { API_BASE_URL } from '../config/api.js';
import type { PlaybackControlMode } from '../types/index.js';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string, userName: string, hostParticipantId?: string) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated
}) => {
  const { t } = useTranslation();
  const [playbackControl, setPlaybackControl] = useState<PlaybackControlMode>('HOST_ONLY');
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Creating room...');
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdHostParticipantId, setCreatedHostParticipantId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    setIsLoading(true);
    setError(null);
    setLoadingMessage('Creating room...');

    // If waiting for more than 3.5s, inform the user about server cold start
    const coldStartTimer = setTimeout(() => {
      setLoadingMessage('Waking up server... (cold start)');
    }, 3500);

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: userName.trim(),
          roomName: roomName.trim() || undefined,
          mode: 'DUAL_VIEWING',
          playbackControl
        }),
        signal: controller.signal
      });

      clearTimeout(coldStartTimer);
      clearTimeout(timeoutTimer);

      if (!response.ok) {
        let errMsg = 'Failed to create room';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      setCreatedRoomId(data.roomId);
      if (data.hostParticipantId) {
        setCreatedHostParticipantId(data.hostParticipantId);
        // Persist host token in sessionStorage
        sessionStorage.setItem(`cinemate_host_${data.roomId}`, data.hostParticipantId);
        sessionStorage.setItem(`cinemate_user_${data.roomId}`, userName.trim());
      }
    } catch (err: any) {
      clearTimeout(coldStartTimer);
      clearTimeout(timeoutTimer);
      console.error('Room creation error:', err);

      if (err.name === 'AbortError') {
        setError('Server connection timed out (25s). If running locally, please start the backend server with "npm run dev". If on Render, the free-tier backend may still be waking up.');
      } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        setError('Cannot connect to CineMate backend server. Please make sure the backend is running on port 4000 or check your connection.');
      } else {
        setError(err.message || 'Something went wrong');
      }
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
      onRoomCreated(createdRoomId, userName.trim(), createdHostParticipantId || undefined);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md bg-[#0e0d16]/95 border border-rose-500/25 rounded-3xl p-6 sm:p-7 shadow-[0_0_60px_rgba(225,29,72,0.22)] text-left my-auto">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-20 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {!createdRoomId ? (
          <div>
            {/* Header */}
            <div className="pr-8 mb-5">
              <span className="text-[10px] font-mono font-bold tracking-widest text-rose-400 uppercase block mb-1">
                PRIVATE THEATER
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>{t('createModal.title', 'Create a Watch Room')}</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                Enter your details to create a private synchronized room.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Your Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name (e.g. Gokul)"
                  maxLength={30}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141220] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-rose-500/50 transition-all font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Room Name <span className="text-zinc-500 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Leo Movie Night 🍿"
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141220] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-rose-500/50 transition-all font-medium"
                />
              </div>

              {/* Playback Control Permission */}
              <div className="p-3 rounded-2xl bg-[#141220]/90 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Sliders className="w-3.5 h-3.5 text-rose-400" />
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Playback Control
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlaybackControl('HOST_ONLY')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      playbackControl === 'HOST_ONLY'
                        ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                        : 'bg-[#181628] text-zinc-400 hover:text-white border-white/10'
                    }`}
                  >
                    Host Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaybackControl('EVERYONE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      playbackControl === 'EVERYONE'
                        ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                        : 'bg-[#181628] text-zinc-400 hover:text-white border-white/10'
                    }`}
                  >
                    Everyone (Both)
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">
                  {playbackControl === 'HOST_ONLY'
                    ? 'Only you (Host) can play, pause, or seek.'
                    : 'Both you and your partner can play, pause, and seek.'}
                </p>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !userName.trim()}
                  className="cinema-btn-primary w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_25px_rgba(244,63,94,0.3)]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>{loadingMessage}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Create Watch Room</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-1 text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                <span>Zero server storage • P2P private sync</span>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 mb-3 shadow-[0_0_20px_rgba(244,63,94,0.4)]">
              <Sparkles className="w-6 h-6" />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {t('createModal.readyTitle', 'Your Room is Ready!')}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 font-medium">
              Share the code or invite link with your partner to start watching together.
            </p>

            {/* Room Code Display Box */}
            <div className="mt-4 p-4 rounded-2xl bg-[#141220] border border-rose-500/30 flex items-center justify-between shadow-[0_0_25px_rgba(225,29,72,0.15)]">
              <div>
                <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">
                  {t('createModal.roomCodeLabel', 'Room Code')}
                </span>
                <p className="text-2xl font-mono font-black tracking-widest text-white mt-0.5">
                  {createdRoomId}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">{t('createModal.copied', 'Copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-rose-400" />
                    <span>{t('createModal.copyCode', 'Copy Code')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Invite link button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="mt-3 w-full py-2.5 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t('createModal.copied', 'Link Copied!')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t('createModal.copyLink', 'Copy Invite Link')}</span>
                </>
              )}
            </button>

            {/* Enter Room button */}
            <button
              type="button"
              onClick={handleEnterRoom}
              className="cinema-btn-primary mt-4 w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(244,63,94,0.4)]"
            >
              <span>{t('createModal.enterRoom', 'Enter Theater')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
