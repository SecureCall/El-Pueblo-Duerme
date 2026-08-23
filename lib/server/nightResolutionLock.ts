import type { Firestore } from 'firebase-admin/firestore';

export interface NightResolutionLockResult {
  acquired: boolean;
  reason?: 'already_resolving' | 'already_resolved';
}

/**
 * Atomically claims one resolution slot for a game round.
 * The lock lives outside the public game document so clients cannot forge it.
 * The actual resolver should call this immediately before its first state mutation.
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
      return { acquired: false, reason: 'already_resolving' };
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
