import { auth } from '@/lib/firebase/config';

export async function requestHostTakeover(gameId: string): Promise<{ ok: true; takenOver: boolean; hostUid: string }> {
  if (!gameId) throw new Error('gameId es obligatorio');
  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const response = await fetch('/api/host-takeover', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ gameId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo asumir el host');
  }
  if (data?.ok !== true || typeof data?.hostUid !== 'string' || typeof data?.takenOver !== 'boolean') {
    throw new Error('Respuesta inválida del servidor al asumir el host');
  }

  return { ok: true, takenOver: data.takenOver, hostUid: data.hostUid };
}
