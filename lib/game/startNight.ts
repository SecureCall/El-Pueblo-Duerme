import { auth } from '@/lib/firebase/config';

export interface StartNightResult {
  ok: true;
  roundNumber: number;
  nightStartedAt: number;
  phaseEndsAt: number;
}

export async function requestStartNight(gameId: string): Promise<StartNightResult> {
  if (!gameId) throw new Error('gameId es obligatorio');
  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const response = await fetch('/api/start-night', {
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
