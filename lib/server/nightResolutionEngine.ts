import {
  validateNightActionSubmissions,
  type NightActionSubmission,
} from '@/lib/game/nightResolution';
import type { NightResolutionInput } from '@/lib/server/nightResolutionInput';
import type { NightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';
import { resolveWolfNightTarget, type WolfNightResolution } from '@/lib/server/wolfNightResolution';
import { resolveNightProtections, type NightProtectionResolution } from '@/lib/server/nightProtectionResolution';
import { resolveNightDeathEffects, type NightDeathEffectsResult } from '@/lib/server/nightDeathEffects';

export interface NightResolutionEngineResult {
  roundNumber: number;
  acceptedActions: NightActionSubmission[];
  rejectedActions: Array<{ actorUid: string; reason: string }>;
  wolfResolution: WolfNightResolution;
  protectionResolution: NightProtectionResolution;
  pendingWolfDeaths: string[];
  deathEffects: NightDeathEffectsResult;
}

/** Deterministic, side-effect-free night engine. */
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
    if (submission.role !== role) {
      rejectedActions.push({ actorUid: submission.actorUid, reason: 'role_mismatch' });
      continue;
    }

    for (const action of submission.actions) {
      const validation = validateNightActionSubmissions(input.players, submission.actorUid, role, [action]);
      if (!validation.valid) {
        for (const error of validation.errors) {
          rejectedActions.push({ actorUid: submission.actorUid, reason: error });
        }
        continue;
      }
      acceptedActions.push(action);
    }
  }

  const acceptedSubmissions = input.submissions
    .map((submission) => ({
      ...submission,
      actions: submission.actions.filter((action) => acceptedActions.includes(action)),
    }))
    .filter((submission) => submission.actions.length > 0);

  const wolfResolution = resolveWolfNightTarget(input.players, acceptedSubmissions, roles.rolesByUid);
  const protectionInput = { ...input, submissions: acceptedSubmissions };
  const protectionResolution = resolveNightProtections(protectionInput, roles, wolfResolution);

  const pendingWolfDeaths = [
    protectionResolution.wolfAttackBlocked ? null : protectionResolution.wolfTargetUid,
    protectionResolution.secondaryAttackBlocked ? null : protectionResolution.secondaryTargetUid,
  ].filter((uid): uid is string => Boolean(uid));

  const resolvedInput = { ...input, submissions: acceptedSubmissions };
  const deathEffects = resolveNightDeathEffects(resolvedInput, [...new Set(pendingWolfDeaths)]);

  return {
    roundNumber: input.roundNumber,
    acceptedActions,
    rejectedActions,
    wolfResolution,
    protectionResolution,
    pendingWolfDeaths: [...new Set(pendingWolfDeaths)],
    deathEffects,
  };
}
