import { describe, expect, it } from 'vitest';
import { chooseForceConfessionTarget } from '@/lib/server/chaosForceConfession';

describe('authoritative forceConfession selector', () => {
  const players = [
    { uid: 'alice', isAlive: true },
    { uid: 'bob', isAlive: true },
    { uid: 'carol', isAlive: true },
    { uid: 'dead', isAlive: false },
  ];

  it('is deterministic across retries', () => {
    const first = chooseForceConfessionTarget('game-123', 4, players);
    const second = chooseForceConfessionTarget('game-123', 4, players);
    expect(second).toEqual(first);
  });

  it('only selects a living player', () => {
    const result = chooseForceConfessionTarget('game-123', 4, players);
    expect(['alice', 'bob', 'carol']).toContain(result.targetUid);
    expect(result.targetUid).not.toBe('dead');
  });

  it('is independent of input ordering', () => {
    const first = chooseForceConfessionTarget('game-123', 4, players);
    const second = chooseForceConfessionTarget('game-123', 4, [...players].reverse());
    expect(second).toEqual(first);
  });

  it('returns null when nobody is alive', () => {
    expect(chooseForceConfessionTarget('game-123', 4, [
      { uid: 'dead', isAlive: false },
    ])).toEqual({ targetUid: null });
  });

  it('does not mutate the player snapshot', () => {
    const original = players.map((player) => ({ ...player }));
    chooseForceConfessionTarget('game-123', 4, players);
    expect(players).toEqual(original);
  });
});
