import { auth } from '@/lib/firebase/config';

/** Starts the night through the authoritative server endpoint. */
export async function startNight(gameId: string): Promise<{
  ok: true;
  roundNumber: number;
  nightStartedAt: number;
  phaseEndsAt: number;
}> {
  if (!gameId) throw new Error('gameId es obligatorio');

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Usuario no autenticado');

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/game/start-night', {
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
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo iniciar la noche');
  }

  if (
    data?.ok !== true ||
    !Number.isInteger(data?.roundNumber) ||
    typeof data?.nightStartedAt !== 'number' ||
    typeof data?.phaseEndsAt !== 'number'
  ) {
    throw new Error('Respuesta inválida del servidor al iniciar la noche');
  }

  return {
    ok: true,
    roundNumber: data.roundNumber,
    nightStartedAt: data.nightStartedAt,
    phaseEndsAt: data.phaseEndsAt,
  };
}
