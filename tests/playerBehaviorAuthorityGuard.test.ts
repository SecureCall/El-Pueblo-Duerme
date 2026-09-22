import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const client = readFileSync(resolve(process.cwd(), 'lib/bots/playerStats.ts'), 'utf8');
const gamePlay = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');
const dayVote = readFileSync(resolve(process.cwd(), 'app/api/day-vote/route.ts'), 'utf8');
const awardXp = readFileSync(resolve(process.cwd(), 'app/api/award-xp/route.ts'), 'utf8');
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Player behavior authority', () => {
  it('keeps the browser helper read-only', () => {
    expect(client).not.toContain('setDoc(');
    expect(client).not.toContain('updateDoc(');
    expect(client).not.toContain('runTransaction(');
    expect(client).not.toContain('recordVote');
    expect(client).not.toContain('recordGameResult');
    expect(gamePlay).not.toContain('recordVote(');
    expect(gamePlay).not.toContain('recordGameResult(');
  });

  it('records vote timing only from the authoritative vote transaction', () => {
    expect(dayVote).toContain("db.collection('playerBehavior').doc(uid)");
    expect(dayVote).toContain('previousVoteSnap');
    expect(dayVote).toContain('Number(previous.round) !== currentRound');
    expect(dayVote).toContain('dayStartedAt');
    expect(dayVote).toContain('totalVoteTimeMs');
  });

  it('records game behavior from the authoritative ended game', () => {
    expect(awardXp).toContain("tx.get(behaviorRef)");
    expect(awardXp).toContain("game.phase !== 'ended'");
    expect(awardXp).toContain("player.isAlive === true");
    expect(awardXp).toContain('rolePlayCount');
    expect(awardXp).toContain('gameHistory');
    expect(awardXp).toContain('game.winMessage');
    expect(awardXp).not.toContain('body.won');
    expect(awardXp).not.toContain('body.role');
    expect(awardXp).not.toContain('body.survived');
    expect(awardXp).not.toContain('body.dramaMemo');
  });

  it('keeps playerBehavior completely server-write-only in Firestore', () => {
    expect(rules).toContain("match /playerBehavior/{userId} { allow read: if isAuth() && request.auth.uid == userId; allow create, update, delete: if false; }");
  });
});
