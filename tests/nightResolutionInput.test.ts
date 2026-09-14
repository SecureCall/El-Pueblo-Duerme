import { describe, expect, it } from 'vitest';
import { createNightResolutionInput } from '@/lib/server/nightResolutionInput';

const players = [
  { uid: 'p1', name: 'Player', isAlive: true },
  { uid: 'p2', name: 'Target 1', isAlive: true },
  { uid: 'p3', name: 'Target 2', isAlive: true },
];
const roles = { p1: 'Lobo', p2: 'Bruja', p3: 'Vidente' };

function game(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'night',
    roundNumber: 2,
    wolfTeam: { p1: true, p2: true, leaked: true },
    ...overrides,
  };
}

describe('night resolution input boundary', () => {
  it('accepts only a matching active night round', () => {
    const result = createNightResolutionInput('game', 2, players, [], game(), roles);
    expect(result.phase).toBe('night');
    expect(result.roundNumber).toBe(2);
  });

  it('rejects a day-phase game before any night resolution can run', () => {
    expect(() => createNightResolutionInput('game', 2, players, [], game({ phase: 'day' }), roles))
      .toThrow('night_resolution_invalid_phase');
  });

  it('rejects a stale or future round before resolution can run', () => {
    expect(() => createNightResolutionInput('game', 1, players, [], game(), roles))
      .toThrow('night_resolution_round_mismatch');
  });

  it('rejects invalid round numbers', () => {
    expect(() => createNightResolutionInput('game', 0, players, [], game({ roundNumber: 0 }), roles))
      .toThrow('night_resolution_invalid_round');
  });

  it('derives wolf team from canonical private roles rather than public game.wolfTeam', () => {
    const result = createNightResolutionInput('game', 2, players, [], game(), roles);
    expect(result.history.wolfTeam).toEqual({ p1: true });
    expect(result.history.wolfTeam).not.toHaveProperty('p2');
    expect(result.history.wolfTeam).not.toHaveProperty('leaked');
  });

  it('drops an explicit false Vigía activation before the legacy resolver sees it', () => {
    const result = createNightResolutionInput(
      'game',
      2,
      players,
      [{ actorUid: 'p1', role: 'Vigía', actions: [{ action: 'vigiaActivate', value: false }] }],
      game(),
      roles,
    );
    expect(result.submissions[0]?.actions).toEqual([]);
  });

  it('drops an explicit false Espía activation before the legacy resolver sees it', () => {
    const result = createNightResolutionInput(
      'game',
      2,
      players,
      [{ actorUid: 'p1', role: 'Espía', actions: [{ action: 'espiaActivate', value: false }] }],
      game(),
      roles,
    );
    expect(result.submissions[0]?.actions).toEqual([]);
  });

  it('preserves a true activation action', () => {
    const result = createNightResolutionInput(
      'game',
      2,
      players,
      [{ actorUid: 'p1', role: 'Vigía', actions: [{ action: 'vigiaActivate', value: true }] }],
      game(),
      roles,
    );
    expect(result.submissions[0]?.actions).toHaveLength(1);
  });

  it('rejects the second wolf target unless doubleKill is the active chaos mechanic', () => {
    const submission = [{
      actorUid: 'p1',
      role: 'Lobo',
      actions: [
        { action: 'wolfTarget', targetUid: 'p2' },
        { action: 'wolfTarget2', targetUid: 'p3' },
      ],
    }];

    const normal = createNightResolutionInput('game', 2, players, submission, game(), roles);
    expect(normal.submissions[0]?.actions).toEqual([{ action: 'wolfTarget', targetUid: 'p2' }]);

    const chaos = createNightResolutionInput(
      'game',
      2,
      players,
      submission,
      game({ currentEvent: { mechanical: 'doubleKill' } }),
      roles,
    );
    expect(chaos.submissions[0]?.actions).toHaveLength(2);
    expect(chaos.history.chaosMechanical).toBe('doubleKill');
  });

  it('preserves Cría de Lobo rage independently of the doubleKill event', () => {
    const submission = [{
      actorUid: 'p1',
      role: 'Cría de Lobo',
      actions: [{ action: 'wolfTarget2', targetUid: 'p3' }],
    }];
    const result = createNightResolutionInput(
      'game',
      2,
      players,
      submission,
      game({ criaLoboRage: true }),
      { ...roles, p1: 'Cría de Lobo' },
    );
    expect(result.submissions[0]?.actions).toHaveLength(1);
  });

  it('rejects the second seer target unless doubleSeer is the active chaos mechanic', () => {
    const submission = [{
      actorUid: 'p3',
      role: 'Vidente',
      actions: [
        { action: 'seerTarget', targetUid: 'p1' },
        { action: 'seerTarget2', targetUid: 'p2' },
      ],
    }];

    const normal = createNightResolutionInput('game', 2, players, submission, game(), roles);
    expect(normal.submissions[0]?.actions).toEqual([{ action: 'seerTarget', targetUid: 'p1' }]);

    const chaos = createNightResolutionInput(
      'game',
      2,
      players,
      submission,
      game({ currentEvent: { mechanical: 'doubleSeer' } }),
      roles,
    );
    expect(chaos.submissions[0]?.actions).toHaveLength(2);
  });
});
