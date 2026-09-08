import { auth } from '@/lib/firebase/config';

export interface BansheePredictionResult {
  ok: true;
  round: number;
  targetUid: string;
}

export async function requestBansheePrediction(
  gameId: string,
  targetUid: string,
  round: number,
): Promise<BansheePredictionResult> {
  if (!gameId) throw new Error('gameId es obligatorio');
  if (!targetUid) throw new Error('targetUid es obligatorio');
  if (!Number.isInteger(round) || round < 1) throw new Error('round inválido');

  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const response = await fetch('/api/banshee-prediction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ gameId, targetUid, round }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo guardar la predicción de la Banshee');
  }

  if (
    data?.ok !== true ||
    !Number.isInteger(data?.round) ||
    typeof data?.targetUid !== 'string'
  ) {
    throw new Error('Respuesta inválida del servidor al guardar la predicción de la Banshee');
  }

  return {
    ok: true,
    round: data.round,
    targetUid: data.targetUid,
  };
}
