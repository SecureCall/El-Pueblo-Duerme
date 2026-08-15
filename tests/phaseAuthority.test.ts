import { describe, expect, it } from 'vitest';
import { canTransition, nextPhaseForTimer, assertTransition } from '../lib/game/phaseAuthority';

describe('game phase authority', () => {
  it('allows the normal lifecycle', () => {
    expect(canTransition('lobby', 'roleReveal')).toBe(true);
    expect(canTransition('roleReveal', 'night')).toBe(true);
    expect(canTransition('night', 'day')).toBe(true);
    expect(canTransition('day', 'voting')).toBe(true);
    expect(canTransition('voting', 'night')).toBe(true);
  });

  it('rejects phase skipping and backwards transitions', () => {
    expect(canTransition('lobby', 'night')).toBe(false);
    expect(canTransition('night', 'voting')).toBe(false);
    expect(canTransition('ended', 'night')).toBe(false);
    expect(() => assertTransition('night', 'lobby')).toThrow();
  });

  it('maps timer phases without allowing ended to advance', () => {
    expect(nextPhaseForTimer('roleReveal')).toBe('night');
    expect(nextPhaseForTimer('night')).toBe('day');
    expect(nextPhaseForTimer('day')).toBe('voting');
    expect(nextPhaseForTimer('voting')).toBe('night');
    expect(nextPhaseForTimer('ended')).toBeNull();
  });
});
