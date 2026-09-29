import { useEffect, useRef, useState, useCallback } from 'react';
import { wsService } from '../services/websocket.js';
import type { ServerMessage, VoiceStatus } from '../types/index.js';

interface WebRTCVoiceProps {
  myParticipantId: string;
  participantIds: string[];
  enabled: boolean;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  // Google Public STUN
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  // Cloudflare Public STUN
  { urls: ['stun:stun.cloudflare.com:3478'] },
  // OpenRelay Public TURN (Essential for mobile 4G/5G Symmetric NAT & carrier firewalls)
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

// Helper to enhance SDP with Opus FEC (Forward Error Correction) & optimal bitrate like Google Meet / WhatsApp
function enhanceSdpForVoice(sdp: string): string {
  return sdp.replace(
    /a=fmtp:(\d+) (.*)/g,
    (match, payloadType, params) => {
      if (sdp.includes(`a=rtpmap:${payloadType} opus/48000`)) {
        let enhanced = params;
        if (!enhanced.includes('useinbandfec=1')) {
          enhanced += ';useinbandfec=1';
        }
        if (!enhanced.includes('minptime=')) {
          enhanced += ';minptime=10';
        }
        if (!enhanced.includes('maxaveragebitrate=')) {
          enhanced += ';maxaveragebitrate=64000';
        }
        if (!enhanced.includes('stereo=')) {
          enhanced += ';stereo=0;sprop-stereo=0';
        }
        return `a=fmtp:${payloadType} ${enhanced}`;
      }
      return match;
    }
  );
}

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
  const [remoteSpeakingPeers, setRemoteSpeakingPeers] = useState<string[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteSpeakingIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getIceServers = useCallback((): RTCIceServer[] => {
    if (import.meta.env.VITE_STUN_URL) {
      const urls = import.meta.env.VITE_STUN_URL.split(',').map((u: string) => u.trim());
      return [{ urls }, ...DEFAULT_ICE_SERVERS];
    }
    return DEFAULT_ICE_SERVERS;
  }, []);

  // Unlock all audio elements and AudioContext on user interaction (resolves iOS/Android autoplay policy)
  const unlockAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    remoteAudioElementsRef.current.forEach((audioEl) => {
      audioEl.play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    const handleGesture = () => unlockAudioContext();
    window.addEventListener('click', handleGesture);
    window.addEventListener('touchstart', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, [unlockAudioContext]);

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

  const startAudio = useCallback(async (autoUnmute = false) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceStatus('ERROR');
      return;
    }

    try {
      setVoiceStatus('CONNECTING');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          // Enhanced Chromium & WebKit voice clarity flags
          ...({
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googTypingNoiseDetection: true
          } as any)
        },
        video: false
      });

      localStreamRef.current = stream;

      const initialMuteState = autoUnmute ? false : isMutedRef.current;
      setIsMuted(initialMuteState);
      isMutedRef.current = initialMuteState;

      // Sync initial muted state on the hardware tracks
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !initialMuteState;
      });

      // Seamlessly push mic track to all peer connections
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        attachTrackToPeerConnections(audioTrack);
      }

      // Voice activity detector for local speaker visualization
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioCtx();
          }
          const audioCtx = audioContextRef.current;
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }
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
            setIsSpeakingLocally(avg > 16);
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
      iceServers: getIceServers(),
      iceCandidatePoolSize: 2
    });

    peerConnectionsRef.current.set(targetId, pc);

    // Pre-allocate audio transceiver with sendrecv. SDP will contain an audio m-line
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
        audioEl.setAttribute('playsinline', 'true');
        audioEl.setAttribute('webkit-playsinline', 'true');
        audioEl.volume = 1.0;
        // Position off-screen instead of display:none to prevent mobile OS power throttling!
        audioEl.style.position = 'fixed';
        audioEl.style.top = '-9999px';
        audioEl.style.left = '-9999px';
        audioEl.style.width = '1px';
        audioEl.style.height = '1px';
        audioEl.style.opacity = '0.01';
        audioEl.style.pointerEvents = 'none';
        document.body.appendChild(audioEl);
        remoteAudioElementsRef.current.set(targetId, audioEl);
      }

      const streamToPlay = (event.streams && event.streams[0]) 
        ? event.streams[0] 
        : new MediaStream([event.track]);

      audioEl.srcObject = streamToPlay;

      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('[WEBRTC] Audio autoplay blocked, waiting for user gesture:', e);
          const resumeAudio = () => {
            audioEl?.play().catch(() => {});
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
              audioContextRef.current.resume().catch(() => {});
            }
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
          };
          window.addEventListener('click', resumeAudio, { once: true });
          window.addEventListener('touchstart', resumeAudio, { once: true });
        });
      }

      // Route stream through Web Audio API for remote speaking detection and fallback playback
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioCtx();
          }
          const audioCtx = audioContextRef.current;
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }
          const remoteSource = audioCtx.createMediaStreamSource(streamToPlay);
          const remoteAnalyser = audioCtx.createAnalyser();
          remoteAnalyser.fftSize = 256;
          remoteSource.connect(remoteAnalyser);

          // Monitor remote partner voice activity (for partner is speaking indicator)
          const remoteData = new Uint8Array(remoteAnalyser.frequencyBinCount);
          if (remoteSpeakingIntervalsRef.current.has(targetId)) {
            clearInterval(remoteSpeakingIntervalsRef.current.get(targetId)!);
          }
          const remoteInterval = setInterval(() => {
            remoteAnalyser.getByteFrequencyData(remoteData);
            let sum = 0;
            for (let i = 0; i < remoteData.length; i++) {
              sum += remoteData[i];
            }
            const avg = sum / remoteData.length;
            const isSpeaking = avg > 14;
            setRemoteSpeakingPeers(prev => {
              const has = prev.includes(targetId);
              if (isSpeaking && !has) return [...prev, targetId];
              if (!isSpeaking && has) return prev.filter(id => id !== targetId);
              return prev;
            });
          }, 150);
          remoteSpeakingIntervalsRef.current.set(targetId, remoteInterval);
        }
      } catch (err) {
        console.warn('[WEBRTC] Remote speaking detector unavailable:', err);
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
      const enhancedSdp = enhanceSdpForVoice(offer.sdp || '');
      const enhancedOffer = new RTCSessionDescription({ type: offer.type, sdp: enhancedSdp });
      await pc.setLocalDescription(enhancedOffer);

      wsService.sendMessage({
        type: 'WEBRTC_OFFER',
        target: targetId,
        offer: {
          type: enhancedOffer.type,
          sdp: enhancedOffer.sdp
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
          const enhancedSdp = enhanceSdpForVoice(answer.sdp || '');
          const enhancedAnswer = new RTCSessionDescription({ type: answer.type, sdp: enhancedSdp });
          await pc.setLocalDescription(enhancedAnswer);

          wsService.sendMessage({
            type: 'WEBRTC_ANSWER',
            target: from,
            answer: {
              type: enhancedAnswer.type,
              sdp: enhancedAnswer.sdp
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

        if (remoteSpeakingIntervalsRef.current.has(msg.participantId)) {
          clearInterval(remoteSpeakingIntervalsRef.current.get(msg.participantId)!);
          remoteSpeakingIntervalsRef.current.delete(msg.participantId);
        }

        setRemoteSpeakingPeers(prev => prev.filter(id => id !== msg.participantId));

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
      startAudio(false);
    }
  }, [enabled, voiceStatus, startAudio]);

  const toggleMute = useCallback(() => {
    unlockAudioContext();

    if (!localStreamRef.current) {
      // First click: start audio unmuted with user gesture
      startAudio(true).then(() => {
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
  }, [isMuted, startAudio, attachTrackToPeerConnections, unlockAudioContext]);

  useEffect(() => {
    return () => {
      if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
      remoteSpeakingIntervalsRef.current.forEach((interval) => clearInterval(interval));
      remoteSpeakingIntervalsRef.current.clear();
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
    remoteSpeakingPeers,
    partnerIsSpeaking: remoteSpeakingPeers.length > 0,
    toggleMute,
    retryAudio: () => startAudio(false)
  };
}
