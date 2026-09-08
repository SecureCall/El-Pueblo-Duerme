import { auth } from '@/lib/firebase/config';

export type NarratorBroadcastType = 'warning' | 'suspicion' | 'chaos' | 'irony' | 'accusation';

export async function requestNarratorBroadcast(
  gameId: string,
  text: string,
  type: NarratorBroadcastType,
): Promise<{ ok: true }> {
  if (!gameId) throw new Error('gameId es obligatorio');
  if (!text.trim() || text.trim().length > 280) throw new Error('Texto inválido');

  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const response = await fetch('/api/narrator-broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ gameId, text: text.trim(), type }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo emitir la narración');
  }
  if (data?.ok !== true) throw new Error('Respuesta inválida del servidor al emitir la narración');
  return { ok: true };
}
