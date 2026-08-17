import { Room, RoomEvent, Track } from 'livekit-client';

export type VoiceDiagnosticSnapshot = {
  startedAt: number;
  participants: number;
  audioTracks: number;
  subscribedTracks: number;
  unsubscribedTracks: number;
  subscriptionFailures: number;
  activeSpeakers: number;
  reconnecting: number;
  reconnected: number;
  disconnected: number;
  playbackBlocked: number;
  streamPaused: number;
  streamResumed: number;
  duplicateTrackSids: number;
  lastEvent?: string;
  lastError?: string;
};

export type VoiceDiagnosticListener = (snapshot: VoiceDiagnosticSnapshot) => void;

type ListenerBinding = { event: RoomEvent; handler: (...args: any[]) => void };

export class VoiceDiagnostics {
  private room: Room | null = null;
  private listeners = new Set<VoiceDiagnosticListener>();
  private snapshot: VoiceDiagnosticSnapshot = this.createInitialSnapshot();
  private seenTrackSids = new Set<string>();
  private attachedTrackSids = new Set<string>();
  private bindings: ListenerBinding[] = [];

  onChange(listener: VoiceDiagnosticListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): VoiceDiagnosticSnapshot {
    return { ...this.snapshot };
  }

  install(room: Room): () => void {
    this.dispose();
    this.room = room;
    this.snapshot = this.createInitialSnapshot();
    this.emit('installed');

    const bind = (event: RoomEvent, handler: (...args: any[]) => void) => {
      room.on(event, handler as any);
      this.bindings.push({ event, handler });
    };

    bind(RoomEvent.ParticipantConnected, () => this.refreshParticipants('participant-connected'));
    bind(RoomEvent.ParticipantDisconnected, () => this.refreshParticipants('participant-disconnected'));
    bind(RoomEvent.TrackSubscribed, (track: any, publication: any) => {
      if (track.kind !== Track.Kind.Audio) return;
      const sid = publication.trackSid;
      this.snapshot.subscribedTracks += 1;
      if (this.seenTrackSids.has(sid)) this.snapshot.duplicateTrackSids += 1;
      this.seenTrackSids.add(sid);
      this.attachedTrackSids.add(sid);
      this.emit('track-subscribed');
    });
    bind(RoomEvent.TrackUnsubscribed, (track: any, publication: any) => {
      if (track.kind !== Track.Kind.Audio) return;
      this.snapshot.unsubscribedTracks += 1;
      this.attachedTrackSids.delete(publication.trackSid);
      this.emit('track-unsubscribed');
    });
    bind(RoomEvent.TrackSubscriptionFailed, (_sid: string, participant: any, reason?: unknown) => {
      this.snapshot.subscriptionFailures += 1;
      this.snapshot.lastError = reason instanceof Error
        ? reason.message
        : `subscription failed for ${participant?.identity ?? 'unknown'}`;
      this.emit('track-subscription-failed');
    });
    bind(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
      this.snapshot.activeSpeakers = speakers.length;
      this.emit('active-speakers-changed');
    });
    bind(RoomEvent.Reconnecting, () => {
      this.snapshot.reconnecting += 1;
      this.emit('reconnecting');
    });
    bind(RoomEvent.Reconnected, () => {
      this.snapshot.reconnected += 1;
      this.refreshParticipants('reconnected');
    });
    bind(RoomEvent.Disconnected, () => {
      this.snapshot.disconnected += 1;
      this.emit('disconnected');
    });
    bind(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => {
      if (!playing) this.snapshot.playbackBlocked += 1;
      this.emit(playing ? 'audio-playback-restored' : 'audio-playback-blocked');
    });
    bind(RoomEvent.TrackStreamStateChanged, (_publication: any, state: any) => {
      const value = String(state).toLowerCase();
      if (value.includes('paused')) this.snapshot.streamPaused += 1;
      else if (value.includes('active')) this.snapshot.streamResumed += 1;
      this.emit(`stream-state:${value}`);
    });

    this.refreshParticipants('ready');
    return () => this.dispose(room);
  }

  dispose(expectedRoom?: Room): void {
    if (!this.room || (expectedRoom && this.room !== expectedRoom)) return;
    for (const { event, handler } of this.bindings) {
      this.room.off(event, handler as any);
    }
    this.bindings = [];
    this.room = null;
    this.attachedTrackSids.clear();
    this.seenTrackSids.clear();
  }

  private refreshParticipants(event: string): void {
    this.snapshot.participants = this.room?.remoteParticipants.size ?? 0;
    this.snapshot.audioTracks = this.room
      ? [...this.room.remoteParticipants.values()].reduce(
          (count, participant) => count + participant.audioTrackPublications.size,
          0,
        )
      : 0;
    this.emit(event);
  }

  private emit(event: string): void {
    this.snapshot.lastEvent = event;
    const copy = this.getSnapshot();
    this.listeners.forEach(listener => listener(copy));
  }

  private createInitialSnapshot(): VoiceDiagnosticSnapshot {
    return {
      startedAt: Date.now(),
      participants: 0,
      audioTracks: 0,
      subscribedTracks: 0,
      unsubscribedTracks: 0,
      subscriptionFailures: 0,
      activeSpeakers: 0,
      reconnecting: 0,
      reconnected: 0,
      disconnected: 0,
      playbackBlocked: 0,
      streamPaused: 0,
      streamResumed: 0,
      duplicateTrackSids: 0,
    };
  }
}

export const voiceDiagnostics = new VoiceDiagnostics();
