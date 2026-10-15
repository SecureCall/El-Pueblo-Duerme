import { describe, expect, it } from 'vitest';
import { applyChaosRevive } from '@/lib/server/chaosReviveApply';

describe('applyChaosRevive', () => {
  it('revives the deterministic dead candidate and removes its stale death history', () => {
    const players = [
      { uid: 'alice', isAlive: false },
      { uid: 'bob', isAlive: false },
      { uid: 'wolf', isAlive: true },
    ];
    const history = [
      { uid: 'alice', name: 'Alice', role: 'Aldeano', round: 1 },
      { uid: 'bob', name: 'Bob', role: 'Aldeano', round: 2 },
    ];

    const result = applyChaosRevive(
      'game-123',
      4,
      players,
      history,
      { alice: 'Aldeano', bob: 'Aldeano', wolf: 'Lobo' },
      { wolf: true },
    );

    expect(result.targetUid).toBeTruthy();
    expect(result.players.find((player) => player.uid === result.targetUid)?.isAlive).toBe(true);
    expect(result.eliminatedHistory.some((entry) => entry.uid === result.targetUid)).toBe(false);
    expect(result.wolfTeam).toEqual({ wolf: true });
  });

  it('rebuilds wolfTeam from authoritative roles instead of trusting the input team', () => {
    const result = applyChaosRevive(
      'game-123',
      4,
      [{ uid: 'dead', isAlive: false }, { uid: 'wolf', isAlive: true }],
      [{ uid: 'dead', name: 'Dead', role: 'Aldeano', round: 1 }],
      { dead: 'Aldeano', wolf: 'Lobo Blanco' },
      { dead: true, wolf: false },
    );

    expect(result.wolfTeam).toEqual({ wolf: true });
  });

  it('does not mutate the supplied state', () => {
    const players = [{ uid: 'dead', isAlive: false }];
    const history = [{ uid: 'dead', name: 'Dead', role: 'Aldeano', round: 1 }];
    const originalPlayers = structuredClone(players);
    const originalHistory = structuredClone(history);

    applyChaosRevive('game-123', 4, players, history, { dead: 'Aldeano' }, {});

    expect(players).toEqual(originalPlayers);
    expect(history).toEqual(originalHistory);
  });
});
