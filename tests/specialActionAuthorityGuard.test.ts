import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cazadorRoute = readFileSync(resolve(process.cwd(), 'app/api/cazador-shot/route.ts'), 'utf8');
const chivoRoute = readFileSync(resolve(process.cwd(), 'app/api/chivo-choice/route.ts'), 'utf8');
const juezRoute = readFileSync(resolve(process.cwd(), 'app/api/juez-second-vote/route.ts'), 'utf8');
const specialActions = readFileSync(resolve(process.cwd(), 'lib/game/specialActions.ts'), 'utf8');

describe('authoritative special-action guards', () => {
  it('keeps Cazador authority on the server endpoint', () => {
    expect(cazadorRoute).toContain("collection('playerRoles').doc(pendingUid)");
    expect(cazadorRoute).toContain("hunterRole !== 'Cazador'");
    expect(cazadorRoute).toContain('db.runTransaction');
  });

  it('keeps Chivo authority on the server endpoint', () => {
    expect(chivoRoute).toContain("collection('playerRoles').doc(pendingUid)");
    expect(chivoRoute).toContain("role !== 'Chivo Expiatorio'");
    expect(chivoRoute).toContain('db.runTransaction');
  });

  it('keeps Juez authority on the server endpoint', () => {
    expect(juezRoute).toContain('verifyAuthToken');
    expect(juezRoute).toContain("role !== 'Juez'");
    expect(juezRoute).toContain("game.juezUsed === true");
    expect(juezRoute).toContain('db.runTransaction');
    expect(juezRoute).toContain('dayStartedAt: now');
    expect(juezRoute).toContain('phaseEndsAt: now + SECOND_VOTE_MS');
    expect(juezRoute).toContain('now >= phaseEndsAt');
    expect(juezRoute).toContain("PHASE_EXPIRED");
  });

  it('provides a client helper instead of direct Juez state mutation', () => {
    expect(specialActions).toContain("'/api/juez-second-vote'");
    expect(specialActions).toContain('requestJuezSecondVote');
  });
});
