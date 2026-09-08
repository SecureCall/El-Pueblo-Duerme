import { auth } from '@/lib/firebase/config';

export async function requestResolveNight(gameId: string): Promise<{ ok: true }> {
  if (!gameId) throw new Error('gameId es obligatorio');
  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const response = await fetch('/api/resolve-night', {
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
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo resolver la noche');
  }
  if (data?.ok !== true) throw new Error('Respuesta inválida del servidor al resolver la noche');
  return { ok: true };
}
