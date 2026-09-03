import type { VoiceParticipant, VoiceRoom, VoiceState, VoiceTransport } from './voice-contract';

export class VoiceController {
  private state: VoiceState = 'idle';
  private participants: VoiceParticipant[] = [];
  private transport: VoiceTransport | null = null;
  private unsubs: Array<() => void> = [];
  private participantListeners = new Set<(participants: VoiceParticipant[]) => void>();
  private stateListeners = new Set<(state: VoiceState) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectCount = 0;

  constructor(private readonly transportFactory: () => VoiceTransport) {}

  getState() { return this.state; }
  getParticipants() { return [...this.participants]; }

  onStateChange(listener: (state: VoiceState) => void) {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  onParticipantsChange(listener: (participants: VoiceParticipant[]) => void) {
    this.participantListeners.add(listener);
    listener(this.getParticipants());
    return () => this.participantListeners.delete(listener);
  }

  async connect(room: VoiceRoom, participantId: string): Promise<void> {
    this.clearReconnect();
    await this.cleanupTransport();
    const transport = this.transportFactory();
    this.transport = transport;
    this.unsubs.push(transport.onStateChange(state => this.handleState(state, room, participantId)));
    this.unsubs.push(transport.onParticipantsChange(participants => {
      this.participants = participants;
      this.participantListeners.forEach(listener => listener(this.getParticipants()));
    }));
    this.setState('connecting');
    this.reconnectCount = 0;
    try {
      await transport.connect(room, participantId);
    } catch (error) {
      this.setState('failed');
      this.scheduleReconnect(room, participantId);
      throw error;
    }
  }

  async setMicrophoneEnabled(enabled: boolean) {
    if (!this.transport) return;
    await this.transport.setMicrophoneEnabled(enabled);
  }

  async setParticipantVolume(playerId: string, volume: number) {
    if (!this.transport) return;
    await this.transport.setParticipantVolume(playerId, Math.max(0, Math.min(1, volume)));
  }

  async disconnect() {
    this.clearReconnect();
    await this.cleanupTransport();
    this.setState('disconnected');
    this.participants = [];
    this.participantListeners.forEach(listener => listener([]));
  }

  private handleState(state: VoiceState, room: VoiceRoom, participantId: string) {
    this.setState(state);
    if (state === 'connected') this.reconnectCount = 0;
    if ((state === 'reconnecting' || state === 'failed') && this.reconnectCount < 5) {
      this.scheduleReconnect(room, participantId);
    }
  }

  private scheduleReconnect(room: VoiceRoom, participantId: string) {
    if (this.reconnectTimer || this.reconnectCount >= 5) return;
    const attempt = ++this.reconnectCount;
    const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect(room, participantId);
      } catch {
        this.scheduleReconnect(room, participantId);
      }
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setState(state: VoiceState) {
    this.state = state;
    this.stateListeners.forEach(listener => listener(state));
  }

  private async cleanupTransport() {
    this.unsubs.splice(0).forEach(unsub => unsub());
    if (this.transport) await this.transport.disconnect().catch(() => undefined);
    this.transport = null;
  }
}
