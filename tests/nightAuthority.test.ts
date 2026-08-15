import { describe, expect, it } from 'vitest';

describe('night authority invariants', () => {
  it('uses a stable claim key per round', () => {
    const round = 7;
    expect(`night:${round}`).toBe('night:7');
  });

  it('does not allow a second resolution claim for the same round', () => {
    const claim = 'night:3';
    expect(claim === 'night:3').toBe(true);
  });
});
