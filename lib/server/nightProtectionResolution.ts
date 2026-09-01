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

function actionTargets(
  input: NightResolutionInput,
  role: string,
  actionNames: string[],
  blockedActorUid: string | null,
  extraTargetFilter?: (targetUid: string) => boolean,
): string[] {
  return input.submissions
    .filter((submission) => submission.role === role && submission.actorUid !== blockedActorUid)
    .flatMap((submission) => submission.actions)
    .filter((action) => actionNames.includes(action.action))
    .flatMap((action) => action.targetUid ? [action.targetUid] : [])
    .filter((uid) => extraTargetFilter ? extraTargetFilter(uid) : true);
}

function hasBooleanAction(
  input: NightResolutionInput,
  role: string,
  actionName: string,
  blockedActorUid: string | null,
): boolean {
  return input.submissions
    .filter((submission) => submission.role === role && submission.actorUid !== blockedActorUid)
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

  // Anciana Líder's target is blocked for the entire night, including protection abilities.
  const ancianaSubmission = input.submissions
    .find((submission) => submission.role === 'Anciana Líder')
    ?.actions.find((action) => action.action === 'ancianaTarget');
  const blockedActorUid = ancianaSubmission?.targetUid ?? null;

  for (const uid of actionTargets(input, 'Guardián', ['guardianTarget'], blockedActorUid)) {
    if (playerUids.has(uid)) protectedTargetUids.add(uid);
  }

  // Doctor cannot protect the same target on consecutive nights.
  for (const uid of actionTargets(
    input,
    'Doctor',
    ['doctorTarget'],
    blockedActorUid,
    (targetUid) => targetUid !== input.history.doctorLastTarget,
  )) {
    if (playerUids.has(uid)) protectedTargetUids.add(uid);
  }

  for (const uid of actionTargets(input, 'Sacerdote', ['sacerdoteTarget'], blockedActorUid)) {
    if (playerUids.has(uid)) protectedTargetUids.add(uid);
  }

  // Hechicera's life potion is boolean: it protects the primary wolf target.
  if (hasBooleanAction(input, 'Hechicera', 'witchSave', blockedActorUid) && wolfResolution.targetUid) {
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
  if (blockedActorUid) reasons.push(`anciana_block:${blockedActorUid}`);
  if (input.history.doctorLastTarget) reasons.push(`doctor_last_target:${input.history.doctorLastTarget}`);
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
