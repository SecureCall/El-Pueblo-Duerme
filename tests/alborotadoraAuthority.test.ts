import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/alborotadora-fight/route.ts'), 'utf8');
const helper = readFileSync(resolve(process.cwd(), 'lib/game/specialActions.ts'), 'utf8');

describe('Alborotadora authority', () => {
  it('requires the real role, alive actor, alive distinct targets and valid phase', () => {
    expect(route).toContain("ALLOWED_PHASES = new Set(['day', 'voting'])");
    expect(route).toContain("roleSnap.data()?.role !== 'Alborotadora'");
    expect(route).toContain("actor.isAlive !== true");
    expect(route).toContain("first.isAlive !== true");
    expect(route).toContain("second.isAlive !== true");
    expect(route).toContain('firstUid === secondUid');
  });

  it('prevents replay and unauthorized callers', () => {
    expect(route).toContain("game.alborotadoraUsed === true");
    expect(route).toContain("game.alborotadoraFight != null");
    expect(route).toContain("throw new Error('FORBIDDEN')");
  });

  it('uses the authoritative client helper instead of exposing direct Firestore mutation', () => {
    expect(helper).toContain("'/api/alborotadora-fight'");
    expect(helper).toContain('requestAlborotadoraFight');
  });
});
