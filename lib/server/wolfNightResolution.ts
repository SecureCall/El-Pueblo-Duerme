import type { NightResolutionSubmission, NightResolutionPlayer } from '@/lib/server/nightResolutionInput';

export interface WolfNightResolution {
  targetUid: string | null;
  secondaryTargetUid: string | null;
  votes: Record<string, number>;
  wolfActors: string[];
  tied: boolean;
  secondaryTargetActors: string[];
}

/**
 * Deterministically resolves the normal wolf target and the special Cría de
 * Lobo rage target. wolfTarget participates in the normal vote; wolfTarget2
 * is never counted as an additional vote.
 */
export function resolveWolfNightTarget(
  players: NightResolutionPlayer[],
  submissions: NightResolutionSubmission[],
  rolesByUid: Record<string, string>,
): WolfNightResolution {
  const alive = new Set(players.filter((player) => player.isAlive).map((player) => player.uid));
  const wolfRoles = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);
  const wolfActors = Object.entries(rolesByUid)
    .filter(([uid, role]) => alive.has(uid) && wolfRoles.has(role))
    .map(([uid]) => uid);

  const votes: Record<string, number> = {};
  const secondaryTargets = new Set<string>();
  const secondaryTargetActors: string[] = [];

  for (const submission of submissions) {
    if (!wolfActors.includes(submission.actorUid)) continue;

    const normalTargets = submission.actions
      .filter((action) => action.action === 'wolfTarget')
      .map((action) => action.targetUid)
      .filter((targetUid): targetUid is string => Boolean(targetUid))
      .filter((targetUid) => alive.has(targetUid) && !wolfActors.includes(targetUid));

    const uniqueNormalTargets = [...new Set(normalTargets)];
    // A normal submission contributes at most one normal wolf vote.
    const normalTarget = uniqueNormalTargets[0];
    if (normalTarget) votes[normalTarget] = (votes[normalTarget] ?? 0) + 1;

    const rageTargets = submission.actions
      .filter((action) => action.action === 'wolfTarget2')
      .map((action) => action.targetUid)
      .filter((targetUid): targetUid is string => Boolean(targetUid))
      .filter((targetUid) => alive.has(targetUid) && !wolfActors.includes(targetUid));

    if (rageTargets.length > 0 && submission.actions.some((action) => action.action === 'wolfTarget2')) {
      const rageTarget = [...new Set(rageTargets)][0];
      if (rageTarget) {
        secondaryTargets.add(rageTarget);
        secondaryTargetActors.push(submission.actorUid);
      }
    }
  }

  const ranked = Object.entries(votes).sort(([uidA, countA], [uidB, countB]) => {
    if (countB !== countA) return countB - countA;
    return uidA.localeCompare(uidB);
  });

  if (ranked.length === 0) {
    return {
      targetUid: null,
      secondaryTargetUid: secondaryTargets.size === 1 ? [...secondaryTargets][0] : null,
      votes,
      wolfActors,
      tied: false,
      secondaryTargetActors,
    };
  }

  const highest = ranked[0][1];
  const tied = ranked.filter(([, count]) => count === highest).length > 1;

  return {
    targetUid: tied ? null : ranked[0][0],
    secondaryTargetUid: secondaryTargets.size === 1 ? [...secondaryTargets][0] : null,
    votes,
    wolfActors,
    tied,
    secondaryTargetActors,
  };
}
