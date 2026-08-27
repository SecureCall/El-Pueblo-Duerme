import { auth } from '@/lib/firebase/config';

export async function syncVote(gameId: string, target: string): Promise<{ ok: true; round: number }> {
  if (!gameId || !target) throw new Error('gameId y target son obligatorios');

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Usuario no autenticado');

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/sync-vote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ gameId, target }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo sincronizar el voto');
  }

  if (data?.ok !== true || !Number.isInteger(data?.round)) {
    throw new Error('Respuesta inválida del servidor al sincronizar el voto');
  }

  return { ok: true, round: data.round };
}
