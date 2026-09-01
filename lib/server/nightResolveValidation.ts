import type { NightActionSubmission, NightSubmission } from '@/lib/game/nightResolution';

export interface NightResolveValidationResult {
  valid: NightSubmission[];
  rejected: Array<{ actorUid: string; reason: string }>;
}

const BOOLEAN_ACTIONS = new Set(['witchSave', 'vigiaActivate', 'espiaActivate', '_skip']);
const DEAD_TARGET_ACTIONS = new Set(['angelResucitarTarget', 'forenseTarget']);

/**
 * Re-validates persisted night submissions against the current game state.
 * Round binding and actor ownership are mandatory. Dead targets are allowed
 * only for roles whose rules explicitly require selecting a corpse.
 */
export function validatePersistedNightSubmissions(
  players: Array<Record<string, unknown>>,
  submissions: NightSubmission[],
  roundNumber: number | null,
): NightResolveValidationResult {
  const playerByUid = new Map(
    players.filter((player) => typeof player.uid === 'string').map((player) => [player.uid as string, player]),
  );
  const valid: NightSubmission[] = [];
  const rejected: Array<{ actorUid: string; reason: string }> = [];

  for (const submission of submissions) {
    const player = playerByUid.get(submission.actorUid);
    if (!player) { rejected.push({ actorUid: submission.actorUid, reason: 'actor_not_in_game' }); continue; }
    if (player.isAlive === false) { rejected.push({ actorUid: submission.actorUid, reason: 'actor_dead' }); continue; }
    if (roundNumber === null || !Number.isInteger(roundNumber) || roundNumber < 1) {
      rejected.push({ actorUid: submission.actorUid, reason: 'invalid_active_round' }); continue;
    }
    if (submission.roundNumber !== roundNumber) {
      rejected.push({ actorUid: submission.actorUid, reason: submission.roundNumber == null ? 'missing_round' : 'stale_round' });
      continue;
    }
    if (!Array.isArray(submission.actions)) { rejected.push({ actorUid: submission.actorUid, reason: 'invalid_actions' }); continue; }

    const actions = submission.actions as NightActionSubmission[];
    const malformed = actions.some((action) => !action || typeof action.action !== 'string');
    if (malformed) { rejected.push({ actorUid: submission.actorUid, reason: 'malformed_action' }); continue; }

    // Reject false/invalid boolean controls here so the engine cannot treat a
    // mere presence of an action name as activation.
    const invalidBoolean = actions.find((action) => BOOLEAN_ACTIONS.has(action.action) && action.action !== '_skip' && action.value !== true);
    if (invalidBoolean) {
      rejected.push({ actorUid: submission.actorUid, reason: `invalid_boolean:${invalidBoolean.action}` });
      continue;
    }

    const invalidActor = actions.find((action) => action.actorUid !== submission.actorUid);
    if (invalidActor) { rejected.push({ actorUid: submission.actorUid, reason: 'actor_mismatch' }); continue; }

    const invalidTarget = actions.find((action) => {
      if (action.targetUid) {
        const target = playerByUid.get(action.targetUid);
        if (!target) return true;
        if (target.isAlive === false && !DEAD_TARGET_ACTIONS.has(action.action)) return true;
      }
      if (action.targetUids) {
        return action.targetUids.some((uid) => {
          const target = playerByUid.get(uid);
          return !target || (target.isAlive === false && !DEAD_TARGET_ACTIONS.has(action.action));
        });
      }
      return false;
    });
    if (invalidTarget) { rejected.push({ actorUid: submission.actorUid, reason: `invalid_target:${invalidTarget.targetUid ?? invalidTarget.targetUids?.join(',') ?? 'unknown'}` }); continue; }

    valid.push(submission);
  }
  return { valid, rejected };
}
