export type VoiceState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export type VoiceParticipant = {
  playerId: string;
  displayName: string;
  muted: boolean;
  speaking: boolean;
  volume: number;
};

export type VoiceChannel = 'main' | 'wolves' | 'ghost';

export type VoiceRoom = {
  gameId: string;
  channel: VoiceChannel;
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
 * Production voice is SFU-backed. Channel membership is enforced server-side
 * by minting a token for a channel-specific LiveKit room.
 */
export const VOICE_LIMITS = {
  maxPlayers: 35,
  topology: 'sfu' as const,
  maxLocalMicTracks: 1,
  reconnectAttempts: 5,
};
