import { auth } from '@/lib/firebase/config';

export async function syncNightAction(gameId: string, uid: string, payload: Record<string, unknown>): Promise<{ ok: true; role: string }> {
  if (!gameId || !uid) throw new Error('gameId y uid son obligatorios');
  if (auth.currentUser?.uid !== uid) throw new Error('El usuario autenticado no coincide con el actor');
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch('/api/sync-night-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    credentials: 'include',
    body: JSON.stringify({ gameId, uid, payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo sincronizar la acción nocturna');
  if (data?.ok !== true || typeof data?.role !== 'string') throw new Error('Respuesta inválida del servidor al sincronizar la acción nocturna');
  return { ok: true, role: data.role };
}
