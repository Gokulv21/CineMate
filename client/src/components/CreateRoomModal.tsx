import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Copy, 
  Check, 
  ArrowRight, 
  Loader2, 
  Users, 
  Tv, 
  ShieldCheck, 
  Radio 
} from 'lucide-react';
import { API_BASE_URL } from '../config/api.js';
import type { WatchMode } from '../types/index.js';

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
  const [watchMode, setWatchMode] = useState<WatchMode>('DUAL_VIEWING');
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
          roomName: roomName.trim() || undefined,
          mode: watchMode
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg bg-[#111116] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl text-left my-auto">
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
            {/* Header */}
            <div className="pr-8">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>{t('createModal.title', 'Create a Watch Room')}</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Select your preferred watching method, then enter your details to start.
              </p>
            </div>

            {error && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {/* STEP 1: SELECT WATCH MODE */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  1. Choose Watching Method
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Viewing <-> Viewing */}
                  <button
                    type="button"
                    onClick={() => setWatchMode('DUAL_VIEWING')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      watchMode === 'DUAL_VIEWING'
                        ? 'bg-emerald-500/10 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
                        : 'bg-zinc-900/60 border-white/10 hover:border-white/20 hover:bg-zinc-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={`p-1.5 rounded-lg ${watchMode === 'DUAL_VIEWING' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-zinc-400'}`}>
                          <Users className="w-4 h-4" />
                        </div>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          watchMode === 'DUAL_VIEWING' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-zinc-400'
                        }`}>
                          100% Raw 4K
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                        Viewing ↔ Viewing
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                        Both Have Movie (Dual Sync)
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Zero quality loss</span>
                      {watchMode === 'DUAL_VIEWING' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      )}
                    </div>
                  </button>

                  {/* Option 2: Screening <-> Viewing */}
                  <button
                    type="button"
                    onClick={() => setWatchMode('SCREENING')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      watchMode === 'SCREENING'
                        ? 'bg-sky-500/10 border-sky-500/70 shadow-[0_0_20px_rgba(14,165,233,0.15)] ring-1 ring-sky-500/50'
                        : 'bg-zinc-900/60 border-white/10 hover:border-white/20 hover:bg-zinc-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={`p-1.5 rounded-lg ${watchMode === 'SCREENING' ? 'bg-sky-500/20 text-sky-400' : 'bg-white/10 text-zinc-400'}`}>
                          <Tv className="w-4 h-4" />
                        </div>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          watchMode === 'SCREENING' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-white/5 text-zinc-400'
                        }`}>
                          Partner: 0 MB
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                        Screening ↔ Viewing
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                        One Person Sharing (Stream)
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Only Host downloads</span>
                      {watchMode === 'SCREENING' && (
                        <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* DYNAMIC STEP-BY-STEP EXPLANATION BOX */}
              <div className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all ${
                watchMode === 'DUAL_VIEWING'
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-300'
                  : 'bg-sky-950/20 border-sky-500/30 text-zinc-300'
              }`}>
                {watchMode === 'DUAL_VIEWING' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                      <ShieldCheck className="w-4 h-4" />
                      <span>How "Viewing ↔ Viewing" Works (Step-by-Step):</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-zinc-300">
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span><strong>Step 1:</strong> You and your partner both select your own copy of the movie file.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span><strong>Step 2:</strong> Zero server upload — plays directly from your device with 100% raw quality (4K, HDR, Dolby).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span><strong>Step 3:</strong> Sub-second sync — play, pause, or seek stays aligned in milliseconds.</span>
                      </li>
                    </ul>
                    <div className="pt-1.5 border-t border-emerald-500/20 text-[10px] text-emerald-300 font-medium">
                      💡 Best when both people have downloaded the movie file beforehand.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-xs">
                      <Radio className="w-4 h-4" />
                      <span>How "Screening ↔ Viewing" Works (Step-by-Step):</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-zinc-300">
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400 font-bold">•</span>
                        <span><strong>Step 1:</strong> Only you (Host) need the movie file downloaded on your device.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400 font-bold">•</span>
                        <span><strong>Step 2:</strong> Host screens/streams the movie in real-time to partner via encrypted P2P WebRTC.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400 font-bold">•</span>
                        <span><strong>Step 3:</strong> Partner downloads 0 MB — watches live stream directly in CineMate (~1080p HD).</span>
                      </li>
                    </ul>
                    <div className="pt-1.5 border-t border-sky-500/20 text-[10px] text-sky-300 font-medium">
                      💡 Best when your partner has no space or hasn't downloaded the movie (Host needs ~5 Mbps upload speed).
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: USER & ROOM DETAILS */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    2. Your Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name (e.g., Alex)"
                    maxLength={30}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white/30 transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Room Name <span className="text-zinc-500 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g., Interstellar Movie Night 🍿"
                    maxLength={50}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white/30 transition-all"
                  />
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !userName.trim()}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs text-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                    watchMode === 'SCREENING'
                      ? 'bg-sky-400 hover:bg-sky-300'
                      : 'bg-white hover:bg-zinc-200'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating room...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        Create Room ({watchMode === 'SCREENING' ? 'Screening ↔ Viewing' : 'Viewing ↔ Viewing'})
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {t('createModal.readyTitle', 'Your Room is Ready!')}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Share the code or invite link with your partner to start watching.
            </p>

            {/* Room Mode Badge */}
            <div className="mt-3">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                watchMode === 'SCREENING'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {watchMode === 'SCREENING' ? <Tv className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                <span>Mode: {watchMode === 'SCREENING' ? 'Screening ↔ Viewing (Host Stream)' : 'Viewing ↔ Viewing (Dual Sync)'}</span>
              </span>
            </div>

            {/* Room Code Display Box */}
            <div className="mt-3.5 p-3.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-zinc-500 block">
                  {t('createModal.roomCodeLabel', 'Room Code')}
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
                    <span className="text-emerald-400 text-xs">{t('createModal.copied', 'Copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{t('createModal.copyCode', 'Copy Code')}</span>
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
                  <span className="text-emerald-400">{t('createModal.copied', 'Link Copied!')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('createModal.copyLink', 'Copy Invite Link')}</span>
                </>
              )}
            </button>

            {/* Enter Room button */}
            <button
              type="button"
              onClick={handleEnterRoom}
              className="mt-3.5 w-full py-2.5 rounded-xl font-bold text-xs text-black bg-white hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>{t('createModal.enterRoom', 'Enter Room')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
