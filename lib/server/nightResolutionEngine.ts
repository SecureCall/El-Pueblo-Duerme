import type { NightActionSubmission } from '@/lib/game/nightResolution';
import type { NightResolutionInput } from '@/lib/server/nightResolutionInput';
import type { NightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';

export interface NightResolutionEngineResult {
  roundNumber: number;
  acceptedActions: NightActionSubmission[];
  rejectedActions: Array<{ actorUid: string; reason: string }>;
}

/**
 * Deterministic, side-effect-free first-stage night engine.
 *
 * This stage deliberately does not apply deaths, protections, or victory
 * conditions. It establishes the server-owned action set that the real role
 * resolver will consume, without mutating Firestore.
 */
export function resolveNightActions(
  input: NightResolutionInput,
  roles: NightRoleSnapshot,
): NightResolutionEngineResult {
  const acceptedActions: NightActionSubmission[] = [];
  const rejectedActions: Array<{ actorUid: string; reason: string }> = [];

  for (const submission of input.submissions) {
    const role = roles.rolesByUid[submission.actorUid];

    if (!role) {
      rejectedActions.push({ actorUid: submission.actorUid, reason: 'missing_private_role' });
      continue;
    }

    if (submission.role && submission.role !== role) {
      rejectedActions.push({ actorUid: submission.actorUid, reason: 'role_mismatch' });
      continue;
    }

    acceptedActions.push(...submission.actions);
  }

  return {
    roundNumber: input.roundNumber,
    acceptedActions,
    rejectedActions,
  };
}
