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

function actionTargets(input: NightResolutionInput, role: string, actionNames: string[]): string[] {
  return input.submissions
    .filter((submission) => submission.role === role)
    .flatMap((submission) => submission.actions)
    .filter((action) => actionNames.includes(action.action))
    .flatMap((action) => action.targetUid ? [action.targetUid] : []);
}

function hasBooleanAction(input: NightResolutionInput, role: string, actionName: string): boolean {
  return input.submissions
    .filter((submission) => submission.role === role)
    .some((submission) => submission.actions.some(
      (action) => action.action === actionName && action.value === true,
    ));
}

/** Pure protection layer; no Firestore writes or deaths are applied here. */
export function resolveNightProtections(
  input: NightResolutionInput,
  roles: NightRoleSnapshot,
  wolfResolution: WolfNightResolution,
): NightProtectionResolution {
  const protectedTargetUids = new Set<string>();
  const playerUids = new Set(input.players.map((player) => player.uid));

  // Canonical role names are Spanish; never use client-provided aliases here.
  for (const uid of actionTargets(input, 'Guardián', ['guardianTarget'])) {
    if (playerUids.has(uid)) protectedTargetUids.add(uid);
  }
  for (const uid of actionTargets(input, 'Doctor', ['doctorTarget'])) {
    if (playerUids.has(uid)) protectedTargetUids.add(uid);
  }
  for (const uid of actionTargets(input, 'Sacerdote', ['sacerdoteTarget'])) {
    if (playerUids.has(uid)) protectedTargetUids.add(uid);
  }

  // Hechicera's life potion is boolean: it protects the primary wolf target.
  if (hasBooleanAction(input, 'Hechicera', 'witchSave') && wolfResolution.targetUid) {
    protectedTargetUids.add(wolfResolution.targetUid);
  }

  // Bruja's protection is persisted after she finds the Vidente.
  if (input.history.brujaProtectedUid && playerUids.has(input.history.brujaProtectedUid)) {
    protectedTargetUids.add(input.history.brujaProtectedUid);
  }

  // Defense in depth: a protection may only refer to a player with a private role snapshot.
  for (const uid of [...protectedTargetUids]) {
    if (!roles.rolesByUid[uid]) protectedTargetUids.delete(uid);
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
