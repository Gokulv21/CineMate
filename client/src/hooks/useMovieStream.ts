import { useEffect, useRef, useState, useCallback } from 'react';
import { wsService } from '../services/websocket.js';
import type { ServerMessage } from '../types/index.js';

interface MovieStreamProps {
  myParticipantId: string;
  partnerId?: string;
  isHost: boolean;
  enabled: boolean;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  // Google Public STUN
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  // Cloudflare Public STUN
  { urls: ['stun:stun.cloudflare.com:3478'] },
  // OpenRelay Public TURN (Essential for cross-border NAT traversal)
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

export function useMovieStream({
  myParticipantId: _myParticipantId,
  partnerId,
  isHost,
  enabled
}: MovieStreamProps) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const partnerIdRef = useRef<string | undefined>(partnerId);
  partnerIdRef.current = partnerId;

  // Cleanup helper
  const cleanupPC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
  }, []);

  // Host creates offer and sends to partner
  const createAndSendOffer = useCallback(async (targetId: string, stream: MediaStream) => {
    if (!targetId || !stream) return;

    try {
      cleanupPC();

      const pc = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS,
        bundlePolicy: 'max-bundle'
      });
      pcRef.current = pc;

      // Add all tracks from the movie stream (video + movie audio)
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && targetId) {
          wsService.sendMessage({
            type: 'STREAM_ICE',
            target: targetId,
            candidate: event.candidate.toJSON()
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[MOVIE STREAM HOST] Connection state: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          setIsStreaming(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setIsStreaming(false);
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      await pc.setLocalDescription(offer);

      console.log(`[MOVIE STREAM HOST] Sending STREAM_OFFER to partner ${targetId}`);
      wsService.sendMessage({
        type: 'STREAM_OFFER',
        target: targetId,
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });
    } catch (err) {
      console.error('[MOVIE STREAM HOST] Failed to create stream offer:', err);
    }
  }, [cleanupPC]);

  // Start broadcast called by Host (from video element or screen share)
  const startBroadcast = useCallback((stream: MediaStream) => {
    localStreamRef.current = stream;
    setIsStreaming(true);

    if (isHost && partnerIdRef.current) {
      createAndSendOffer(partnerIdRef.current, stream);
    }
  }, [isHost, createAndSendOffer]);

  // Stop broadcast
  const stopBroadcast = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    cleanupPC();
    setIsStreaming(false);
    setRemoteStream(null);
  }, [cleanupPC]);

  // When partner joins or changes, if Host is already streaming, offer to new partner
  useEffect(() => {
    if (!enabled || !isHost) return;

    if (partnerId && localStreamRef.current) {
      const activeTracks = localStreamRef.current.getTracks().filter(t => t.readyState === 'live');
      if (activeTracks.length > 0) {
        console.log(`[MOVIE STREAM HOST] Partner connected (${partnerId}), sending active stream offer...`);
        createAndSendOffer(partnerId, localStreamRef.current);
      }
    }
  }, [enabled, isHost, partnerId, createAndSendOffer]);

  // Signaling message handler
  useEffect(() => {
    if (!enabled) {
      stopBroadcast();
      return;
    }

    const unsub = wsService.addMessageListener(async (msg: ServerMessage) => {
      switch (msg.type) {
        case 'STREAM_OFFER': {
          // Received by Viewer from Host
          if (isHost) return; // Only viewer accepts stream offers

          console.log(`[MOVIE STREAM VIEWER] Received STREAM_OFFER from Host ${msg.from}`);
          try {
            cleanupPC();

            const pc = new RTCPeerConnection({
              iceServers: DEFAULT_ICE_SERVERS,
              bundlePolicy: 'max-bundle'
            });
            pcRef.current = pc;

            pc.ontrack = (event) => {
              console.log(`[MOVIE STREAM VIEWER] Received incoming ${event.track.kind} track`);
              if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
              } else {
                setRemoteStream(prev => {
                  const s = prev || new MediaStream();
                  if (!s.getTracks().includes(event.track)) {
                    s.addTrack(event.track);
                  }
                  return new MediaStream(s.getTracks());
                });
              }
              setIsStreaming(true);
            };

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                wsService.sendMessage({
                  type: 'STREAM_ICE',
                  target: msg.from,
                  candidate: event.candidate.toJSON()
                });
              }
            };

            pc.onconnectionstatechange = () => {
              console.log(`[MOVIE STREAM VIEWER] Connection state: ${pc.connectionState}`);
              if (pc.connectionState === 'connected') {
                setIsStreaming(true);
              } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setIsStreaming(false);
              }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));

            // Drain any buffered ICE candidates
            while (pendingCandidatesRef.current.length > 0) {
              const cand = pendingCandidatesRef.current.shift();
              if (cand) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn('[MOVIE STREAM VIEWER] Pending ICE candidate error:', e);
                }
              }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log(`[MOVIE STREAM VIEWER] Sending STREAM_ANSWER to Host ${msg.from}`);
            wsService.sendMessage({
              type: 'STREAM_ANSWER',
              target: msg.from,
              answer: {
                type: answer.type,
                sdp: answer.sdp
              }
            });
          } catch (err) {
            console.error('[MOVIE STREAM VIEWER] Failed to handle STREAM_OFFER:', err);
          }
          break;
        }

        case 'STREAM_ANSWER': {
          // Received by Host from Viewer
          if (!isHost) return;

          console.log(`[MOVIE STREAM HOST] Received STREAM_ANSWER from Viewer ${msg.from}`);
          if (pcRef.current) {
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));

              // Drain any buffered ICE candidates
              while (pendingCandidatesRef.current.length > 0) {
                const cand = pendingCandidatesRef.current.shift();
                if (cand) {
                  try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {
                    console.warn('[MOVIE STREAM HOST] Pending ICE candidate error:', e);
                  }
                }
              }
            } catch (err) {
              console.error('[MOVIE STREAM HOST] Error applying STREAM_ANSWER:', err);
            }
          }
          break;
        }

        case 'STREAM_ICE': {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (err) {
              console.warn('[MOVIE STREAM] Error adding ICE candidate:', err);
            }
          } else {
            // Buffer candidate until remoteDescription is set
            pendingCandidatesRef.current.push(msg.candidate);
          }
          break;
        }

        case 'PARTICIPANT_LEFT': {
          if (!isHost && msg.participantId === partnerIdRef.current) {
            setRemoteStream(null);
            setIsStreaming(false);
          }
          break;
        }
      }
    });

    return () => {
      unsub();
    };
  }, [enabled, isHost, cleanupPC, stopBroadcast]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      stopBroadcast();
    };
  }, [stopBroadcast]);

  return {
    remoteStream,
    isStreaming,
    startBroadcast,
    stopBroadcast
  };
}
