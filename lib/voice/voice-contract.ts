export type VoiceState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export type VoiceParticipant = {
  playerId: string;
  displayName: string;
  muted: boolean;
  speaking: boolean;
  volume: number;
};

export type VoiceRoom = {
  gameId: string;
  maxParticipants: 35;
};

export interface VoiceTransport {
  connect(room: VoiceRoom, participantId: string): Promise<void>;
  disconnect(): Promise<void>;
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  setParticipantVolume(playerId: string, volume: number): Promise<void>;
  onStateChange(listener: (state: VoiceState) => void): () => void;
  onParticipantsChange(listener: (participants: VoiceParticipant[]) => void): () => void;
}

/**
 * Production voice must be backed by an SFU/media service.
 * Do not implement a full-mesh 35-player topology here: 35 peers would
 * create 595 peer-to-peer relationships and is unsuitable for mobile.
 */
export const VOICE_LIMITS = {
  maxPlayers: 35,
  topology: 'sfu' as const,
  maxLocalMicTracks: 1,
  reconnectAttempts: 5,
};
