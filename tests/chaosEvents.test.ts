import { describe, expect, it } from 'vitest';
import { CHAOS_EVENTS, chaosEventAppliesToPhase, drawChaosEvent } from '@/lib/server/chaosEvents';

describe('server chaos event catalog', () => {
  it('keeps the authoritative event catalog independent and complete', () => {
    expect(CHAOS_EVENTS).toHaveLength(14);
    expect(new Set(CHAOS_EVENTS.map((event) => event.id)).size).toBe(CHAOS_EVENTS.length);
    expect(new Set(CHAOS_EVENTS.map((event) => event.mechanical)).size).toBe(CHAOS_EVENTS.length);
    expect(CHAOS_EVENTS.map((event) => event.mechanical)).toEqual([
      'noExile', 'doubleKill', 'revealDead', 'healWitch', 'anonymousVotes',
      'extraTime', 'halfTime', 'doubleSeer', 'roleSwap', 'inverterVotes',
      'aiEliminate', 'dobleEjecucion', 'revive', 'forceConfession',
    ]);
    expect(CHAOS_EVENTS.every((event) => event.phase === 'day' || event.phase === 'night')).toBe(true);
  });

  it('assigns night-only mechanics to the night lifecycle', () => {
    for (const mechanical of ['doubleKill', 'doubleSeer', 'aiEliminate']) {
      const event = CHAOS_EVENTS.find((candidate) => candidate.mechanical === mechanical);
      expect(event?.phase).toBe('night');
    }
  });

  it('assigns voting/day mechanics to the day lifecycle', () => {
    for (const mechanical of ['noExile', 'revealDead', 'healWitch', 'anonymousVotes', 'extraTime', 'halfTime', 'roleSwap', 'inverterVotes', 'dobleEjecucion', 'revive', 'forceConfession']) {
      const event = CHAOS_EVENTS.find((candidate) => candidate.mechanical === mechanical);
      expect(event?.phase).toBe('day');
    }
  });

  it('does not allow a persisted event to be consumed in the wrong phase', () => {
    const nightEvent = CHAOS_EVENTS.find((event) => event.mechanical === 'doubleKill') ?? null;
    const dayEvent = CHAOS_EVENTS.find((event) => event.mechanical === 'inverterVotes') ?? null;
    expect(chaosEventAppliesToPhase(nightEvent, 'night')).toBe(true);
    expect(chaosEventAppliesToPhase(nightEvent, 'day')).toBe(false);
    expect(chaosEventAppliesToPhase(dayEvent, 'day')).toBe(true);
    expect(chaosEventAppliesToPhase(dayEvent, 'night')).toBe(false);
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
