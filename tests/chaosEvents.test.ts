import { describe, expect, it } from 'vitest';
import { CHAOS_EVENTS, drawChaosEvent } from '@/lib/server/chaosEvents';

describe('server chaos event catalog', () => {
  it('keeps the authoritative event catalog independent and complete', () => {
    expect(CHAOS_EVENTS).toHaveLength(14);
    expect(new Set(CHAOS_EVENTS.map((event) => event.id)).size).toBe(CHAOS_EVENTS.length);
    expect(new Set(CHAOS_EVENTS.map((event) => event.mechanical)).size).toBe(CHAOS_EVENTS.length);
    expect(CHAOS_EVENTS.map((event) => event.mechanical)).toEqual([
      'noExile',
      'doubleKill',
      'revealDead',
      'healWitch',
      'anonymousVotes',
      'extraTime',
      'halfTime',
      'doubleSeer',
      'roleSwap',
      'inverterVotes',
      'aiEliminate',
      'dobleEjecucion',
      'revive',
      'forceConfession',
    ]);
  });

  it('preserves the 30% event probability boundary', () => {
    expect(drawChaosEvent(() => 0.31)).toBeNull();
    expect(drawChaosEvent(() => 0.30)?.id).toBe('tormenta');
  });

  it('allows deterministic selection for server tests', () => {
    const values = [0.1, 0.5];
    const event = drawChaosEvent(() => values.shift() ?? 0);
    expect(event?.id).toBe('presagio');
  });
});
