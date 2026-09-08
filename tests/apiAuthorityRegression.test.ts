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

  it('keeps background vote replay authenticated, deadline-fenced and resolution-fenced', () => {
    const source = read('app/api/sync-vote/route.ts');

    expect(source).toContain('verifyAuthToken');
    expect(source).toContain('tokenUid !== uid');
    expect(source).toContain('ALLOWED_PHASES');
    expect(source).toContain('submittedRound !== currentRound');
    expect(source).toContain('VOTE_DEADLINE_PASSED');
    expect(source).toContain("const phaseEndsAt = typeof game.phaseEndsAt === 'number' ? game.phaseEndsAt : null;");
    expect(source).toContain('Date.now() >= phaseEndsAt');
    expect(source).toContain('RESOLUTION_LOCKED');
    expect(source).toContain("gameRef.collection('locks').doc('dayResolution')");
    expect(source).toContain('db.runTransaction');
    expect(source).toContain('p.uid === uid');
    expect(source).toContain('p.uid === target');
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

  it('fences an expired night-resolution lease before applying the night result', () => {
    const source = read('app/api/resolve-night/route.ts');

    expect(source).toContain('night_resolution_lease_lost');
    expect(source).toContain('leaseExpiresMillis(lockData.expiresAt) <= Date.now()');
    expect(source).toContain('night_resolution_lease_expired');
    expect(source).toContain("status: 'resolved'");
    expect(source).toContain("phase: nextPhase");
  });

  it('does not allow any alive caller to resolve an incomplete night before its deadline', () => {
    const source = read('app/api/resolve-night/route.ts');

    expect(source).toContain('caller.isAlive !== true');
    expect(source).toContain('const complete = aliveUids.length > 0 && aliveUids.every((uid) => submittedUids.has(uid));');
    expect(source).toContain("const phaseEndsAt = typeof game.phaseEndsAt === 'number' ? game.phaseEndsAt : null;");
    expect(source).toContain('const deadlineReached = phaseEndsAt !== null && Date.now() >= phaseEndsAt;');
    expect(source).toContain('if (!complete && !deadlineReached)');
  });

  it('keeps automatic resolution available to non-host players only after completion', () => {
    const source = read('app/api/sync-night-action/route.ts');

    expect(source).toContain('if (complete)');
    expect(source).toContain("new URL('/api/resolve-night', req.url)");
    expect(source).toContain('Authorization: authorization');
  });

  it('closes server-authoritative night submissions at the phase deadline', () => {
    const source = read('app/api/sync-night-action/route.ts');

    expect(source).toContain("const phaseEndsAt = typeof gameData.phaseEndsAt === 'number' ? gameData.phaseEndsAt : null;");
    expect(source).toContain('Date.now() >= phaseEndsAt');
    expect(source).toContain("return NextResponse.json({ error: 'La noche ya ha terminado; la acción llegó después del límite' }, { status: 409 });");
    expect(source).toContain('const [existing, resolutionLock] = await Promise.all([');
  });
});
