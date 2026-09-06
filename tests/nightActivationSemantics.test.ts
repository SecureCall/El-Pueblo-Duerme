import { describe, expect, it } from 'vitest';
import { resolveNightActions } from '@/lib/server/nightResolutionEngine';
import type { NightResolutionInput } from '@/lib/server/nightResolutionInput';
import type { NightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';

function history(): NightResolutionInput['history'] {
  return {
    guardianLastTarget: null,
    doctorLastTarget: null,
    doctorSelfUsed: false,
    brujaProtectedUid: null,
    hechiceraLifeUsed: false,
    hechiceraPoisonUsed: false,
    lovers: null,
    malditoUid: null,
    eliminatedHistory: [],
    antigoHit: [],
    cambiaformasTargets: {},
    salvajeMentors: {},
    virginiawoolFate: {},
    perroLoboChoices: {},
    cultMembers: [],
    vampiroBites: {},
    vampiroKills: 0,
    pescadorBoat: [],
    enchanted: [],
    hadaLinked: false,
    bansheePoints: 0,
    vigiaUsed: false,
    vigiaKnowsWolves: false,
    angelResucitadorUsed: false,
    espiaUsed: false,
    sirenaUid: null,
    sirenaLinked: null,
    lobosBlocked: false,
    criaLoboRage: false,
    wolfTeam: {},
  };
}

function game(actorRole: 'Vigía' | 'Espía', value: boolean): NightResolutionInput {
  const actorUid = 'actor';
  return {
    gameId: 'activation-test',
    roundNumber: 1,
    phase: 'night',
    players: [
      { uid: actorUid, name: actorRole, isAlive: true },
      { uid: 'other', name: 'Other', isAlive: true },
    ],
    submissions: [{
      actorUid,
      role: actorRole,
      actions: [{ actorUid, action: actorRole === 'Vigía' ? 'vigiaActivate' : 'espiaActivate', value }],
    }],
    history: history(),
  };
}

function snapshot(role: 'Vigía' | 'Espía'): NightRoleSnapshot {
  return { rolesByUid: { actor: role, other: 'Aldeano' } };
}

describe('night activation semantics', () => {
  it('does not activate Vigía when the submission explicitly says false', () => {
    const result = resolveNightActions(game('Vigía', false), snapshot('Vigía'));
    expect(result.statePatch.vigiaUsed).toBe(false);
  });

  it('does not activate Espía when the submission explicitly says false', () => {
    const result = resolveNightActions(game('Espía', false), snapshot('Espía'));
    expect(result.statePatch.espiaUsed).toBe(false);
  });

  it('activates Vigía when the submission explicitly says true', () => {
    const result = resolveNightActions(game('Vigía', true), snapshot('Vigía'));
    expect(result.statePatch.vigiaUsed).toBe(true);
  });
});
