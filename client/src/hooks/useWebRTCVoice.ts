import { useEffect, useRef, useState, useCallback } from 'react';
import { wsService } from '../services/websocket.js';
import type { ServerMessage, VoiceStatus } from '../types/index.js';

interface WebRTCVoiceProps {
  myParticipantId: string;
  participantIds: string[];
  enabled: boolean;
}

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTCVoice({
  myParticipantId,
  participantIds,
  enabled
}: WebRTCVoiceProps) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('DISCONNECTED');
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isSpeakingLocally, setIsSpeakingLocally] = useState<boolean>(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getIceServers = useCallback((): RTCIceServer[] => {
    if (import.meta.env.VITE_STUN_URL) {
      return [{ urls: import.meta.env.VITE_STUN_URL.split(',') }];
    }
    return DEFAULT_STUN_SERVERS;
  }, []);

  const startAudio = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceStatus('ERROR');
      return;
    }

    try {
      setVoiceStatus('CONNECTING');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      setIsMuted(true);

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          localAnalyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
          speechIntervalRef.current = setInterval(() => {
            if (!localStreamRef.current || isMuted) {
              setIsSpeakingLocally(false);
              return;
            }
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setIsSpeakingLocally(avg > 18);
          }, 150);
        }
      } catch (err) {
        console.warn('[WEBRTC] Speaking visualizer unavailable:', err);
      }

      setVoiceStatus('CONNECTED');
    } catch (err: any) {
      console.warn('[WEBRTC] Could not access microphone:', err.message);
      setVoiceStatus('ERROR');
    }
  }, [isMuted]);

  const getOrCreatePeerConnection = useCallback((targetId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(targetId);
    if (pc && pc.connectionState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection({
      iceServers: getIceServers()
    });

    peerConnectionsRef.current.set(targetId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc!.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsService.sendMessage({
          type: 'ICE_CANDIDATE',
          target: targetId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.ontrack = (event) => {
      let audioEl = remoteAudioElementsRef.current.get(targetId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        remoteAudioElementsRef.current.set(targetId, audioEl);
      }
      audioEl.srcObject = event.streams[0];
      audioEl.play().catch((e) => console.warn('[WEBRTC] Audio play error:', e));
    };

    pc.onconnectionstatechange = () => {
      if (pc!.connectionState === 'failed' || pc!.connectionState === 'disconnected') {
        if (typeof pc!.restartIce === 'function') {
          pc!.restartIce();
        }
      }
    };

    return pc;
  }, [getIceServers]);

  const callPeer = useCallback(async (targetId: string) => {
    if (!myParticipantId || targetId === myParticipantId) return;

    try {
      const pc = getOrCreatePeerConnection(targetId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);

      wsService.sendMessage({
        type: 'WEBRTC_OFFER',
        target: targetId,
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });
    } catch (err) {
      console.error(`[WEBRTC] Error calling peer ${targetId}:`, err);
    }
  }, [myParticipantId, getOrCreatePeerConnection]);

  useEffect(() => {
    const unsubscribe = wsService.addMessageListener(async (msg: ServerMessage) => {
      if (!enabled) return;

      if (msg.type === 'WEBRTC_OFFER') {
        const { from, offer } = msg;
        try {
          const pc = getOrCreatePeerConnection(from);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          wsService.sendMessage({
            type: 'WEBRTC_ANSWER',
            target: from,
            answer: {
              type: answer.type,
              sdp: answer.sdp
            }
          });
        } catch (err) {
          console.error(`[WEBRTC] Failed to handle offer from ${from}:`, err);
        }
      } else if (msg.type === 'WEBRTC_ANSWER') {
        const { from, answer } = msg;
        try {
          const pc = peerConnectionsRef.current.get(from);
          if (pc && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } catch (err) {
          console.error(`[WEBRTC] Failed to handle answer from ${from}:`, err);
        }
      } else if (msg.type === 'ICE_CANDIDATE') {
        const { from, candidate } = msg;
        try {
          const pc = peerConnectionsRef.current.get(from);
          if (pc && candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          console.error(`[WEBRTC] Failed to add ICE candidate from ${from}:`, err);
        }
      } else if (msg.type === 'PARTICIPANT_JOINED') {
        if (myParticipantId && myParticipantId > msg.participant.id) {
          setTimeout(() => callPeer(msg.participant.id), 500);
        }
      } else if (msg.type === 'PARTICIPANT_LEFT') {
        const pc = peerConnectionsRef.current.get(msg.participantId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(msg.participantId);
        }
        const audio = remoteAudioElementsRef.current.get(msg.participantId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          remoteAudioElementsRef.current.delete(msg.participantId);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, myParticipantId, getOrCreatePeerConnection, callPeer]);

  useEffect(() => {
    if (!enabled || !myParticipantId) return;

    participantIds.forEach((targetId) => {
      if (targetId !== myParticipantId && myParticipantId > targetId) {
        if (!peerConnectionsRef.current.has(targetId)) {
          callPeer(targetId);
        }
      }
    });
  }, [enabled, participantIds, myParticipantId, callPeer]);

  useEffect(() => {
    if (enabled && voiceStatus === 'DISCONNECTED') {
      startAudio();
    }
  }, [enabled, voiceStatus, startAudio]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) {
      startAudio().then(() => {
        setIsMuted(false);
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
        }
        wsService.sendMessage({ type: 'MUTE_STATUS', isMuted: false });
      });
      return;
    }

    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);

    wsService.sendMessage({
      type: 'MUTE_STATUS',
      isMuted: nextMuted
    });
  }, [isMuted, startAudio]);

  useEffect(() => {
    return () => {
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      remoteAudioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
      });
      remoteAudioElementsRef.current.clear();
    };
  }, []);

  return {
    voiceStatus,
    isMuted,
    isSpeakingLocally,
    toggleMute,
    retryAudio: startAudio
  };
}
