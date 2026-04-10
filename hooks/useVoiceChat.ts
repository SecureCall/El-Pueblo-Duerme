'use client';

/**
 * useVoiceChat
 * Chat de voz WebRTC con Firebase Firestore como servidor de señalización.
 *
 * Canales:
 *   'main'   — todos los vivos durante el día
 *   'wolves' — equipo lobo durante la noche
 *   'ghost'  — muertos (pueden oír, no hablar)
 *
 * Señalización Firestore:
 *   games/{gameId}/voicePresence/{uid}   — presencia en el canal
 *   games/{gameId}/voiceOffers/{A}_{B}   — SDP offer de A hacia B
 *   games/{gameId}/voiceAnswers/{A}_{B}  — SDP answer de B hacia A
 *   games/{gameId}/voiceIce/{A}_{B}      — ICE candidates de A hacia B
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase/config';
import {
  doc, setDoc, deleteDoc, onSnapshot, collection, addDoc,
  serverTimestamp,
} from 'firebase/firestore';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface PeerState {
  uid: string;
  name: string;
  speaking: boolean;
  connected: boolean;
}

interface VoiceChatOptions {
  gameId: string;
  userId: string;
  userName: string;
  channel: string;         // 'main' | 'wolves' | 'ghost'
  canSpeak: boolean;       // false = sólo escucha (fantasmas, espectadores)
  enabled: boolean;        // false = no conectar nada
}

interface SignalPresence {
  uid: string;
  name: string;
  channel: string;
  joinedAt: number;
}

export function useVoiceChat({ gameId, userId, userName, channel, canSpeak, enabled }: VoiceChatOptions) {
  const [isMuted, setIsMuted] = useState(false);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConns = useRef<Map<string, RTCPeerConnection>>(new Map());
  const speakingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Latest presence snapshot so we can re-process after joining
  const lastPresenceSnap = useRef<SignalPresence[]>([]);
  const isMutedRef = useRef(isMuted);
  const channelRef = useRef(channel);
  const unsubscribeRef = useRef<(() => void)[]>([]);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { channelRef.current = channel; }, [channel]);

  // ── Obtener micrófono ─────────────────────────────────────────────
  const getLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
        video: false,
      });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(t => { t.enabled = canSpeak && !isMutedRef.current; });
      setPermissionGranted(true);
      return stream;
    } catch (e) {
      setError('Micrófono no disponible. Revisa los permisos del navegador.');
      return null;
    }
  }, [canSpeak]);

  // ── Crear PeerConnection con un peer ────────────────────────────
  const createPeer = useCallback((peerId: string, peerName: string): RTCPeerConnection => {
    const existing = peerConns.current.get(peerId);
    if (existing && existing.connectionState !== 'closed') return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConns.current.set(peerId, pc);

    // Añadir tracks locales si ya tenemos el stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    }

    // Recibir audio del peer
    pc.ontrack = (ev) => {
      const remoteAudio = new Audio();
      remoteAudio.srcObject = ev.streams[0];
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute('playsinline', 'true');

      // Detector de voz (VAD básico)
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(ev.streams[0]);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const vadInterval = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = avg > 18;
        setPeers(prev => prev.map(p => p.uid === peerId ? { ...p, speaking } : p));
        if (speaking) {
          const t = speakingTimers.current.get(peerId);
          if (t) clearTimeout(t);
          speakingTimers.current.set(peerId, setTimeout(() => {
            setPeers(prev => prev.map(p => p.uid === peerId ? { ...p, speaking: false } : p));
          }, 600));
        }
      }, 150);

      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
          clearInterval(vadInterval);
          ctx.close().catch(() => {});
        }
      });
    };

    // ICE candidates → Firestore
    pc.onicecandidate = async (ev) => {
      if (!ev.candidate) return;
      await addDoc(collection(db, 'games', gameId, 'voiceIce', `${userId}_${peerId}`, 'candidates'), {
        candidate: ev.candidate.candidate,
        sdpMid: ev.candidate.sdpMid,
        sdpMLineIndex: ev.candidate.sdpMLineIndex,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setPeers(prev => prev.map(p => p.uid === peerId
        ? { ...p, connected: state === 'connected' }
        : p
      ));
      if (state === 'failed' || state === 'disconnected') {
        const reconnectDelay = state === 'failed' ? 2500 : 5000;
        setTimeout(() => {
          const current = peerConns.current.get(peerId);
          if (current && (current.connectionState === 'failed' || current.connectionState === 'disconnected')) {
            current.close();
            peerConns.current.delete(peerId);
          }
        }, reconnectDelay);
      }
    };

    setPeers(prev => {
      if (prev.find(p => p.uid === peerId)) return prev;
      return [...prev, { uid: peerId, name: peerName, speaking: false, connected: false }];
    });

    return pc;
  }, [gameId, userId]);

  // ── Iniciar oferta hacia un peer ──────────────────────────────
  const initiateOffer = useCallback(async (peerId: string, peerName: string) => {
    const stream = await getLocalStream();
    if (!stream) return;
    const pc = createPeer(peerId, peerName);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(doc(db, 'games', gameId, 'voiceOffers', `${userId}_${peerId}`), {
      sdp: offer.sdp,
      type: offer.type,
      from: userId,
      to: peerId,
      channel,
      createdAt: serverTimestamp(),
    });

    // Escuchar answer
    const unsub = onSnapshot(doc(db, 'games', gameId, 'voiceAnswers', `${peerId}_${userId}`), async (snap: any) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription({ type: data.type, sdp: data.sdp }).catch(() => {});
      }
    });
    unsubscribeRef.current.push(unsub);

    // Escuchar ICE del peer hacia mí
    const iceUnsub = onSnapshot(collection(db, 'games', gameId, 'voiceIce', `${peerId}_${userId}`, 'candidates'), (snap: any) => {
      snap.docChanges().forEach((ch: any) => {
        if (ch.type !== 'added') return;
        const d = ch.doc.data();
        pc.addIceCandidate(new RTCIceCandidate({ candidate: d.candidate, sdpMid: d.sdpMid, sdpMLineIndex: d.sdpMLineIndex })).catch(() => {});
      });
    });
    unsubscribeRef.current.push(iceUnsub);
  }, [gameId, userId, channel, getLocalStream, createPeer]);

  // ── Responder una oferta ───────────────────────────────────────
  const handleOffer = useCallback(async (peerId: string, peerName: string, offerSdp: string, offerType: RTCSdpType) => {
    const stream = await getLocalStream();
    if (!stream) return;
    const pc = createPeer(peerId, peerName);
    if (pc.signalingState !== 'stable') return;
    await pc.setRemoteDescription({ type: offerType, sdp: offerSdp }).catch(() => {});
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await setDoc(doc(db, 'games', gameId, 'voiceAnswers', `${userId}_${peerId}`), {
      sdp: answer.sdp,
      type: answer.type,
      from: userId,
      to: peerId,
      createdAt: serverTimestamp(),
    });

    // Escuchar ICE del peer hacia mí
    const iceUnsub = onSnapshot(collection(db, 'games', gameId, 'voiceIce', `${peerId}_${userId}`, 'candidates'), (snap: any) => {
      snap.docChanges().forEach((ch: any) => {
        if (ch.type !== 'added') return;
        const d = ch.doc.data();
        pc.addIceCandidate(new RTCIceCandidate({ candidate: d.candidate, sdpMid: d.sdpMid, sdpMLineIndex: d.sdpMLineIndex })).catch(() => {});
      });
    });
    unsubscribeRef.current.push(iceUnsub);
  }, [gameId, userId, getLocalStream, createPeer]);

  // ── Conectar: registrar presencia y escuchar peers ───────────
  useEffect(() => {
    if (!enabled) return;

    const presence: SignalPresence = { uid: userId, name: userName, channel, joinedAt: Date.now() };
    setDoc(doc(db, 'games', gameId, 'voicePresence', userId), presence).catch(() => {});

    // Escuchar presencia de otros en el mismo canal
    const presenceUnsub = onSnapshot(
      collection(db, 'games', gameId, 'voicePresence'),
      async (snap: any) => {
        const others: SignalPresence[] = snap.docs
          .map((d: any) => d.data() as SignalPresence)
          .filter((p: SignalPresence) => p.uid !== userId && p.channel === channelRef.current);

        // Guardar snapshot por si el usuario se une más tarde
        lastPresenceSnap.current = others;

        // Solo iniciar ofertas si ya tenemos el micrófono
        if (localStreamRef.current) {
          for (const peer of others) {
            if (peerConns.current.has(peer.uid)) continue;
            if (userId < peer.uid) {
              await initiateOffer(peer.uid, peer.name);
            }
          }
        }

        // Eliminar peers que ya no están
        const activeUids = new Set(others.map(o => o.uid));
        setPeers(prev => prev.filter(p => activeUids.has(p.uid)));
        peerConns.current.forEach((pc, uid) => {
          if (!activeUids.has(uid)) {
            pc.close();
            peerConns.current.delete(uid);
          }
        });
      },
      (err: any) => {
        // Error de permisos Firestore — silencioso, no rompe el UI
        console.warn('[VoiceChat] presenceUnsub error:', err.code);
      }
    );
    unsubscribeRef.current.push(presenceUnsub);

    // Escuchar ofertas dirigidas a mí
    const offersUnsub = onSnapshot(
      collection(db, 'games', gameId, 'voiceOffers'),
      async (snap: any) => {
        snap.docChanges().forEach(async (ch: any) => {
          if (ch.type !== 'added') return;
          const data = ch.doc.data();
          if (data.to !== userId || data.channel !== channelRef.current) return;
          if (!peerConns.current.has(data.from) || peerConns.current.get(data.from)!.connectionState === 'closed') {
            await handleOffer(data.from, data.from, data.sdp, data.type as RTCSdpType);
          }
        });
      },
      (err: any) => {
        console.warn('[VoiceChat] offersUnsub error:', err.code);
      }
    );
    unsubscribeRef.current.push(offersUnsub);

    return () => {
      deleteDoc(doc(db, 'games', gameId, 'voicePresence', userId)).catch(() => {});
      unsubscribeRef.current.forEach(u => u());
      unsubscribeRef.current = [];
      peerConns.current.forEach(pc => pc.close());
      peerConns.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      setPeers([]);
      setPermissionGranted(false);
      lastPresenceSnap.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameId, userId, channel]);

  // ── Unirse al canal de voz (solicitar micrófono + conectar) ──
  // Este es el único punto de entrada para pedir el permiso del mic.
  // Se llama desde el botón "Unirte con voz".
  const joinVoice = useCallback(async () => {
    if (joining || permissionGranted) return;
    setJoining(true);
    try {
      const stream = await getLocalStream();
      if (!stream) { setJoining(false); return; }

      // Añadir tracks a conexiones peer existentes (si ya había peers)
      peerConns.current.forEach(pc => {
        if (pc.connectionState !== 'closed') {
          const senders = pc.getSenders();
          stream.getTracks().forEach(t => {
            if (!senders.some(s => s.track === t)) {
              pc.addTrack(t, stream);
            }
          });
        }
      });

      // Re-procesar peers presentes que esperaban a que tuviéramos micrófono
      for (const peer of lastPresenceSnap.current) {
        if (peerConns.current.has(peer.uid)) continue;
        if (userId < peer.uid) {
          await initiateOffer(peer.uid, peer.name);
        }
      }
    } finally {
      setJoining(false);
    }
  }, [joining, permissionGranted, getLocalStream, initiateOffer, userId]);

  // ── Mute/unmute ───────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted(m => {
      const next = !m;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = canSpeak && !next; });
      }
      return next;
    });
  }, [canSpeak]);

  // ── Aplicar canSpeak al track ───────────────────────────────
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = canSpeak && !isMuted; });
    }
  }, [canSpeak, isMuted]);

  return { isMuted, toggleMute, joinVoice, joining, peers, permissionGranted, error };
}
