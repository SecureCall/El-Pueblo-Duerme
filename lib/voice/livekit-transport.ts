import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
  Track,
} from 'livekit-client';
import type { VoiceParticipant, VoiceRoom, VoiceState, VoiceTransport } from './voice-contract';
import { fetchVoiceToken, type IdTokenProvider } from './voice-token';

export type LiveKitRoomFactory = () => Room;

export type LiveKitVoiceTransportOptions = {
  getIdToken: IdTokenProvider;
  getDisplayName?: () => string | undefined;
};

type AttachedAudio = {
  track: RemoteTrack;
  element: HTMLMediaElement;
};

export class LiveKitVoiceTransport implements VoiceTransport {
  private room: Room | null = null;
  private stateListeners = new Set<(state: VoiceState) => void>();
  private participantListeners = new Set<(participants: VoiceParticipant[]) => void>();
  private roomFactory: LiveKitRoomFactory;
  private getIdToken: IdTokenProvider;
  private getDisplayName?: () => string | undefined;
  private activeSpeakerIds = new Set<string>();
  private participantVolumes = new Map<string, number>();
  private attachedAudio = new Map<string, AttachedAudio>();

  constructor(
    roomFactory: LiveKitRoomFactory,
    options: LiveKitVoiceTransportOptions,
  ) {
    this.roomFactory = roomFactory;
    this.getIdToken = options.getIdToken;
    this.getDisplayName = options.getDisplayName;
  }

  onStateChange(listener: (state: VoiceState) => void) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onParticipantsChange(listener: (participants: VoiceParticipant[]) => void) {
    this.participantListeners.add(listener);
    return () => this.participantListeners.delete(listener);
  }

  async connect(room: VoiceRoom, participantId: string) {
    if (room.maxParticipants > 35) {
      throw new Error('Voice room exceeds the 35-player limit');
    }

    await this.disconnect();
    this.emitState('connecting');

    // LiveKit credentials are minted by the authenticated server and are
    // deliberately not stored in VoiceRoom or Firestore.
    const credentials = await fetchVoiceToken(
      room.gameId,
      this.getIdToken,
      this.getDisplayName?.(),
    );

    // The token endpoint derives the LiveKit identity from Firebase Auth.
    // Refuse to connect if the controller and server disagree about identity.
    if (credentials.participant_identity !== participantId) {
      throw new Error('Voice participant identity mismatch');
    }

    const roomInstance = this.roomFactory();
    this.room = roomInstance;

    roomInstance
      .on(RoomEvent.ParticipantConnected, () => this.emitParticipants())
      .on(RoomEvent.ParticipantDisconnected, participant => {
        this.activeSpeakerIds.delete(participant.identity);
        this.emitParticipants();
      })
      .on(RoomEvent.ParticipantMetadataChanged, () => this.emitParticipants())
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        this.attachAudioTrack(track, publication, participant.identity);
        this.emitParticipants();
      })
      .on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
        this.detachAudioTrack(publication.trackSid);
        this.emitParticipants();
      })
      .on(RoomEvent.TrackMuted, () => this.emitParticipants())
      .on(RoomEvent.TrackUnmuted, () => this.emitParticipants())
      .on(RoomEvent.ActiveSpeakersChanged, speakers => {
        this.activeSpeakerIds = new Set(
          speakers.map(speaker => speaker.identity),
        );
        this.emitParticipants();
      })
      .on(RoomEvent.Reconnecting, () => this.emitState('reconnecting'))
      .on(RoomEvent.Reconnected, () => {
        this.emitState('connected');
        this.emitParticipants();
      })
      .on(RoomEvent.Disconnected, () => this.emitState('disconnected'))
      .on(RoomEvent.AudioPlaybackStatusChanged, playing => {
        if (!playing) this.emitState('reconnecting');
      });

    await roomInstance.connect(
      credentials.server_url,
      credentials.participant_token,
      { autoSubscribe: true },
    );

    this.emitState('connected');
    this.emitParticipants();
  }

  async setMicrophoneEnabled(enabled: boolean) {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  async setParticipantVolume(playerId: string, volume: number) {
    const normalized = Math.max(0, Math.min(1, volume));
    this.participantVolumes.set(playerId, normalized);

    const participant = this.room?.remoteParticipants.get(playerId);
    if (!participant) return;

    // RemoteParticipant owns the playback volume API. RemoteTrack does not
    // expose setVolume in the current LiveKit client typings.
    participant.setVolume(normalized);

    for (const attached of this.attachedAudio.values()) {
      if (attached.element.dataset.voiceParticipantId === playerId) {
        attached.element.volume = normalized;
      }
    }
  }

  async disconnect() {
    if (!this.room) return;

    this.detachAllAudio();
    await this.room.disconnect();
    this.room = null;
    this.activeSpeakerIds.clear();
    this.emitState('disconnected');
    this.emitParticipants();
  }

  private attachAudioTrack(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participantId: string,
  ) {
    if (track.kind !== Track.Kind.Audio || typeof document === 'undefined') return;

    const key = publication.trackSid;
    this.detachAudioTrack(key);

    const element = track.attach();
    element.autoplay = true;
    element.setAttribute('aria-hidden', 'true');
    element.dataset.voiceParticipantId = participantId;
    element.style.position = 'fixed';
    element.style.width = '1px';
    element.style.height = '1px';
    element.style.opacity = '0';
    element.style.pointerEvents = 'none';
    document.body.appendChild(element);

    const volume = this.participantVolumes.get(participantId) ?? 1;
    element.volume = volume;

    this.attachedAudio.set(key, { track, element });
  }

  private detachAudioTrack(trackSid?: string) {
    if (!trackSid) return;

    const attached = this.attachedAudio.get(trackSid);
    if (!attached) return;

    attached.track.detach(attached.element);
    attached.element.remove();
    this.attachedAudio.delete(trackSid);
  }

  private detachAllAudio() {
    for (const [trackSid, attached] of this.attachedAudio) {
      attached.track.detach(attached.element);
      attached.element.remove();
      this.attachedAudio.delete(trackSid);
    }
  }

  private emitState(state: VoiceState) {
    this.stateListeners.forEach(listener => listener(state));
  }

  private emitParticipants() {
    const participants: VoiceParticipant[] = [];

    if (this.room) {
      for (const participant of this.room.remoteParticipants.values()) {
        const volume = this.participantVolumes.get(participant.identity) ?? participant.getVolume() ?? 1;
        participants.push({
          playerId: participant.identity,
          displayName: participant.name || participant.identity,
          muted: [...participant.audioTrackPublications.values()].every(
            publication => publication.isMuted,
          ),
          speaking: this.activeSpeakerIds.has(participant.identity),
          volume,
        });
      }
    }

    this.participantListeners.forEach(listener => listener(participants));
  }
}
