export interface ChaosRevivePlayer {
  uid: string;
  isAlive: boolean;
}

export interface ChaosReviveHistoryEntry {
  uid: string;
}

export interface ChaosReviveResult {
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
 * Selects the `revive` chaos victim deterministically on the server.
 * The candidate set is the authoritative set of currently-dead players,
 * with stable ordering so retries and reordered Firestore snapshots agree.
 */
export function chooseChaosReviveTarget(
  gameId: string,
  roundNumber: number,
  players: ChaosRevivePlayer[],
  eliminatedHistory: ChaosReviveHistoryEntry[],
): ChaosReviveResult {
  const deadUids = new Set(
    players
      .filter((player) => player?.isAlive === false && typeof player.uid === 'string' && player.uid.length > 0)
      .map((player) => player.uid),
  );

  const candidates = [...deadUids]
    .filter((uid) => eliminatedHistory.some((entry) => entry?.uid === uid))
    .sort();

  if (candidates.length === 0) return { targetUid: null };

  const index = hashSeed(`${gameId}:${roundNumber}:revive`) % candidates.length;
  return { targetUid: candidates[index] };
}
