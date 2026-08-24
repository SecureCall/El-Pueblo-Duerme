import type { NightActionSubmission } from '@/lib/game/nightResolution';
import type { NightResolutionPlayer, NightResolutionSubmission } from '@/lib/server/nightResolutionInput';

export interface WolfNightResolution {
  targetUid: string | null;
  votes: Record<string, number>;
  wolfActors: string[];
  tied: boolean;
}

/**
 * Deterministically resolves the ordinary wolf target from already-validated
 * submissions. It has no Firestore side effects and deliberately does not
 * decide deaths/protections yet.
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
    for (const action of submission.actions) {
      if ((action.action !== 'wolfTarget' && action.action !== 'wolfTarget2') || !action.targetUid) continue;
      if (!alive.has(action.targetUid) || wolfActors.includes(action.targetUid)) continue;
      votes[action.targetUid] = (votes[action.targetUid] ?? 0) + 1;
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
