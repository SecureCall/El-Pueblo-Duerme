import { auth } from '@/lib/firebase/config';

export interface VoteSummary {
  round: number;
  counts: Record<string, number>;
  myVote: string | null;
  totalVoted: number;
}

/** Fetches only aggregate vote state. The client never reads votes directly. */
export async function fetchVoteSummary(gameId: string): Promise<VoteSummary> {
  if (!gameId) throw new Error('gameId requerido');
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Usuario no autenticado');
  const idToken = await currentUser.getIdToken();
  const response = await fetch(`/api/vote-summary?gameId=${encodeURIComponent(gameId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo obtener el resumen de votos');
  if (!Number.isInteger(data?.round) || typeof data?.counts !== 'object' || data.counts === null ||
      (data.myVote !== null && typeof data.myVote !== 'string') || !Number.isInteger(data?.totalVoted)) {
    throw new Error('Respuesta inválida del servidor al obtener el resumen de votos');
  }
  return { round: data.round, counts: data.counts as Record<string, number>, myVote: data.myVote, totalVoted: data.totalVoted };
}
