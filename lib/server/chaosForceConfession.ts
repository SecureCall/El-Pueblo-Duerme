export interface ForceConfessionPlayer {
  uid: string;
  isAlive: boolean;
}

export interface ForceConfessionResult {
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
 * Selects the forced-confession player deterministically on the server.
 * Only the authoritative living-player snapshot participates in selection,
 * so retries, scheduler execution and reordered Firestore snapshots agree.
 */
export function chooseForceConfessionTarget(
  gameId: string,
  roundNumber: number,
  players: ForceConfessionPlayer[],
): ForceConfessionResult {
  const livingUids = players
    .filter((player) => player?.isAlive === true && typeof player.uid === 'string' && player.uid.length > 0)
    .map((player) => player.uid)
    .sort();

  if (livingUids.length === 0) return { targetUid: null };

  const index = hashSeed(`${gameId}:${roundNumber}:forceConfession`) % livingUids.length;
  return { targetUid: livingUids[index] };
}
