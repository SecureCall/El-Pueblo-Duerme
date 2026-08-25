export interface VoteSummaryState {
  counts: Record<string, number>;
  myVote: string | null;
  totalVoted: number;
  round: number;
}

export const EMPTY_VOTE_SUMMARY: VoteSummaryState = {
  counts: {},
  myVote: null,
  totalVoted: 0,
  round: 0,
};

/**
 * Converts the server response into the small public state consumed by the
 * voting UI. Individual voter -> target relationships never belong here.
 */
export function normalizeVoteSummary(input: unknown): VoteSummaryState {
  if (!input || typeof input !== 'object') return EMPTY_VOTE_SUMMARY;

  const value = input as Record<string, unknown>;
  const rawCounts = value.counts;
  const counts: Record<string, number> = {};

  if (rawCounts && typeof rawCounts === 'object') {
    for (const [uid, rawCount] of Object.entries(rawCounts as Record<string, unknown>)) {
      if (typeof uid !== 'string' || typeof rawCount !== 'number') continue;
      if (!Number.isSafeInteger(rawCount) || rawCount < 0) continue;
      counts[uid] = rawCount;
    }
  }

  const totalVoted = typeof value.totalVoted === 'number' && Number.isSafeInteger(value.totalVoted) && value.totalVoted >= 0
    ? value.totalVoted
    : Object.values(counts).reduce((sum, count) => sum + count, 0);

  const round = typeof value.round === 'number' && Number.isSafeInteger(value.round) && value.round >= 0
    ? value.round
    : 0;

  const myVote = typeof value.myVote === 'string' && value.myVote.length > 0
    ? value.myVote
    : null;

  return { counts, myVote, totalVoted, round };
}
