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
  Radio,
  Sparkles
} from 'lucide-react';
import { API_BASE_URL } from '../config/api.js';
import type { WatchMode, PlaybackControlMode } from '../types/index.js';

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
  const [watchMode, setWatchMode] = useState<WatchMode>('DUAL_VIEWING');
  const [playbackControl, setPlaybackControl] = useState<PlaybackControlMode>('HOST_ONLY');
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: userName.trim(),
          roomName: roomName.trim() || undefined,
          mode: watchMode,
          playbackControl
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const data = await response.json();
      setCreatedRoomId(data.roomId);
      if (data.hostParticipantId) {
        setCreatedHostParticipantId(data.hostParticipantId);
      }
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
      <div className="relative w-full max-w-lg bg-[#0e0d16]/95 border border-rose-500/25 rounded-3xl p-6 sm:p-7 shadow-[0_0_60px_rgba(225,29,72,0.22)] text-left my-auto">
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
            <div className="pr-8">
              <span className="text-[10px] font-mono font-bold tracking-widest text-rose-400 uppercase block mb-1">
                PRIVATE THEATER SETUP
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>{t('createModal.title', 'Create a Watch Room')}</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                Select your preferred watching method, then enter your details to start.
              </p>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              {/* STEP 1: SELECT WATCH MODE */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  1. Choose Watching Method
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Viewing <-> Viewing */}
                  <button
                    type="button"
                    onClick={() => setWatchMode('DUAL_VIEWING')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      watchMode === 'DUAL_VIEWING'
                        ? 'bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-transparent border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/60'
                        : 'bg-[#13111e]/70 border-white/10 hover:border-white/20 hover:bg-[#181626]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-xl ${watchMode === 'DUAL_VIEWING' ? 'bg-rose-500/25 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.5)]' : 'bg-white/10 text-zinc-400'}`}>
                          <Users className="w-4 h-4" />
                        </div>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          watchMode === 'DUAL_VIEWING' ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40' : 'bg-white/5 text-zinc-400'
                        }`}>
                          100% Raw 4K
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white tracking-tight">
                        Viewing ↔ Viewing
                      </h4>
                      <p className="text-[11px] text-zinc-300 mt-1 font-medium leading-snug">
                        Both Have Movie (Dual Sync)
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Zero quality loss</span>
                      {watchMode === 'DUAL_VIEWING' && (
                        <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,1)]" />
                      )}
                    </div>
                  </button>

                  {/* Option 2: Screening <-> Viewing */}
                  <button
                    type="button"
                    onClick={() => setWatchMode('SCREENING')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      watchMode === 'SCREENING'
                        ? 'bg-gradient-to-br from-purple-500/25 via-pink-500/10 to-transparent border-purple-500/80 shadow-[0_0_25px_rgba(168,85,247,0.35)] ring-1 ring-purple-500/60'
                        : 'bg-[#13111e]/70 border-white/10 hover:border-white/20 hover:bg-[#181626]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-xl ${watchMode === 'SCREENING' ? 'bg-purple-500/25 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.5)]' : 'bg-white/10 text-zinc-400'}`}>
                          <Tv className="w-4 h-4" />
                        </div>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          watchMode === 'SCREENING' ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40' : 'bg-white/5 text-zinc-400'
                        }`}>
                          Partner: 0 MB
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white tracking-tight">
                        Screening ↔ Viewing
                      </h4>
                      <p className="text-[11px] text-zinc-300 mt-1 font-medium leading-snug">
                        One Person Sharing (Stream)
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Only Host downloads</span>
                      {watchMode === 'SCREENING' && (
                        <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,1)]" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* DYNAMIC STEP-BY-STEP EXPLANATION BOX */}
              <div className={`p-4 rounded-2xl border text-xs leading-relaxed transition-all ${
                watchMode === 'DUAL_VIEWING'
                  ? 'bg-rose-950/25 border-rose-500/30 text-zinc-200 shadow-inner'
                  : 'bg-purple-950/25 border-purple-500/30 text-zinc-200 shadow-inner'
              }`}>
                {watchMode === 'DUAL_VIEWING' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4" />
                      <span>How "Viewing ↔ Viewing" Works (Step-by-Step):</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-zinc-300">
                      <li className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span><strong>Step 1:</strong> You and your partner both select your own copy of the movie file.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span><strong>Step 2:</strong> Zero server upload — plays directly from your device with 100% raw quality (4K, HDR, Dolby).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span><strong>Step 3:</strong> Sub-second sync — play, pause, or seek stays aligned in milliseconds.</span>
                      </li>
                    </ul>
                    <div className="pt-2 border-t border-rose-500/20 text-[10px] text-rose-300 font-medium">
                      💡 Best when both people have downloaded the movie file beforehand.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                      <Radio className="w-4 h-4" />
                      <span>Screen Share Mode (Desktop PC / Laptop):</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-zinc-300">
                      <li className="flex items-start gap-1.5">
                        <span className="text-purple-400 font-bold">•</span>
                        <span><strong>Desktop PC:</strong> Host shares browser tab or window playing the video over WebRTC.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-purple-400 font-bold">•</span>
                        <span><strong>📱 Phone Notice:</strong> Mobile browsers (Android Chrome, iOS Safari) cannot stream 2GB movie files directly. For watching on phones, use <strong>Viewing ↔ Viewing</strong>!</span>
                      </li>
                    </ul>
                    <div className="pt-2 border-t border-purple-500/20 text-[10px] text-purple-300 font-medium">
                      💡 For mobile phones, both select the movie file in "Viewing ↔ Viewing" for 100% 4K quality!
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: USER & ROOM DETAILS */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    2. Your Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name (e.g., Alex)"
                    maxLength={30}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141220] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 transition-all font-medium"
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
                    placeholder="e.g., Interstellar Movie Night 🍿"
                    maxLength={50}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141220] border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 transition-all font-medium"
                  />
                </div>

                {/* STEP 3: PLAYBACK CONTROL */}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>3. Playback Control</span>
                    <span className="text-[10px] text-zinc-400 font-normal lowercase">who can pause / seek</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPlaybackControl('HOST_ONLY')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all cursor-pointer border ${
                        playbackControl === 'HOST_ONLY'
                          ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                          : 'bg-[#141220] text-zinc-400 hover:text-white border-white/10 hover:bg-[#1a172a]'
                      }`}
                    >
                      Host Only (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaybackControl('EVERYONE')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all cursor-pointer border ${
                        playbackControl === 'EVERYONE'
                          ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                          : 'bg-[#141220] text-zinc-400 hover:text-white border-white/10 hover:bg-[#1a172a]'
                      }`}
                    >
                      Everyone (Both)
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !userName.trim()}
                  className="cinema-btn-primary w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating theater room...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        Create Room ({watchMode === 'SCREENING' ? 'Screening Mode' : 'Dual Sync Mode'})
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 mb-3 shadow-[0_0_20px_rgba(244,63,94,0.4)]">
              <Sparkles className="w-6 h-6" />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {t('createModal.readyTitle', 'Your Cinema Room is Ready!')}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Share the code or invite link with your partner to start watching.
            </p>

            {/* Room Mode Badge */}
            <div className="mt-3.5">
              <span className={`text-[11px] font-mono font-bold px-3 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                watchMode === 'SCREENING'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
              }`}>
                {watchMode === 'SCREENING' ? <Tv className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                <span>Mode: {watchMode === 'SCREENING' ? 'Screening ↔ Viewing (Host Stream)' : 'Viewing ↔ Viewing (Dual Sync)'}</span>
              </span>
            </div>

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
              className="cinema-btn-primary mt-4 w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t('createModal.enterRoom', 'Enter Room')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
