import type { NightResolutionInput } from '@/lib/server/nightResolutionInput';
import type { NightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';
import type { WolfNightResolution } from '@/lib/server/wolfNightResolution';

export interface NightProtectionResolution {
  wolfTargetUid: string | null;
  protectedTargetUids: string[];
  wolfAttackBlocked: boolean;
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
  if (!wolfResolution.targetUid) {
    return { wolfTargetUid: null, protectedTargetUids: [], wolfAttackBlocked: false, reasons: ['no_wolf_target'] };
  }

  const protectedTargetUids = new Set<string>();

  for (const uid of actionTargets(input, 'guardian')) {
    if (roles.rolesByUid[uid] || input.players.some((player) => player.uid === uid)) protectedTargetUids.add(uid);
  }
  for (const uid of actionTargets(input, 'doctor')) {
    if (roles.rolesByUid[uid] || input.players.some((player) => player.uid === uid)) protectedTargetUids.add(uid);
  }
  for (const uid of actionTargets(input, 'witch')) {
    if (roles.rolesByUid[uid] || input.players.some((player) => player.uid === uid)) protectedTargetUids.add(uid);
  }

  const blocked = protectedTargetUids.has(wolfResolution.targetUid);
  return {
    wolfTargetUid: wolfResolution.targetUid,
    protectedTargetUids: [...protectedTargetUids],
    wolfAttackBlocked: blocked,
    reasons: blocked ? ['wolf_target_protected'] : ['wolf_target_unprotected'],
  };
}
