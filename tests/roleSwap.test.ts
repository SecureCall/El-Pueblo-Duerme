import { describe, expect, it } from 'vitest';
import { applyRoleSwap } from '@/lib/server/roleSwap';

describe('applyRoleSwap', () => {
  it('preserves the living role multiset and is deterministic for the same game and round', () => {
    const initial = { a: 'Lobo', b: 'Vidente', c: 'Aldeano', dead: 'Lobo Blanco' };
    const first = { ...initial };
    const retry = { ...initial };

    applyRoleSwap(first, ['a', 'b', 'c'], 'game-123', 4);
    applyRoleSwap(retry, ['c', 'a', 'b'], 'game-123', 4);

    expect(['a', 'b', 'c'].map((uid) => first[uid]).sort()).toEqual(['Aldeano', 'Lobo', 'Vidente']);
    expect(first).toEqual(retry);
    expect(first.dead).toBe('Lobo Blanco');
  });

  it('does not mutate dead or unlisted player roles', () => {
    const roles = { aliveA: 'Lobo', aliveB: 'Aldeano', dead: 'Vidente' };
    applyRoleSwap(roles, ['aliveA', 'aliveB'], 'game-456', 2);
    expect(roles.dead).toBe('Vidente');
    expect(Object.keys(roles)).toEqual(['aliveA', 'aliveB', 'dead']);
  });

  it('rejects an incomplete private role snapshot instead of silently losing a role', () => {
    expect(() => applyRoleSwap({ a: 'Lobo' }, ['a', 'b'], 'game-789', 1))
      .toThrow('role_swap_snapshot_incomplete');
  });
});
