import type { NightResolutionSubmission, NightResolutionPlayer } from '@/lib/server/nightResolutionInput';

export interface WolfNightResolution {
  targetUid: string | null;
  votes: Record<string, number>;
  wolfActors: string[];
  tied: boolean;
}

/**
 * Deterministically resolves the ordinary wolf target from validated
 * submissions. Each living wolf contributes at most one vote to a target;
 * duplicate wolfTarget/wolfTarget2 submissions from the same actor cannot
 * amplify that actor's vote.
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

  for (const submission of submissions) {
    if (!wolfRoles.has(rolesByUid[submission.actorUid])) continue;
    if (!wolfActors.includes(submission.actorUid)) continue;

    const actorTargets = submission.actions
      .filter((action) => action.action === 'wolfTarget' || action.action === 'wolfTarget2')
      .map((action) => action.targetUid)
      .filter((targetUid): targetUid is string => Boolean(targetUid))
      .filter((targetUid) => alive.has(targetUid) && !wolfActors.includes(targetUid));

    const uniqueTargets = [...new Set(actorTargets)];
    if (uniqueTargets.length === 0) continue;

    // A wolf may submit two target fields, but cannot contribute two votes to
    // the same target. For ordinary wolves, one vote is the maximum influence
    // of a single actor. If the actor selected two different targets, both are
    // represented as one vote each; the existing tie logic decides the result.
    for (const targetUid of uniqueTargets) {
      votes[targetUid] = (votes[targetUid] ?? 0) + 1;
    }
  }

  const ranked = Object.entries(votes).sort(([uidA, countA], [uidB, countB]) => {
    if (countB !== countA) return countB - countA;
    return uidA.localeCompare(uidB);
  });

  if (ranked.length === 0) return { targetUid: null, votes, wolfActors, tied: false };

  const highest = ranked[0][1];
  const tied = ranked.filter(([, count]) => count === highest).length > 1;

  return {
    targetUid: tied ? null : ranked[0][0],
    votes,
    wolfActors,
    tied,
  };
}
