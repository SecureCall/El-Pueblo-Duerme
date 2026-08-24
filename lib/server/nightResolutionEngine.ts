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
  pendingWolfDeath: string | null;
  deathEffects: NightDeathEffectsResult;
}

/**
 * Deterministic, side-effect-free night engine.
 * No deaths, phase transitions, or Firestore writes are applied here.
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

    if (submission.role !== role) {
      rejectedActions.push({ actorUid: submission.actorUid, reason: 'role_mismatch' });
      continue;
    }

    const validation = validateNightActionSubmissions(
      input.players,
      submission.actorUid,
      role,
      submission.actions,
    );

    if (!validation.valid) {
      for (const error of validation.errors) {
        rejectedActions.push({ actorUid: submission.actorUid, reason: error });
      }
      continue;
    }

    acceptedActions.push(...submission.actions);
  }

  const acceptedSubmissions = input.submissions.filter((submission) =>
    acceptedActions.some((action) => action.actorUid === submission.actorUid),
  );

  const wolfResolution = resolveWolfNightTarget(
    input.players,
    acceptedSubmissions,
    roles.rolesByUid,
  );

  const protectionResolution = resolveNightProtections(
    input,
    roles,
    wolfResolution,
  );

  const pendingWolfDeath = protectionResolution.wolfAttackBlocked
    ? null
    : protectionResolution.wolfTargetUid;

  const deathEffects = resolveNightDeathEffects(
    input,
    pendingWolfDeath ? [pendingWolfDeath] : [],
  );

  return {
    roundNumber: input.roundNumber,
    acceptedActions,
    rejectedActions,
    wolfResolution,
    protectionResolution,
    pendingWolfDeath,
    deathEffects,
  };
}
