import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dayPhase = readFileSync(
  resolve(process.cwd(), 'components/game/play/DayPhase.tsx'),
  'utf8',
);
const resolveNight = readFileSync(
  resolve(process.cwd(), 'app/api/resolve-night/route.ts'),
  'utf8',
);
const dayResolve = readFileSync(
  resolve(process.cwd(), 'app/api/day-resolve/route.ts'),
  'utf8',
);
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('force confession authority guard', () => {
  it('creates the confession window on the server', () => {
    expect(resolveNight).toContain('confessionEndsAt');
    expect(resolveNight).toContain('new Date(now + 20_000)');
    expect(resolveNight).toContain('confessionUid, confessionEndsAt');
  });

  it('protects the confession deadline from client game-state writes', () => {
    expect(rules).toContain("'confessionEndsAt'");
    expect(rules).toContain("'confessionUid'");
  });

  it('enforces the confession speaker at the Firestore write boundary', () => {
    expect(rules).toContain("currentEvent.mechanical != 'forceConfession'");
    expect(rules).toContain('confessionUid == request.auth.uid');
    expect(rules).toContain('request.time >= get(/databases/$(database)/documents/games/$(gameId)).data.confessionEndsAt');
  });

  it('clears the authoritative confession window when day resolution commits', () => {
    expect(dayResolve).toContain('confessionUid: null');
    expect(dayResolve).toContain('confessionEndsAt: null');
  });

  it('does not use a locally derived elapsed counter to authorize confession', () => {
    expect(dayPhase).not.toMatch(/const\s+elapsed\s*=\s*dayDurationRef\.current\s*-\s*secondsLeft/);
    expect(dayPhase).not.toMatch(/isForzadaActive\s*=.*elapsed/);
    expect(dayPhase).not.toMatch(/confessionCountdown\s*=.*elapsed/);
  });
});
