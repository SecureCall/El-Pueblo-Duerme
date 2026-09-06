export interface NightSubmissionRecord {
  actorUid?: unknown;
  roundNumber?: unknown;
}

/**
 * Returns true only when every alive player has a submission for the exact
 * current night round. Historical submissions from previous rounds never
 * satisfy the completeness check.
 */
export function hasCompleteNightSubmissions(
  aliveUids: readonly string[],
  submissions: readonly NightSubmissionRecord[],
  roundNumber: number,
): boolean {
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || aliveUids.length === 0) return false;

  const submittedUids = new Set(
    submissions
      .filter((submission) => submission.roundNumber === roundNumber)
      .map((submission) => submission.actorUid)
      .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0),
  );

  return aliveUids.every((uid) => submittedUids.has(uid));
}
