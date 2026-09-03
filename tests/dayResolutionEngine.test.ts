import { describe, expect, it } from 'vitest';
import { resolveDay, type DayResolutionInput } from '@/lib/server/dayResolutionEngine';

function input(overrides: Partial<DayResolutionInput> = {}): DayResolutionInput {
  return {
    gameId: 'test',
    roundNumber: 2,
    now: 1_000_000,
    players: [
      { uid: 'wolf', name: 'Wolf', isAlive: true },
      { uid: 'villager', name: 'Villager', isAlive: true },
      { uid: 'seer', name: 'Seer', isAlive: true },
    ],
    votes: { wolf: 'villager', villager: 'wolf', seer: 'wolf' },
    roles: { wolf: 'Lobo', villager: 'Aldeano', seer: 'Vidente' },
    wolfTeam: { wolf: true },
    eliminatedHistory: [],
    enchanted: [],
    salvajeMentors: {},
    cambiaformasTargets: {},
    verdugos: {},
    virginiawoolFate: {},
    lovers: null,
    cultMembers: [],
    perroLoboChoices: {},
    vampiroKills: 0,
    pescadorBoat: [],
    hadaLinked: false,
    fantasmaPending: [],
    fantasmaUsed: [],
    bansheePoints: 0,
    bansheePredictionUid: null,
    voteBanned: [],
    saboteadorBan: null,
    cursed: null,
    currentEvent: null,
    noExileActive: false,
    principeUsed: false,
    alborotadoraFight: null,
    sirenaLinked: null,
    ...overrides,
  };
}

describe('resolveDay', () => {
  it('ignores votes from dead players and votes against dead targets', () => {
    const result = resolveDay(input({
      players: [
        { uid: 'wolf', name: 'Wolf', isAlive: true },
        { uid: 'villager', name: 'Villager', isAlive: false },
        { uid: 'seer', name: 'Seer', isAlive: true },
      ],
      votes: { wolf: 'villager', villager: 'wolf', seer: 'wolf' },
      roles: { wolf: 'Lobo', villager: 'Aldeano', seer: 'Vidente' },
    }));
    expect(result.tally).toEqual({ wolf: 1 });
    expect(result.eliminated).toBe('wolf');
  });

  it('applies Alcalde double vote and current-round cursed bonus', () => {
    const result = resolveDay(input({
      players: [
        { uid: 'mayor', name: 'Mayor', isAlive: true },
        { uid: 'target', name: 'Target', isAlive: true },
        { uid: 'cursed', name: 'Cursed', isAlive: true },
      ],
      votes: { mayor: 'target' },
      roles: { mayor: 'Alcalde', target: 'Aldeano', cursed: 'Aldeano' },
      cursed: { uid: 'cursed', round: 2 },
    }));
    expect(result.tally).toEqual({ target: 2, cursed: 1 });
    expect(result.eliminated).toBe('target');
  });

  it('does not exile anyone during Tormenta/no-exile', () => {
    const result = resolveDay(input({
      noExileActive: true,
      votes: { wolf: 'villager', villager: 'wolf' },
    }));
    expect(result.eliminated).toBeNull();
    expect(result.secondEliminated).toBeNull();
    expect(result.statePatch.phase).toBe('night');
  });

  it('converts Niño Salvaje when its mentor dies', () => {
    const result = resolveDay(input({
      players: [
        { uid: 'mentor', name: 'Mentor', isAlive: true },
        { uid: 'child', name: 'Child', isAlive: true },
        { uid: 'other', name: 'Other', isAlive: true },
      ],
      votes: { other: 'mentor' },
      roles: { mentor: 'Aldeano', child: 'Niño Salvaje', other: 'Aldeano' },
      salvajeMentors: { child: 'mentor' },
    }));
    expect(result.eliminated).toBe('mentor');
    expect(result.statePatch.roles.child).toBe('Lobo');
    expect(result.statePatch.wolfTeam.child).toBe(true);
  });

  it('keeps client-supplied wolfTeam from granting wolf status to a non-wolf role', () => {
    const result = resolveDay(input({
      wolfTeam: { wolf: true, villager: true },
    }));
    expect(result.statePatch.wolfTeam.villager).toBeUndefined();
    expect(result.statePatch.wolfTeam.wolf).toBe(true);
  });
});
