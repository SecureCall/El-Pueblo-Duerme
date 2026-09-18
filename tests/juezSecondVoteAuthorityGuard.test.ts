import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Juez second vote authority guard', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'app/api/juez-second-vote/route.ts'),
    'utf8',
  );

  it('resets authoritative vote submissions for the current round before opening the second vote', () => {
    expect(source).toContain("gameRef.collection('votes').where('round', '==', currentRound)");
    expect(source).toContain('voteSnap.docs.forEach(vote => tx.delete(vote.ref));');
    expect(source).toContain('juezUsed: true');
    expect(source).toContain('dayStartedAt: now');
    expect(source).toContain('phaseEndsAt: now + SECOND_VOTE_MS');
  });

  it('does not write the legacy dayVotes field during the second vote reset', () => {
    expect(source).not.toContain('dayVotes: {},');
    expect(source).toContain('The authoritative vote store is games/{gameId}/votes/{uid}.');
  });
});
