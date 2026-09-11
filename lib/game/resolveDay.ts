import { auth } from '@/lib/firebase/config';

/**
 * Ask the authoritative server to resolve the current day.
 * The client supplies no votes, roles, deaths, winners, or state patch.
 */
export async function requestResolveDay(gameId: string): Promise<{ ok: true; status?: string }> {
  if (!gameId) throw new Error('gameId es obligatorio');
  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const response = await fetch('/api/day-resolve', {
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
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo resolver el día');
  }
  if (data?.ok !== true) throw new Error('Respuesta inválida del servidor al resolver el día');
  return { ok: true, status: typeof data?.status === 'string' ? data.status : undefined };
}
