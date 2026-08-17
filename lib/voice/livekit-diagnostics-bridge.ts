'use client';

import type { Room } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import { voiceDiagnostics } from './voice-diagnostics';

/** Connects the diagnostics monitor to a real LiveKit Room without owning the room lifecycle. */
export function installLiveKitDiagnostics(room: Room): () => void {
  const handlers = [
    [RoomEvent.ParticipantConnected, () => voiceDiagnostics.setParticipants(room.remoteParticipants.size)],
    [RoomEvent.ParticipantDisconnected, () => voiceDiagnostics.setParticipants(room.remoteParticipants.size)],
    [RoomEvent.TrackSubscribed, (track: any) => {
      if (track?.kind === Track.Kind.Audio) voiceDiagnostics.trackSubscribed(track.sid ?? track.name ?? 'unknown');
    }],
    [RoomEvent.TrackUnsubscribed, (track: any) => {
      if (track?.kind === Track.Kind.Audio) voiceDiagnostics.trackUnsubscribed(track.sid ?? track.name ?? 'unknown');
    }],
    [RoomEvent.TrackSubscriptionFailed, (sid: string, _participant: any, error?: Error) => voiceDiagnostics.trackSubscriptionFailed(sid, error)],
    [RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => voiceDiagnostics.activeSpeakersChanged(speakers?.length ?? 0)],
    [RoomEvent.Reconnecting, () => voiceDiagnostics.reconnecting()],
    [RoomEvent.Reconnected, () => voiceDiagnostics.reconnected()],
    [RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => voiceDiagnostics.playbackStatusChanged(playing)],
    [RoomEvent.TrackStreamStateChanged, (_publication: any, state: any) => voiceDiagnostics.streamStateChanged(state)],
  ] as const;

  for (const [event, handler] of handlers) room.on(event as any, handler as any);
  voiceDiagnostics.setParticipants(room.remoteParticipants.size);

  return () => {
    for (const [event, handler] of handlers) room.off(event as any, handler as any);
  };
}
