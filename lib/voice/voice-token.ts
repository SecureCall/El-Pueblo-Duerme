import type { VoiceChannel } from './voice-contract';

export interface VoiceTokenResponse {
  server_url: string;
  participant_token: string;
  room_name: string;
  participant_identity: string;
}

export type IdTokenProvider = () => Promise<string | null>;

export async function fetchVoiceToken(
  gameId: string,
  channel: VoiceChannel,
  getIdToken: IdTokenProvider,
  displayName?: string,
): Promise<VoiceTokenResponse> {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Authentication required for voice');

  const response = await fetch('/api/voice/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ gameId, channel, displayName }),
    credentials: 'include',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : 'Unable to connect voice';
    throw new Error(message);
  }

  if (!payload || typeof payload.server_url !== 'string' || typeof payload.participant_token !== 'string') {
    throw new Error('Invalid voice credentials');
  }

  return payload as VoiceTokenResponse;
}
