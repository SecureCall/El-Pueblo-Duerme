import { describe, expect, it } from 'vitest';
import {
  createNightActionSubmissions,
  validateNightActionSubmissions,
} from './nightResolution';

describe('night action contract', () => {
  const players = [
    { uid: 'white-wolf', isAlive: true },
    { uid: 'wolf', isAlive: true },
    { uid: 'villager', isAlive: true },
    { uid: 'dead', isAlive: false },
  ];

  it('serializes Lobo Blanco cide as a target UID', () => {
    const submissions = createNightActionSubmissions('white-wolf', { loboBlancoCide: 'wolf' });
    expect(submissions).toEqual([{ actorUid: 'white-wolf', action: 'loboBlancoCide', targetUid: 'wolf' }]);
  });

  it('accepts the Lobo Blanco cide action for the correct role', () => {
    const submissions = createNightActionSubmissions('white-wolf', { loboBlancoCide: 'wolf' });
    expect(validateNightActionSubmissions(players, 'white-wolf', 'Lobo Blanco', submissions)).toEqual({ valid: true, errors: [] });
  });

  it('rejects an action targeting a dead player', () => {
    const submissions = createNightActionSubmissions('white-wolf', { loboBlancoCide: 'dead' });
    const result = validateNightActionSubmissions(players, 'white-wolf', 'Lobo Blanco', submissions);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid_target:dead');
  });

  it('allows Angel Resucitador to select a dead player', () => {
    const submissions = createNightActionSubmissions('angel', { angelResucitarTarget: 'dead' });
    const result = validateNightActionSubmissions(
      [...players, { uid: 'angel', isAlive: true }], 'angel', 'Ángel Resucitador', submissions,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('allows Médico Forense to inspect a dead player', () => {
    const submissions = createNightActionSubmissions('forense', { forenseTarget: 'dead' });
    const result = validateNightActionSubmissions(
      [...players, { uid: 'forense', isAlive: true }], 'forense', 'Médico Forense', submissions,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects false boolean activations', () => {
    const submissions = createNightActionSubmissions('vigia', { vigiaActivate: false });
    const result = validateNightActionSubmissions(
      [...players, { uid: 'vigia', isAlive: true }], 'vigia', 'Vigía', submissions,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid_boolean:vigiaActivate');
  });

  it('accepts true boolean activations', () => {
    const submissions = createNightActionSubmissions('vigia', { vigiaActivate: true });
    const result = validateNightActionSubmissions(
      [...players, { uid: 'vigia', isAlive: true }], 'vigia', 'Vigía', submissions,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects Lobo Blanco cide when submitted by another role', () => {
    const submissions = createNightActionSubmissions('wolf', { loboBlancoCide: 'white-wolf' });
    const result = validateNightActionSubmissions(players, 'wolf', 'Lobo', submissions);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('role_not_allowed:wolf:loboBlancoCide');
  });
});
