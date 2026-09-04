import { auth } from '@/lib/firebase/config';

/**
 * Submit one player's night action through the authoritative server endpoint.
 * The client never writes nightSubmissions/nightActions directly.
 */
export async function syncNightAction(
  gameId: string,
  uid: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; role: string }> {
  if (!gameId || !uid) throw new Error('gameId y uid son obligatorios');

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Usuario no autenticado');
  if (currentUser.uid !== uid) throw new Error('El usuario autenticado no coincide con el actor');

  const idToken = await currentUser.getIdToken();
  const requestId = `${uid}:${gameId}:${Date.now()}:${crypto.randomUUID()}`;

  const response = await fetch('/api/sync-night-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Request-Id': requestId,
    },
    credentials: 'include',
    body: JSON.stringify({ gameId, uid, payload, requestId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo sincronizar la acción nocturna');
  }
  if (data?.ok !== true || typeof data?.role !== 'string') {
    throw new Error('Respuesta inválida del servidor al sincronizar la acción nocturna');
  }

  return { ok: true, role: data.role };
}
