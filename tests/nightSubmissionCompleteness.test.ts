import { describe, expect, it } from 'vitest';
import { hasCompleteNightSubmissions } from '@/lib/server/nightSubmissionCompleteness';

describe('hasCompleteNightSubmissions', () => {
  it('requires submissions from the exact current round', () => {
    expect(hasCompleteNightSubmissions(
      ['u1', 'u2'],
      [
        { actorUid: 'u1', roundNumber: 3 },
        { actorUid: 'u2', roundNumber: 2 },
      ],
      3,
    )).toBe(false);
  });

  it('accepts all alive players when every submission belongs to the current round', () => {
    expect(hasCompleteNightSubmissions(
      ['u1', 'u2'],
      [
        { actorUid: 'u1', roundNumber: 3 },
        { actorUid: 'u2', roundNumber: 3 },
        { actorUid: 'u1', roundNumber: 2 },
      ],
      3,
    )).toBe(true);
  });

  it('fails closed for invalid rounds and empty alive player lists', () => {
    expect(hasCompleteNightSubmissions(['u1'], [{ actorUid: 'u1', roundNumber: 1 }], 0)).toBe(false);
    expect(hasCompleteNightSubmissions([], [{ actorUid: 'u1', roundNumber: 1 }], 1)).toBe(false);
  });
});
