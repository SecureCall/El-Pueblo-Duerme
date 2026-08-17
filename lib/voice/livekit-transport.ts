import type { Participant, Room, RemoteTrackPublication } from 'livekit-client';
import type { VoiceParticipant, VoiceRoom, VoiceState, VoiceTransport } from './voice-contract';

export type LiveKitRoomFactory = () => Room;

export class LiveKitVoiceTransport implements VoiceTransport {
  private room: Room | null = null;
  private stateListeners = new Set<(state: VoiceState) => void>();
  private participantListeners = new Set<(participants: VoiceParticipant[]) => void>();
  private roomFactory: LiveKitRoomFactory;

  constructor(roomFactory: LiveKitRoomFactory) {
    this.roomFactory = roomFactory;
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
    const roomInstance = this.roomFactory();
    this.room = roomInstance;
    this.emitState('connecting');

    roomInstance.on('participantConnected', () => this.emitParticipants());
    roomInstance.on('participantDisconnected', () => this.emitParticipants());
    roomInstance.on('participantMetadataChanged', () => this.emitParticipants());
    roomInstance.on('trackSubscribed', () => this.emitParticipants());
    roomInstance.on('trackUnsubscribed', () => this.emitParticipants());
    roomInstance.on('reconnecting', () => this.emitState('reconnecting'));
    roomInstance.on('reconnected', () => { this.emitState('connected'); this.emitParticipants(); });
    roomInstance.on('disconnected', () => this.emitState('disconnected'));

    await roomInstance.connect(room.serverUrl, room.token, { autoSubscribe: true });
    this.emitState('connected');
    this.emitParticipants();
  }

  async setMicrophoneEnabled(enabled: boolean) {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  async setParticipantVolume(playerId: string, volume: number) {
    const participant = this.room?.remoteParticipants.get(playerId);
    if (!participant) return;
    const normalized = Math.max(0, Math.min(1, volume));
    participant.audioTrackPublications.forEach((publication: RemoteTrackPublication) => {
      const track = publication.track;
      if (track && 'setVolume' in track && typeof track.setVolume === 'function') {
        track.setVolume(normalized);
      }
    });
  }

  async disconnect() {
    if (!this.room) return;
    await this.room.disconnect();
    this.room = null;
    this.emitState('disconnected');
    this.emitParticipants();
  }

  private emitState(state: VoiceState) {
    this.stateListeners.forEach(listener => listener(state));
  }

  private emitParticipants() {
    const participants = [...(this.room?.remoteParticipants.values() ?? [])].map((participant: Participant) => ({
      id: participant.identity,
      displayName: participant.name || participant.identity,
      muted: [...participant.audioTrackPublications.values()].every(publication => publication.isMuted),
    }));
    this.participantListeners.forEach(listener => listener(participants));
  }
}
