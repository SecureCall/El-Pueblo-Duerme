import { auth } from '@/lib/firebase/config';

/**
 * Ask the authoritative server to resolve the current day.
 * The client supplies no votes, roles, deaths, winners, or state patch.
 *
 * The server owns both lease acquisition and the final resolution. The client
 * only orchestrates the claim -> commit handshake and never computes game state.
 */
export async function requestResolveDay(gameId: string): Promise<{ ok: true; status?: string }> {
  if (!gameId) throw new Error('gameId es obligatorio');
  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };

  const claimResponse = await fetch('/api/day-resolve', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ gameId, action: 'claim' }),
  });

  const claimData = await claimResponse.json().catch(() => ({}));
  if (!claimResponse.ok || claimData?.ok !== true || typeof claimData?.leaseId !== 'string') {
    throw new Error(typeof claimData?.error === 'string' ? claimData.error : 'No se pudo reclamar la resolución del día');
  }

  const leaseId = claimData.leaseId;
  const round = Number(claimData.round);
  if (!Number.isInteger(round)) throw new Error('Respuesta inválida del servidor al reclamar la resolución del día');

  try {
    const commitResponse = await fetch('/api/day-resolve', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ gameId, action: 'commit', leaseId, round }),
    });

    const commitData = await commitResponse.json().catch(() => ({}));
    if (!commitResponse.ok || commitData?.ok !== true || commitData?.committed !== true) {
      throw new Error(typeof commitData?.error === 'string' ? commitData.error : 'No se pudo confirmar la resolución del día');
    }

    return { ok: true, status: 'committed' };
  } catch (error) {
    // Best-effort release. If the server already consumed the lease or it
    // expired, there is nothing else the client should mutate locally.
    await fetch('/api/day-resolve', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ gameId, action: 'release', leaseId }),
    }).catch(() => {});
    throw error;
  }
}
