import { describe, expect, it } from 'vitest';
import { chooseAiEliminateTarget } from '@/lib/server/chaosAiEliminate';

describe('authoritative aiEliminate selector', () => {
  const players = [
    { uid: 'alice', isAlive: true },
    { uid: 'bob', isAlive: true },
    { uid: 'carol', isAlive: true },
    { uid: 'dead', isAlive: false },
  ];

  it('is deterministic across retries', () => {
    const first = chooseAiEliminateTarget('game-123', 4, players);
    const second = chooseAiEliminateTarget('game-123', 4, players);
    expect(second).toEqual(first);
  });

  it('only selects a living player', () => {
    const result = chooseAiEliminateTarget('game-123', 4, players);
    expect(['alice', 'bob', 'carol']).toContain(result.targetUid);
    expect(result.targetUid).not.toBe('dead');
  });

  it('is independent of input ordering', () => {
    const first = chooseAiEliminateTarget('game-123', 4, players);
    const second = chooseAiEliminateTarget('game-123', 4, [...players].reverse());
    expect(second).toEqual(first);
  });

  it('returns null when nobody is alive', () => {
    expect(chooseAiEliminateTarget('game-123', 4, [
      { uid: 'dead', isAlive: false },
    ])).toEqual({ targetUid: null });
  });

  it('does not mutate the player snapshot', () => {
    const original = players.map((player) => ({ ...player }));
    chooseAiEliminateTarget('game-123', 4, players);
    expect(players).toEqual(original);
  });
});
