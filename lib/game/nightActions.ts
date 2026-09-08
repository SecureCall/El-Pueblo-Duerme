import { auth } from '@/lib/firebase/config';

export interface NightActionResult {
  ok: true;
  validated: true;
  created: boolean;
  resolved: boolean;
  actorUid: string;
  role: string;
  roundNumber: number;
  actions: string[];
}

/**
 * Submit a night action through the server-authoritative admission gate.
 * The client never writes nightActions/nightSubmissions directly.
 */
export async function requestNightAction(
  gameId: string,
  payload: Record<string, unknown>,
): Promise<NightActionResult> {
  if (!gameId) throw new Error('gameId es obligatorio');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload de acción inválido');
  }

  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const response = await fetch('/api/sync-night-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ gameId, uid: user.uid, payload }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo enviar la acción nocturna');
  }
  if (
    data?.ok !== true ||
    data?.validated !== true ||
    typeof data?.created !== 'boolean' ||
    typeof data?.resolved !== 'boolean' ||
    typeof data?.actorUid !== 'string' ||
    typeof data?.role !== 'string' ||
    !Number.isInteger(data?.roundNumber) ||
    !Array.isArray(data?.actions)
  ) {
    throw new Error('Respuesta inválida del servidor para la acción nocturna');
  }

  return data as NightActionResult;
}
