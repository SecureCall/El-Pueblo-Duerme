import { validateCanonicalNightSubmissions } from '@/lib/game/nightActionAuthority';
import type { NightActionSubmission, NightSubmission } from '@/lib/game/nightResolution';

export interface NightResolveValidationResult {
  valid: NightSubmission[];
  rejected: Array<{ actorUid: string; reason: string }>;
}

/**
 * Re-validates persisted night submissions against the canonical admission
 * contract. This is deliberately performed again at resolution time because
 * the persisted document is an untrusted boundary even when it was written
 * by our own API.
 */
export function validatePersistedNightSubmissions(
  players: Array<Record<string, unknown>>,
  submissions: NightSubmission[],
  roundNumber: number | null,
): NightResolveValidationResult {
  const playerByUid = new Map(
    players
      .filter((player) => typeof player.uid === 'string')
      .map((player) => [player.uid as string, player]),
  );
  const validationPlayers = players
    .filter((player) => typeof player.uid === 'string')
    .map((player) => ({ uid: player.uid as string, isAlive: player.isAlive === true }));

  const valid: NightSubmission[] = [];
  const rejected: Array<{ actorUid: string; reason: string }> = [];

  for (const submission of submissions) {
    const player = playerByUid.get(submission.actorUid);
    if (!player) {
      rejected.push({ actorUid: submission.actorUid, reason: 'actor_not_in_game' });
      continue;
    }
    if (player.isAlive === false) {
      rejected.push({ actorUid: submission.actorUid, reason: 'actor_dead' });
      continue;
    }
    if (roundNumber === null || !Number.isInteger(roundNumber) || roundNumber < 1) {
      rejected.push({ actorUid: submission.actorUid, reason: 'invalid_active_round' });
      continue;
    }
    if (submission.roundNumber !== roundNumber) {
      rejected.push({
        actorUid: submission.actorUid,
        reason: submission.roundNumber == null ? 'missing_round' : 'stale_round',
      });
      continue;
    }
    if (!Array.isArray(submission.actions)) {
      rejected.push({ actorUid: submission.actorUid, reason: 'invalid_actions' });
      continue;
    }

    const actions = submission.actions as NightActionSubmission[];
    const malformed = actions.some(
      (action) => !action || typeof action.action !== 'string' || action.actorUid !== submission.actorUid,
    );
    if (malformed) {
      rejected.push({ actorUid: submission.actorUid, reason: 'malformed_or_actor_mismatch' });
      continue;
    }

    const role = typeof submission.role === 'string' ? submission.role : '';
    if (!role) {
      rejected.push({ actorUid: submission.actorUid, reason: 'missing_role' });
      continue;
    }

    const canonical = validateCanonicalNightSubmissions(
      validationPlayers,
      submission.actorUid,
      role,
      roundNumber,
      actions,
    );
    if (!canonical.valid) {
      rejected.push({
        actorUid: submission.actorUid,
        reason: canonical.errors.join('|'),
      });
      continue;
    }

    valid.push(submission);
  }

  return { valid, rejected };
}
