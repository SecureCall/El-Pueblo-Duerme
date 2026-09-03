'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Room } from 'livekit-client';
import { useAuth } from '@/app/providers/AuthProvider';
import { VoiceController } from '@/lib/voice/voice-controller';
import { LiveKitVoiceTransport } from '@/lib/voice/livekit-transport';
import type { VoiceChannel, VoiceParticipant, VoiceState } from '@/lib/voice/voice-contract';

export interface PeerState {
  uid: string;
  name: string;
  speaking: boolean;
  connected: boolean;
  muted: boolean;
  volume: number;
}

interface VoiceChatOptions {
  gameId: string;
  userId: string;
  userName: string;
  channel: VoiceChannel;
  canSpeak: boolean;
  enabled: boolean;
}

export function useVoiceChat({ gameId, userId, userName, channel, canSpeak, enabled }: VoiceChatOptions) {
  const { user } = useAuth();
  const controllerRef = useRef<VoiceController | null>(null);
  const [state, setState] = useState<VoiceState>('idle');
  const [isMuted, setIsMuted] = useState(!canSpeak);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !user || user.uid !== userId) return;

    const controller = new VoiceController(() => new LiveKitVoiceTransport(
      () => new Room({ adaptiveStream: true, dynacast: true }),
      {
        getIdToken: () => user.getIdToken(),
        getDisplayName: () => userName,
      },
    ));
    controllerRef.current = controller;

    const offState = controller.onStateChange?.((nextState) => setState(nextState));
    const offParticipants = controller.onParticipantsChange((participants: VoiceParticipant[]) => {
      setPeers(participants.map(peer => ({
        uid: peer.playerId,
        name: peer.displayName,
        speaking: peer.speaking,
        connected: true,
        muted: peer.muted,
        volume: peer.volume,
      })));
    });

    return () => {
      offState?.();
      offParticipants();
      controller.disconnect().catch(() => undefined);
      if (controllerRef.current === controller) controllerRef.current = null;
      setPeers([]);
      setPermissionGranted(false);
      setState('disconnected');
    };
  }, [enabled, user, userId, userName]);

  const joinVoice = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller || !user || user.uid !== userId) {
      setError('No se ha podido autenticar el chat de voz.');
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await controller.connect({ gameId, channel, maxParticipants: 35 }, userId);
      await controller.setMicrophoneEnabled(canSpeak && !isMuted);
      setPermissionGranted(true);
      setState(controller.getState());
    } catch (err) {
      setPermissionGranted(false);
      setState(controller.getState());
      setError(err instanceof Error ? err.message : 'No se ha podido conectar la voz.');
    } finally {
      setJoining(false);
    }
  }, [gameId, channel, canSpeak, isMuted, user, userId]);

  const toggleMute = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller || !canSpeak) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    try {
      await controller.setMicrophoneEnabled(!nextMuted);
    } catch (err) {
      setIsMuted(!nextMuted);
      setError(err instanceof Error ? err.message : 'No se ha podido cambiar el micrófono.');
    }
  }, [canSpeak, isMuted]);

  return { isMuted, toggleMute, joinVoice, joining, peers, permissionGranted, error, state };
}
