'use client';

import { auth } from '@/lib/firebase/config';

/**
 * Sends a player's night action to the server.
 *
 * The server is authoritative for role, target validity and round. The client
 * must never write games.nightActions or games.nightSubmissions directly.
 */
export async function submitNightActionToServer(
  gameId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; role: string; roundNumber: number }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Usuario no autenticado');
  if (!gameId) throw new Error('gameId es obligatorio');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload inválido');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/sync-night-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ gameId, uid: currentUser.uid, payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo enviar la acción nocturna');
  }
  if (
    data?.ok !== true ||
    typeof data?.role !== 'string' ||
    !Number.isInteger(data?.roundNumber)
  ) {
    throw new Error('Respuesta inválida del servidor al enviar la acción nocturna');
  }

  return {
    ok: true,
    role: data.role,
    roundNumber: data.roundNumber,
  };
}
