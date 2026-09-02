import { describe, expect, it } from 'vitest';
import { resolveNightActions } from '@/lib/server/nightResolutionEngine';
import type { NightResolutionInput } from '@/lib/server/nightResolutionInput';
import type { NightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';

function baseHistory(): NightResolutionInput['history'] {
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

function input(
  players: NightResolutionInput['players'],
  submissions: NightResolutionInput['submissions'],
  history = baseHistory(),
): NightResolutionInput {
  return { gameId: 'test-game', roundNumber: 1, phase: 'night', players, submissions, history };
}

function snapshot(rolesByUid: Record<string, string>): NightRoleSnapshot {
  return { rolesByUid };
}

function action(actorUid: string, role: string, action: string, targetUid?: string) {
  return { actorUid, role, actions: [{ actorUid, action, ...(targetUid ? { targetUid } : {}) }] };
}

describe('night resolution engine', () => {
  it('synchronizes persisted player.role when Maldito becomes Lobo', () => {
    const game = input(
      [
        { uid: 'wolf', name: 'Wolf', isAlive: true },
        { uid: 'maldito', name: 'Maldito', isAlive: true },
        { uid: 'villager', name: 'Villager', isAlive: true },
      ],
      [action('wolf', 'Lobo', 'wolfTarget', 'maldito')],
      { ...baseHistory(), malditoUid: 'maldito' },
    );

    const result = resolveNightActions(game, snapshot({ wolf: 'Lobo', maldito: 'Maldito', villager: 'Aldeano' }));

    expect(result.statePatch.roles.maldito).toBe('Lobo');
    expect(result.statePatch.players.find((p) => p.uid === 'maldito')?.role).toBe('Lobo');
    expect(result.deathEffects.transformedMalditoUid).toBe('maldito');
    expect(result.statePatch.players.find((p) => p.uid === 'maldito')?.isAlive).toBe(true);
  });

  it('resolves Gemelas cascade only when the first twin dies during this night', () => {
    const game = input(
      [
        { uid: 'wolf', name: 'Wolf', isAlive: true },
        { uid: 'g1', name: 'Gemela 1', isAlive: true },
        { uid: 'g2', name: 'Gemela 2', isAlive: true },
        { uid: 'villager', name: 'Villager', isAlive: true },
      ],
      [action('wolf', 'Lobo', 'wolfTarget', 'g1')],
    );

    const result = resolveNightActions(
      game,
      snapshot({ wolf: 'Lobo', g1: 'Gemela', g2: 'Gemela', villager: 'Aldeano' }),
    );

    expect(result.statePatch.players.find((p) => p.uid === 'g1')?.isAlive).toBe(false);
    expect(result.statePatch.players.find((p) => p.uid === 'g2')?.isAlive).toBe(false);
    expect(result.deathEffects.deathReasons.g2).toContain('gemelas_cascade');
  });

  it('updates player.role when Cambiaformas adopts a dead player role', () => {
    const history = baseHistory();
    history.cambiaformasTargets = { cf: 'victim' };
    const game = input(
      [
        { uid: 'wolf', name: 'Wolf', isAlive: true },
        { uid: 'cf', name: 'Cambiaformas', isAlive: true },
        { uid: 'victim', name: 'Victim', isAlive: true },
        { uid: 'villager', name: 'Villager', isAlive: true },
      ],
      [action('wolf', 'Lobo', 'wolfTarget', 'victim')],
      history,
    );

    const result = resolveNightActions(
      game,
      snapshot({ wolf: 'Lobo', cf: 'Cambiaformas', victim: 'Lobo Blanco', villager: 'Aldeano' }),
    );

    expect(result.statePatch.roles.cf).toBe('Lobo Blanco');
    expect(result.statePatch.players.find((p) => p.uid === 'cf')?.role).toBe('Lobo Blanco');
    expect(result.statePatch.wolfTeam.cf).toBe(true);
    expect(result.statePatch.cambiaformasTargets.cf).toBeUndefined();
  });
});
