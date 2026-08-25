import type { GameStateForServer } from '@/lib/game/types';

export interface DayVoteResolutionInput {
  game: GameStateForServer;
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
 * Pure, framework-independent day-vote tally.
 * Role-specific consequences intentionally remain outside this primitive
 * until parity with the existing game resolver has been verified.
 */
export function resolveDayVote({ game, votes }: DayVoteResolutionInput): DayVoteResolution {
  const alive = new Set(game.players.filter((p) => p.isAlive).map((p) => p.uid));
  const banned = new Set(game.voteBanned ?? []);
  const counts: Record<string, number> = {};

  for (const [voterUid, targetUid] of Object.entries(votes)) {
    if (!alive.has(voterUid) || !alive.has(targetUid) || banned.has(voterUid)) continue;
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
    totalVoted: Object.entries(votes).filter(([voterUid]) => alive.has(voterUid) && !banned.has(voterUid)).length,
    winnerUid: tiedUids.length === 1 ? tiedUids[0] : null,
    tiedUids,
  };
}
