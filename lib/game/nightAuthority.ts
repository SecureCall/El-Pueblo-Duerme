import { Timestamp, type Firestore, runTransaction, doc } from 'firebase-admin/firestore';

export type NightAuthorityInput = {
  gameId: string;
  actorUid: string;
};

export type NightAuthorityResult = {
  processed: boolean;
  reason: 'processed' | 'not-night' | 'not-host' | 'missing-game' | 'already-processed';
  nextPhase?: 'day';
};

/**
 * Server-side guard for the night-resolution boundary.
 *
 * This intentionally does not duplicate the large legacy role engine yet.
 * It atomically claims the night round so two hosts/retries cannot resolve
 * the same night concurrently. The existing role engine can then be invoked
 * exactly once behind this claim.
 */
export async function claimNightResolution(
  firestore: Firestore,
  input: NightAuthorityInput,
): Promise<NightAuthorityResult> {
  const gameRef = doc(firestore, 'games', input.gameId);

  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(gameRef);
    if (!snap.exists) return { processed: false, reason: 'missing-game' };

    const game = snap.data() ?? {};
    if (game.phase !== 'night') return { processed: false, reason: 'not-night' };
    if (game.hostUid !== input.actorUid) return { processed: false, reason: 'not-host' };

    const round = Number(game.roundNumber ?? 1);
    const claimKey = `night:${round}`;
    if (game.nightResolutionClaim === claimKey) {
      return { processed: false, reason: 'already-processed' };
    }

    tx.update(gameRef, {
      nightResolutionClaim: claimKey,
      nightResolutionClaimedAt: Timestamp.now(),
      nightResolutionClaimedBy: input.actorUid,
    });

    return { processed: true, reason: 'processed', nextPhase: 'day' };
  });
}
