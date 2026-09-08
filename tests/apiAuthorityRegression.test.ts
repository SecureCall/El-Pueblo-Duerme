import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('API authority regression guards', () => {
  it('keeps canonical day voting authenticated and server-authoritative', () => {
    const source = read('app/api/day-vote/route.ts');

    expect(source).toContain('verifyAuthToken');
    expect(source).toContain("if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });");
    expect(source).toContain('const authorizedHuman = tokenUid === uid;');
    expect(source).toContain('const authorizedAI = voter.isAI === true && tokenUid === game.hostUid;');
    expect(source).toContain('currentRound');
    expect(source).toContain('RESOLUTION_LOCKED');
  });

  it('keeps background vote replay bound to the authenticated player', () => {
    const source = read('app/api/sync-vote/route.ts');

    expect(source).toContain('verifyAuthToken');
    expect(source).toContain('tokenUid !== uid');
    expect(source).toContain('gameData.phase !== \'day\' && gameData.phase !== \'voting\'');
    expect(source).toContain('submittedRound !== currentRound');
    expect(source).toContain('p.uid === uid && p.isAlive');
    expect(source).toContain('p.uid === target && p.isAlive');
  });

  it('keeps host takeover authenticated and transactionally decided by server policy', () => {
    const source = read('app/api/host-takeover/route.ts');

    expect(source).toContain('verifyAuthToken');
    expect(source).toContain('getTakeoverDecision');
    expect(source).toContain('db.runTransaction');
    expect(source).toContain('hostLastSeen');
  });

  it('keeps XP awards derived from persisted game state and idempotent per game', () => {
    const source = read('app/api/award-xp/route.ts');

    expect(source).toContain('verifyAuthToken');
    expect(source).toContain("game.phase !== 'ended'");
    expect(source).toContain('game.winners');
    expect(source).toContain('xpAwards');
    expect(source).toContain('awardSnap.exists');
    expect(source).toContain('tx.create(awardRef');
  });
});
