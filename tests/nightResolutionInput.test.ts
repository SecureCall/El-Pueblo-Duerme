import { describe, expect, it } from 'vitest';
import { createNightResolutionInput } from '@/lib/server/nightResolutionInput';

const players = [{ uid: 'p1', name: 'Player', isAlive: true }];

function game(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'night',
    roundNumber: 2,
    ...overrides,
  };
}

describe('night resolution input boundary', () => {
  it('accepts only a matching active night round', () => {
    const result = createNightResolutionInput('game', 2, players, [], game());
    expect(result.phase).toBe('night');
    expect(result.roundNumber).toBe(2);
  });

  it('rejects a day-phase game before any night resolution can run', () => {
    expect(() => createNightResolutionInput('game', 2, players, [], game({ phase: 'day' })))
      .toThrow('night_resolution_invalid_phase');
  });

  it('rejects a stale or future round before resolution can run', () => {
    expect(() => createNightResolutionInput('game', 1, players, [], game()))
      .toThrow('night_resolution_round_mismatch');
  });

  it('rejects invalid round numbers', () => {
    expect(() => createNightResolutionInput('game', 0, players, [], game({ roundNumber: 0 })))
      .toThrow('night_resolution_invalid_round');
  });
});
