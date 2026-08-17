import { describe, expect, it } from 'vitest';
import { RoomEvent, Track } from 'livekit-client';
import { VoiceDiagnostics } from '../../lib/voice/voice-diagnostics';

type Handler = (...args: any[]) => void;

type FakePublication = {
  trackSid: string;
  kind: Track.Kind;
};

type FakeParticipant = {
  identity: string;
  audioTrackPublications: Map<string, FakePublication>;
};

function makeRoom(participantCount = 35) {
  const handlers = new Map<RoomEvent, Set<Handler>>();
  const remoteParticipants = new Map<string, FakeParticipant>();

  for (let i = 0; i < participantCount; i += 1) {
    const sid = `TR_AUDIO_${i}`;
    remoteParticipants.set(`player-${i}`, {
      identity: `player-${i}`,
      audioTrackPublications: new Map([[sid, { trackSid: sid, kind: Track.Kind.Audio }]]),
    });
  }

  const room = {
    remoteParticipants,
    on(event: RoomEvent, handler: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return room;
    },
    off(event: RoomEvent, handler: Handler) {
      handlers.get(event)?.delete(handler);
      return room;
    },
    emit(event: RoomEvent, ...args: any[]) {
      handlers.get(event)?.forEach(handler => handler(...args));
    },
    listenerCount(event: RoomEvent) {
      return handlers.get(event)?.size ?? 0;
    },
  };

  return room;
}

function audioTrack() {
  return { kind: Track.Kind.Audio };
}

describe('VoiceDiagnostics', () => {
  it('takes an initial snapshot of a full 35-player room', () => {
    const room = makeRoom(35);
    const diagnostics = new VoiceDiagnostics();

    diagnostics.install(room as any);
    const snapshot = diagnostics.getSnapshot();

    expect(snapshot.participants).toBe(35);
    expect(snapshot.audioTracks).toBe(35);
    expect(snapshot.duplicateTrackSids).toBe(0);
  });

  it('does not create duplicate active tracks after repeated reconnects', () => {
    const room = makeRoom(35);
    const diagnostics = new VoiceDiagnostics();
    diagnostics.install(room as any);

    const firstPublication = { trackSid: 'TR_AUDIO_0', kind: Track.Kind.Audio };
    room.emit(RoomEvent.TrackSubscribed, audioTrack(), firstPublication, { identity: 'player-0' });
    room.emit(RoomEvent.TrackSubscribed, audioTrack(), firstPublication, { identity: 'player-0' });

    expect(diagnostics.getSnapshot().duplicateTrackSids).toBe(1);

    room.emit(RoomEvent.Reconnecting);
    room.emit(RoomEvent.Reconnected);
    room.emit(RoomEvent.Reconnecting);
    room.emit(RoomEvent.Reconnected);
    room.emit(RoomEvent.Reconnecting);
    room.emit(RoomEvent.Reconnected);

    expect(diagnostics.getSnapshot().reconnecting).toBe(3);
    expect(diagnostics.getSnapshot().reconnected).toBe(3);
    expect(diagnostics.getSnapshot().duplicateTrackSids).toBe(1);
  });

  it('removes a disappeared track from the active SID set after reconnect', () => {
    const room = makeRoom(35);
    const diagnostics = new VoiceDiagnostics();
    diagnostics.install(room as any);

    const publication = { trackSid: 'TR_AUDIO_7', kind: Track.Kind.Audio };
    room.emit(RoomEvent.TrackSubscribed, audioTrack(), publication, { identity: 'player-7' });

    room.remoteParticipants.get('player-7')!.audioTrackPublications.clear();
    room.emit(RoomEvent.Reconnected);

    room.emit(RoomEvent.TrackSubscribed, audioTrack(), publication, { identity: 'player-7' });
    expect(diagnostics.getSnapshot().duplicateTrackSids).toBe(0);
  });

  it('records subscription failures without treating them as disconnects', () => {
    const room = makeRoom(35);
    const diagnostics = new VoiceDiagnostics();
    diagnostics.install(room as any);

    room.emit(RoomEvent.TrackSubscriptionFailed, 'TR_AUDIO_12', { identity: 'player-12' }, 'network');

    const snapshot = diagnostics.getSnapshot();
    expect(snapshot.subscriptionFailures).toBe(1);
    expect(snapshot.disconnected).toBe(0);
    expect(snapshot.lastError).toContain('subscription failed');
  });

  it('treats paused/resumed stream states as stream events, not disconnects', () => {
    const room = makeRoom(35);
    const diagnostics = new VoiceDiagnostics();
    diagnostics.install(room as any);

    const publication = { trackSid: 'TR_AUDIO_2', kind: Track.Kind.Audio };
    room.emit(RoomEvent.TrackStreamStateChanged, publication, 'paused', { identity: 'player-2' });
    room.emit(RoomEvent.TrackStreamStateChanged, publication, 'active', { identity: 'player-2' });

    const snapshot = diagnostics.getSnapshot();
    expect(snapshot.streamPaused).toBe(1);
    expect(snapshot.streamResumed).toBe(1);
    expect(snapshot.disconnected).toBe(0);
  });

  it('removes only its own listeners on dispose', () => {
    const room = makeRoom(35);
    const diagnostics = new VoiceDiagnostics();
    diagnostics.install(room as any);

    expect(room.listenerCount(RoomEvent.Reconnected)).toBe(1);
    diagnostics.dispose(room as any);
    expect(room.listenerCount(RoomEvent.Reconnected)).toBe(0);
  });
});
