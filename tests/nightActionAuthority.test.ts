import { describe, expect, it } from 'vitest';
import { validateNightSubmission } from '@/lib/game/nightActionAuthority';

const players = [
  { uid: 'wolf', isAlive: true },
  { uid: 'seer', isAlive: true },
  { uid: 'a', isAlive: true },
  { uid: 'b', isAlive: true },
  { uid: 'dead', isAlive: false },
];

const state = (round = 1, extra: Record<string, unknown> = {}) => ({
  phase: 'night' as const,
  round,
  eclipseActive: false,
  doubleSeerActive: false,
  criaLoboRage: false,
  history: extra,
});

describe('canonical night action authority', () => {
  it('requires exactly two Cupid targets', () => {
    expect(validateNightSubmission(state(), players, 'a', 'Cupido', [{ actorUid: 'a', action: 'cupidTargets', targetUids: ['b'] }]).valid).toBe(false);
    expect(validateNightSubmission(state(), players, 'a', 'Cupido', [{ actorUid: 'a', action: 'cupidTargets', targetUids: ['wolf', 'b'] }]).valid).toBe(true);
  });

  it('requires exactly two Piper targets', () => {
    expect(validateNightSubmission(state(2), players, 'a', 'Flautista', [{ actorUid: 'a', action: 'flautistaTargets', targetUids: ['b'] }]).valid).toBe(false);
    expect(validateNightSubmission(state(2), players, 'a', 'Flautista', [{ actorUid: 'a', action: 'flautistaTargets', targetUids: ['wolf', 'b'] }]).valid).toBe(true);
  });

  it('allows White Wolf cide only on even nights', () => {
    const action = { actorUid: 'wolf', action: 'loboBlancoCide', targetUid: 'a' };
    expect(validateNightSubmission(state(1), players, 'wolf', 'Lobo Blanco', [action]).valid).toBe(false);
    expect(validateNightSubmission(state(2), players, 'wolf', 'Lobo Blanco', [action]).valid).toBe(true);
  });

  it('gates the second wolf kill behind rage or eclipse', () => {
    const action = { actorUid: 'wolf', action: 'wolfTarget2', targetUid: 'a' };
    expect(validateNightSubmission(state(), players, 'wolf', 'Lobo', [action]).valid).toBe(false);
    expect(validateNightSubmission(state(1, {}), players, 'wolf', 'Lobo', [action]).valid).toBe(false);
    expect(validateNightSubmission({ ...state(), eclipseActive: true }, players, 'wolf', 'Lobo', [action]).valid).toBe(true);
    expect(validateNightSubmission({ ...state(), criaLoboRage: true }, players, 'Cría de Lobo', [action]).valid).toBe(true);
  });

  it('allows second seer target only during double-seer', () => {
    const action = { actorUid: 'seer', action: 'seerTarget2', targetUid: 'a' };
    expect(validateNightSubmission(state(), players, 'seer', 'Vidente', [action]).valid).toBe(false);
    expect(validateNightSubmission({ ...state(), doubleSeerActive: true }, players, 'seer', 'Vidente', [action]).valid).toBe(true);
  });

  it('only Angel and Forensic can target corpses', () => {
    const angel = { actorUid: 'a', action: 'angelResucitarTarget', targetUid: 'dead' };
    const forensic = { actorUid: 'a', action: 'forenseTarget', targetUid: 'dead' };
    expect(validateNightSubmission(state(), players, 'a', 'Ángel Resucitador', [angel]).valid).toBe(true);
    expect(validateNightSubmission(state(), players, 'a', 'Médico Forense', [forensic]).valid).toBe(true);
  });

  it('does not allow skip together with a real action', () => {
    const actions = [
      { actorUid: 'seer', action: '_skip', value: true },
      { actorUid: 'seer', action: 'seerTarget', targetUid: 'a' },
    ];
    expect(validateNightSubmission(state(), players, 'seer', 'Vidente', actions).valid).toBe(false);
  });

  it('requires true for boolean abilities', () => {
    expect(validateNightSubmission(state(), players, 'a', 'Vigía', [{ actorUid: 'a', action: 'vigiaActivate', value: false }]).valid).toBe(false);
    expect(validateNightSubmission(state(), players, 'a', 'Vigía', [{ actorUid: 'a', action: 'vigiaActivate', value: true }]).valid).toBe(true);
  });
});
