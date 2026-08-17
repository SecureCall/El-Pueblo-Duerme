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

export class VoiceDiagnostics {
  private room: Room | null = null;
  private listeners = new Set<VoiceDiagnosticListener>();
  private snapshot: VoiceDiagnosticSnapshot = this.createInitialSnapshot();
  private seenTrackSids = new Set<string>();
  private attachedTrackSids = new Set<string>();

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

    const onParticipantConnected = () => this.refreshParticipants('participant-connected');
    const onParticipantDisconnected = () => this.refreshParticipants('participant-disconnected');
    const onSubscribed = (track: any, publication: any) => {
      if (track.kind !== Track.Kind.Audio) return;
      const sid = publication.trackSid;
      this.snapshot.subscribedTracks += 1;
      if (this.seenTrackSids.has(sid)) this.snapshot.duplicateTrackSids += 1;
      this.seenTrackSids.add(sid);
      this.attachedTrackSids.add(sid);
      this.emit('track-subscribed');
    };
    const onUnsubscribed = (track: any, publication: any) => {
      if (track.kind !== Track.Kind.Audio) return;
      this.snapshot.unsubscribedTracks += 1;
      this.attachedTrackSids.delete(publication.trackSid);
      this.emit('track-unsubscribed');
    };
    const onSubscriptionFailed = (_sid: string, participant: any, reason?: unknown) => {
      this.snapshot.subscriptionFailures += 1;
      this.snapshot.lastError = reason instanceof Error ? reason.message : `subscription failed for ${participant?.identity ?? 'unknown'}`;
      this.emit('track-subscription-failed');
    };
    const onActiveSpeakersChanged = (speakers: any[]) => {
      this.snapshot.activeSpeakers = speakers.length;
      this.emit('active-speakers-changed');
    };
    const onReconnecting = () => {
      this.snapshot.reconnecting += 1;
      this.emit('reconnecting');
    };
    const onReconnected = () => {
      this.snapshot.reconnected += 1;
      this.refreshParticipants('reconnected');
    };
    const onDisconnected = () => {
      this.snapshot.disconnected += 1;
      this.emit('disconnected');
    };
    const onPlayback = (playing: boolean) => {
      if (!playing) this.snapshot.playbackBlocked += 1;
      this.emit(playing ? 'audio-playback-restored' : 'audio-playback-blocked');
    };
    const onStreamStateChanged = (_publication: any, state: any) => {
      const value = String(state).toLowerCase();
      if (value.includes('paused')) this.snapshot.streamPaused += 1;
      else if (value.includes('active')) this.snapshot.streamResumed += 1;
      this.emit(`stream-state:${value}`);
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.TrackSubscriptionFailed, onSubscriptionFailed)
      .on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
      .on(RoomEvent.Reconnecting, onReconnecting)
      .on(RoomEvent.Reconnected, onReconnected)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.AudioPlaybackStatusChanged, onPlayback)
      .on(RoomEvent.TrackStreamStateChanged, onStreamStateChanged);

    this.refreshParticipants('ready');

    return () => this.dispose(room);
  }

  dispose(expectedRoom?: Room): void {
    if (!this.room || (expectedRoom && this.room !== expectedRoom)) return;
    this.room.removeAllListeners(RoomEvent.ParticipantConnected);
    this.room.removeAllListeners(RoomEvent.ParticipantDisconnected);
    this.room.removeAllListeners(RoomEvent.TrackSubscribed);
    this.room.removeAllListeners(RoomEvent.TrackUnsubscribed);
    this.room.removeAllListeners(RoomEvent.TrackSubscriptionFailed);
    this.room.removeAllListeners(RoomEvent.ActiveSpeakersChanged);
    this.room.removeAllListeners(RoomEvent.Reconnecting);
    this.room.removeAllListeners(RoomEvent.Reconnected);
    this.room.removeAllListeners(RoomEvent.Disconnected);
    this.room.removeAllListeners(RoomEvent.AudioPlaybackStatusChanged);
    this.room.removeAllListeners(RoomEvent.TrackStreamStateChanged);
    this.room = null;
    this.attachedTrackSids.clear();
    this.seenTrackSids.clear();
  }

  private refreshParticipants(event: string): void {
    this.snapshot.participants = this.room?.remoteParticipants.size ?? 0;
    this.snapshot.audioTracks = this.room
      ? [...this.room.remoteParticipants.values()].reduce((count, participant) => count + participant.audioTrackPublications.size, 0)
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
