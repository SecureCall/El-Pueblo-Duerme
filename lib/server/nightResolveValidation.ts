import type { NightActionSubmission, NightSubmission } from '@/lib/game/nightResolution';

export interface NightResolveValidationResult {
  valid: NightSubmission[];
  rejected: Array<{ actorUid: string; reason: string }>;
}

/**
 * Re-validates persisted night submissions against the current game state.
 * A submission is valid only when it belongs to the exact active round.
 * This prevents a stale per-player document from being replayed in a later night.
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

    // Round binding is mandatory. Missing roundNumber is stale/legacy data,
    // not a valid submission for the current night.
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
    if (actions.some((action) => !action || typeof action.action !== 'string')) {
      rejected.push({ actorUid: submission.actorUid, reason: 'malformed_action' });
      continue;
    }

    valid.push(submission);
  }

  return { valid, rejected };
}
