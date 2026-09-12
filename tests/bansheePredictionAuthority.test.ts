import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'app/api/banshee-prediction/route.ts'), 'utf8');

describe('Banshee prediction authority', () => {
  it('authenticates the caller and verifies the private role', () => {
    expect(source).toContain('verifyAuthToken');
    expect(source).toContain("gameRef.collection('playerRoles').doc(tokenUid)");
    expect(source).toContain("role !== 'Banshee'");
  });

  it('rejects AI callers and dead actors', () => {
    expect(source).toContain("if (!actor?.isAlive || actor.isAI === true) throw new Error('ACTOR_INVALID')");
  });

  it('rejects stale rounds and day-resolution races', () => {
    expect(source).toContain('round !== currentRound');
    expect(source).toContain("const lockRef = gameRef.collection('locks').doc('dayResolution')");
    expect(source).toContain("throw new Error('RESOLUTION_LOCKED')");
  });

  it('makes predictions write-once within the same round', () => {
    expect(source).toContain('existingRound === currentRound');
    expect(source).toContain("throw new Error('ALREADY_SUBMITTED')");
    expect(source).toContain('bansheePredictionRound: currentRound');
  });
});
