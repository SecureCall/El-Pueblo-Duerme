import type { NightResolutionInput } from '@/lib/server/nightResolutionInput';
import type { NightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';
import type { WolfNightResolution } from '@/lib/server/wolfNightResolution';

export interface NightProtectionResolution {
  wolfTargetUid: string | null;
  secondaryTargetUid: string | null;
  protectedTargetUids: string[];
  wolfAttackBlocked: boolean;
  secondaryAttackBlocked: boolean;
  reasons: string[];
}

function actionTargets(input: NightResolutionInput, role: string): string[] {
  return input.submissions
    .filter((submission) => submission.role === role)
    .flatMap((submission) => submission.actions)
    .filter((action) => action.action === 'guardianTarget' || action.action === 'doctorTarget' || action.action === 'witchSave')
    .flatMap((action) => action.targetUid ? [action.targetUid] : []);
}

/** Pure protection layer; no Firestore writes or deaths are applied here. */
export function resolveNightProtections(
  input: NightResolutionInput,
  roles: NightRoleSnapshot,
  wolfResolution: WolfNightResolution,
): NightProtectionResolution {
  const protectedTargetUids = new Set<string>();

  for (const uid of actionTargets(input, 'guardian')) {
    if (input.players.some((player) => player.uid === uid)) protectedTargetUids.add(uid);
  }
  for (const uid of actionTargets(input, 'doctor')) {
    if (input.players.some((player) => player.uid === uid)) protectedTargetUids.add(uid);
  }
  for (const uid of actionTargets(input, 'witch')) {
    if (input.players.some((player) => player.uid === uid)) protectedTargetUids.add(uid);
  }

  const primaryBlocked = Boolean(
    wolfResolution.targetUid && protectedTargetUids.has(wolfResolution.targetUid),
  );
  const secondaryBlocked = Boolean(
    wolfResolution.secondaryTargetUid && protectedTargetUids.has(wolfResolution.secondaryTargetUid),
  );

  const reasons: string[] = [];
  if (!wolfResolution.targetUid) reasons.push('no_wolf_target');
  else reasons.push(primaryBlocked ? 'wolf_target_protected' : 'wolf_target_unprotected');
  if (wolfResolution.secondaryTargetUid) {
    reasons.push(secondaryBlocked ? 'secondary_target_protected' : 'secondary_target_unprotected');
  }

  return {
    wolfTargetUid: wolfResolution.targetUid,
    secondaryTargetUid: wolfResolution.secondaryTargetUid,
    protectedTargetUids: [...protectedTargetUids],
    wolfAttackBlocked: primaryBlocked,
    secondaryAttackBlocked: secondaryBlocked,
    reasons,
  };
}
