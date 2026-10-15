import { describe, expect, it } from 'vitest';
import { chooseChaosReviveTarget } from '@/lib/server/chaosRevive';

describe('chooseChaosReviveTarget', () => {
  const players = [
    { uid: 'alice', isAlive: false },
    { uid: 'bob', isAlive: false },
    { uid: 'carol', isAlive: true },
    { uid: 'dave', isAlive: false },
  ];

  const history = [
    { uid: 'alice' },
    { uid: 'bob' },
    { uid: 'dave' },
  ];

  it('is deterministic across retries', () => {
    const first = chooseChaosReviveTarget('game-123', 4, players, history);
    const second = chooseChaosReviveTarget('game-123', 4, players, history);
    expect(first).toEqual(second);
    expect(first.targetUid).toBeTruthy();
  });

  it('is independent of player/history ordering', () => {
    const first = chooseChaosReviveTarget('game-123', 4, players, history);
    const second = chooseChaosReviveTarget(
      'game-123',
      4,
      [...players].reverse(),
      [...history].reverse(),
    );
    expect(second).toEqual(first);
  });

  it('only selects currently-dead players that exist in elimination history', () => {
    const result = chooseChaosReviveTarget('game-123', 4, [
      { uid: 'alice', isAlive: true },
      { uid: 'bob', isAlive: false },
      { uid: 'not-in-history', isAlive: false },
    ], [
      { uid: 'bob' },
    ]);
    expect(result.targetUid).toBe('bob');
  });

  it('returns null when nobody can be revived', () => {
    expect(chooseChaosReviveTarget('game-123', 4, [
      { uid: 'alice', isAlive: true },
    ], [{ uid: 'alice' }])).toEqual({ targetUid: null });
  });

  it('does not mutate its inputs', () => {
    const playerSnapshot = structuredClone(players);
    const historySnapshot = structuredClone(history);
    chooseChaosReviveTarget('game-123', 4, players, history);
    expect(players).toEqual(playerSnapshot);
    expect(history).toEqual(historySnapshot);
  });
});
