import { describe, expect, it } from 'vitest';
import { checkWinCondition } from '@/components/game/play/roles';

const p = (uid: string, isAlive = true) => ({ uid, isAlive });

function result(players: { uid: string; isAlive: boolean }[], roles: Record<string, string>, opts: Parameters<typeof checkWinCondition>[2] = {}) {
  return checkWinCondition(players, roles, opts).winner;
}

describe('checkWinCondition - reglas actuales', () => {
  it('declares village victory when no wolves remain', () => {
    expect(result([p('a')], { a: 'Aldeano' })).toBe('village');
  });

  it('declares wolves victory when wolves equal villagers', () => {
    expect(result([p('w'), p('v')], { w: 'Lobo', v: 'Aldeano' })).toBe('wolves');
  });

  it('does not finish while wolves are outnumbered', () => {
    expect(result([p('w'), p('v1'), p('v2')], { w: 'Lobo', v1: 'Aldeano', v2: 'Vidente' })).toBeNull();
  });

  it('gives Angel the first-round vote win', () => {
    expect(result([p('a', false), p('v')], { a: 'Ángel', v: 'Aldeano' }, {
      round: 1, dayEliminatedUid: 'a', eliminatedByVote: true,
    })).toBe('angel');
  });

  it('gives Hombre Ebrio the special death win', () => {
    expect(result([p('v')], { e: 'Hombre Ebrio', v: 'Aldeano' }, {
      nightKilledUids: ['e'],
    })).toBe('ebrio');
  });

  it('gives Flautista the win when all living players are enchanted', () => {
    expect(result([p('f'), p('v')], { f: 'Flautista', v: 'Aldeano' }, {
      enchanted: ['f', 'v'],
    })).toBe('flautista');
  });

  it('gives Picaro the special endgame win', () => {
    expect(result([p('p'), p('w')], { p: 'Pícaro', w: 'Lobo' })).toBe('picaro');
  });

  it('gives Vampiro the win after three bite kills', () => {
    expect(result([p('v')], { v: 'Vampiro' }, { vampiroKills: 3 })).toBe('vampiro');
  });

  it('gives Cult leader the win when all living players are cult members', () => {
    expect(result([p('c'), p('v')], { c: 'Líder del Culto', v: 'Aldeano' }, {
      cultMembers: ['c', 'v'],
    })).toBe('lider_culto');
  });

  it('gives Fisherman the win when every living non-wolf/non-fisherman is on the boat', () => {
    expect(result([p('f'), p('v')], { f: 'Pescador', v: 'Aldeano' }, {
      pescadorBoat: ['v'],
    })).toBe('pescador');
  });

  it('gives linked fairies the joint win when they are the last two', () => {
    expect(result([p('f1'), p('f2')], { f1: 'Hada Buscadora', f2: 'Hada Durmiente' }, {
      hadaLinked: true,
    })).toBe('hadas');
  });

  it('gives White Wolf solo victory when it is the only wolf and wolves have parity', () => {
    expect(result([p('w'), p('v')], { w: 'Lobo Blanco', v: 'Aldeano' })).toBe('lobo_blanco');
  });

  it('gives cross-team lovers the final-two victory', () => {
    expect(result([p('w'), p('v')], { w: 'Lobo', v: 'Aldeano' }, {
      lovers: ['w', 'v'],
    })).toBe('lovers');
  });

  it('preserves the special-death priority over normal wolf resolution', () => {
    expect(result([p('w')], { w: 'Lobo', e: 'Hombre Ebrio' }, {
      nightKilledUids: ['e'],
    })).toBe('ebrio');
  });
});
