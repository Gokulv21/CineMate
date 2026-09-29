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
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export function useWebRTCVoice({
  myParticipantId,
  participantIds,
  enabled
}: WebRTCVoiceProps) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('DISCONNECTED');
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const isMutedRef = useRef<boolean>(true);
  isMutedRef.current = isMuted;

  const [isSpeakingLocally, setIsSpeakingLocally] = useState<boolean>(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getIceServers = useCallback((): RTCIceServer[] => {
    if (import.meta.env.VITE_STUN_URL) {
      return [{ urls: import.meta.env.VITE_STUN_URL.split(',') }];
    }
    return DEFAULT_STUN_SERVERS;
  }, []);

  // Drain and apply queued early ICE candidates once remote description is set
  const drainIceCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current.get(peerId);
    if (!queue || queue.length === 0) return;

    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn(`[WEBRTC] Failed to apply drained ICE candidate for ${peerId}:`, err);
      }
    }
    pendingCandidatesRef.current.delete(peerId);
  }, []);

  // Synchronize local audio track into all existing peer connections
  const attachTrackToPeerConnections = useCallback((track: MediaStreamTrack) => {
    peerConnectionsRef.current.forEach((pc) => {
      const senders = pc.getSenders();
      const audioSender = senders.find(s => !s.track || s.track.kind === 'audio');
      if (audioSender) {
        audioSender.replaceTrack(track).catch((err) => {
          console.warn('[WEBRTC] replaceTrack failed:', err);
        });
      } else {
        try {
          if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current);
          }
        } catch (err) {
          console.warn('[WEBRTC] addTrack failed:', err);
        }
      }
    });
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

      // Sync initial muted state on the hardware tracks
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
      });

      // Crucial: Seamlessly push mic track to all peer connections already created
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        attachTrackToPeerConnections(audioTrack);
      }

      // Voice activity detector
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
          speechIntervalRef.current = setInterval(() => {
            if (!localStreamRef.current || isMutedRef.current) {
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
  }, [attachTrackToPeerConnections]);

  const getOrCreatePeerConnection = useCallback((targetId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(targetId);
    if (pc && pc.connectionState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection({
      iceServers: getIceServers()
    });

    peerConnectionsRef.current.set(targetId, pc);

    // Pre-allocate audio transceiver with sendrecv. This guarantees the SDP contains an audio m-line
    // even if mic permissions are still pending on mobile!
    const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });

    // If local mic track is already active, attach it right now
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        transceiver.sender.replaceTrack(audioTrack).catch(() => {});
      }
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
        audioEl = document.createElement('audio');
        audioEl.id = `remote-audio-${targetId}`;
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        remoteAudioElementsRef.current.set(targetId, audioEl);
      }

      if (event.streams && event.streams[0]) {
        audioEl.srcObject = event.streams[0];
      } else if (event.track) {
        audioEl.srcObject = new MediaStream([event.track]);
      }

      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('[WEBRTC] Audio autoplay blocked, waiting for user gesture:', e);
          const resumeAudio = () => {
            audioEl?.play().catch(() => {});
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
          };
          window.addEventListener('click', resumeAudio, { once: true });
          window.addEventListener('touchstart', resumeAudio, { once: true });
        });
      }
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
          await drainIceCandidates(from, pc);

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
            await drainIceCandidates(from, pc);
          }
        } catch (err) {
          console.error(`[WEBRTC] Failed to handle answer from ${from}:`, err);
        }
      } else if (msg.type === 'ICE_CANDIDATE') {
        const { from, candidate } = msg;
        try {
          const pc = peerConnectionsRef.current.get(from);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            // Buffer early candidate until remote description is established
            const queue = pendingCandidatesRef.current.get(from) || [];
            queue.push(candidate);
            pendingCandidatesRef.current.set(from, queue);
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
        pendingCandidatesRef.current.delete(msg.participantId);

        const audio = remoteAudioElementsRef.current.get(msg.participantId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
          remoteAudioElementsRef.current.delete(msg.participantId);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, myParticipantId, getOrCreatePeerConnection, callPeer, drainIceCandidates]);

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
        isMutedRef.current = false;
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
          const track = localStreamRef.current.getAudioTracks()[0];
          if (track) attachTrackToPeerConnections(track);
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
    isMutedRef.current = nextMuted;

    if (!nextMuted) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) attachTrackToPeerConnections(track);
    }

    wsService.sendMessage({
      type: 'MUTE_STATUS',
      isMuted: nextMuted
    });
  }, [isMuted, startAudio, attachTrackToPeerConnections]);

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
      pendingCandidatesRef.current.clear();
      remoteAudioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
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
