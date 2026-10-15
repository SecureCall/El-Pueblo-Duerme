export interface AiEliminatePlayer {
  uid: string;
  isAlive: boolean;
}

export interface AiEliminateResult {
  targetUid: string | null;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Chooses the `aiEliminate` victim deterministically on the server.
 * The candidate set is derived only from the authoritative living-player
 * snapshot and the immutable game/round inputs, so retries produce the same
 * victim without relying on client randomness.
 */
export function chooseAiEliminateTarget(
  gameId: string,
  roundNumber: number,
  players: AiEliminatePlayer[],
): AiEliminateResult {
  const livingUids = players
    .filter((player) => player?.isAlive === true && typeof player.uid === 'string' && player.uid.length > 0)
    .map((player) => player.uid)
    .sort();

  if (livingUids.length === 0) return { targetUid: null };

  const index = hashSeed(`${gameId}:${roundNumber}:aiEliminate`) % livingUids.length;
  return { targetUid: livingUids[index] };
}
