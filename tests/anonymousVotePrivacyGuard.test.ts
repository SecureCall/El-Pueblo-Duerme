import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const dayVoteRoute = readFileSync(resolve(process.cwd(), 'app/api/day-vote/route.ts'), 'utf8');
const syncVoteRoute = readFileSync(resolve(process.cwd(), 'app/api/sync-vote/route.ts'), 'utf8');

describe('anonymous vote privacy guard', () => {
  it('blocks even the host from reading vote documents while anonymousVotes is active', () => {
    expect(rules).toMatch(/function anonymousVotesActive\(gameId\)/);
    expect(rules).toMatch(/match \/games\/\{gameId\}\/votes\/\{voterUid\} \{ allow read: if isAuth\(\) && isHost\(gameId\) && !anonymousVotesActive\(gameId\);/);
  });

  it('keeps canonical vote submission server-authoritative', () => {
    expect(dayVoteRoute).toContain('verifyAuthToken');
    expect(dayVoteRoute).toContain("tx.set(voteRef");
    expect(dayVoteRoute).not.toContain('dayVotes');
  });

  it('keeps background vote replay authenticated and server-authoritative', () => {
    expect(syncVoteRoute).toContain('verifyAuthToken');
    expect(syncVoteRoute).toContain('voteRef');
  });
});
