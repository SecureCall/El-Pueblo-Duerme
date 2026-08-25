import type { GameState } from '@/components/game/play/GamePlay';

export interface DayVoteResolutionInput {
  game: GameState;
  votes: Record<string, string>;
}

export interface DayVoteResolution {
  round: number;
  counts: Record<string, number>;
  totalVoted: number;
  winnerUid: string | null;
  tiedUids: string[];
}

/**
 * Pure, server-side vote tally primitive.
 *
 * This deliberately performs ONLY deterministic tallying. Role-specific
 * consequences remain in the existing game resolver until they are migrated
 * and parity-tested; this prevents silently changing game rules.
 */
export function resolveDayVote({ game, votes }: DayVoteResolutionInput): DayVoteResolution {
  const alive = new Set((game.players ?? []).filter((p) => p.isAlive).map((p) => p.uid));
  const counts: Record<string, number> = {};

  for (const [voterUid, targetUid] of Object.entries(votes)) {
    if (!alive.has(voterUid) || !alive.has(targetUid)) continue;
    if (game.voteBanned?.includes(voterUid)) continue;
    counts[targetUid] = (counts[targetUid] ?? 0) + 1;
  }

  const entries = Object.entries(counts);
  const maxVotes = entries.length ? Math.max(...entries.map(([, count]) => count)) : 0;
  const tiedUids = maxVotes > 0
    ? entries.filter(([, count]) => count === maxVotes).map(([uid]) => uid)
    : [];

  return {
    round: game.roundNumber ?? 1,
    counts,
    totalVoted: Object.keys(votes).filter((uid) => alive.has(uid) && !game.voteBanned?.includes(uid)).length,
    winnerUid: tiedUids.length === 1 ? tiedUids[0] : null,
    tiedUids,
  };
}
