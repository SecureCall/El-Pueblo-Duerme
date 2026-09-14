import { describe, expect, it } from 'vitest';
import { applyRoleSwap, isWolfRole } from '@/lib/server/chaosRoleSwap';

describe('authoritative role swap', () => {
  const players = [
    { uid: 'alice', isAlive: true },
    { uid: 'bob', isAlive: true },
    { uid: 'carol', isAlive: true },
    { uid: 'dead', isAlive: false },
  ];

  const roles = {
    alice: 'Lobo',
    bob: 'Vidente',
    carol: 'Aldeano',
    dead: 'Cazador',
  };

  it('is deterministic across retries', () => {
    const first = applyRoleSwap('game-123', 4, players, roles);
    const second = applyRoleSwap('game-123', 4, players, roles);
    expect(second).toEqual(first);
  });

  it('only permutes roles among living players', () => {
    const result = applyRoleSwap('game-123', 4, players, roles);
    expect(result.roles.dead).toBe('Cazador');
    expect(new Set([result.roles.alice, result.roles.bob, result.roles.carol])).toEqual(
      new Set(['Lobo', 'Vidente', 'Aldeano']),
    );
  });

  it('rebuilds wolf authority from the swapped roles', () => {
    const result = applyRoleSwap('game-123', 4, players, roles);
    for (const uid of ['alice', 'bob', 'carol']) {
      expect(result.wolfTeam[uid] ?? false).toBe(isWolfRole(result.roles[uid]));
    }
    expect(result.wolfTeam.dead).toBeUndefined();
  });

  it('does not mutate the input role map', () => {
    const original = { ...roles };
    applyRoleSwap('game-123', 4, players, roles);
    expect(roles).toEqual(original);
  });

  it('does not reshuffle when fewer than two living players exist', () => {
    const result = applyRoleSwap('game-123', 4, [{ uid: 'alice', isAlive: true }], roles);
    expect(result.roles).toEqual(roles);
  });
});
