/**
 * Sends a night action through the authenticated server endpoint.
 * The server derives the real role from playerRoles/{uid}; callers must not
 * send a role field as an authority signal.
 */
export async function syncNightAction(
  gameId: string,
  uid: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; role: string }> {
  if (!gameId || !uid) {
    throw new Error('gameId y uid son obligatorios');
  }

  const response = await fetch('/api/sync-night-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ gameId, uid, payload }),
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
