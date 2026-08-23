import type { Firestore } from 'firebase-admin/firestore';

export interface NightResolutionLockResult {
  acquired: boolean;
  reason?: 'already_resolving' | 'already_resolved';
}

const RESOLUTION_LEASE_MS = 60_000;

/**
 * Atomically claims one resolution slot for a game round.
 * The lock lives outside the public game document so clients cannot forge it.
 * A stale resolving lock can be reclaimed after the lease expires.
 */
export async function claimNightResolution(
  db: Firestore,
  gameId: string,
  roundNumber: number,
): Promise<NightResolutionLockResult> {
  const lockRef = db
    .collection('games')
    .doc(gameId)
    .collection('nightResolutions')
    .doc(String(roundNumber));

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(lockRef);

    if (snapshot.exists) {
      const data = snapshot.data() as Record<string, unknown>;
      if (data.status === 'resolved') {
        return { acquired: false, reason: 'already_resolved' };
      }

      const startedAt = data.startedAt;
      const startedMillis =
        startedAt && typeof (startedAt as { toMillis?: unknown }).toMillis === 'function'
          ? (startedAt as { toMillis: () => number }).toMillis()
          : 0;

      if (startedMillis > 0 && Date.now() - startedMillis < RESOLUTION_LEASE_MS) {
        return { acquired: false, reason: 'already_resolving' };
      }

      tx.update(lockRef, {
        status: 'resolving',
        startedAt: new Date(),
        reclaimedAt: new Date(),
      });
      return { acquired: true };
    }

    tx.create(lockRef, {
      status: 'resolving',
      roundNumber,
      startedAt: new Date(),
    });

    return { acquired: true };
  });
}

export async function markNightResolutionResolved(
  db: Firestore,
  gameId: string,
  roundNumber: number,
): Promise<void> {
  const lockRef = db
    .collection('games')
    .doc(gameId)
    .collection('nightResolutions')
    .doc(String(roundNumber));

  await lockRef.update({
    status: 'resolved',
    resolvedAt: new Date(),
  });
}

/**
 * Releases a failed/incomplete resolution so the next attempt can recover.
 * This must only be called by trusted server code after a resolver failure.
 */
export async function releaseNightResolution(
  db: Firestore,
  gameId: string,
  roundNumber: number,
): Promise<void> {
  const lockRef = db
    .collection('games')
    .doc(gameId)
    .collection('nightResolutions')
    .doc(String(roundNumber));

  await lockRef.delete();
}
