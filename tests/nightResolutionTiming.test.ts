import { describe, expect, it } from 'vitest';
import { canResolveNight } from '@/lib/server/nightResolutionTiming';

describe('night resolution timing gate', () => {
  const endsAt = 100_000;

  it('rejects resolution before the server deadline', () => {
    expect(canResolveNight({ phase: 'night', phaseEndsAt: endsAt }, endsAt - 1)).toBe(false);
  });

  it('allows resolution exactly at the deadline', () => {
    expect(canResolveNight({ phase: 'night', phaseEndsAt: endsAt }, endsAt)).toBe(true);
  });

  it('allows resolution after the deadline', () => {
    expect(canResolveNight({ phase: 'night', phaseEndsAt: endsAt }, endsAt + 1)).toBe(true);
  });

  it('rejects non-night phases even when their timer has expired', () => {
    expect(canResolveNight({ phase: 'day', phaseEndsAt: endsAt }, endsAt + 10_000)).toBe(false);
  });

  it('allows legacy night states without a timer', () => {
    expect(canResolveNight({ phase: 'night', phaseEndsAt: null }, 1)).toBe(true);
    expect(canResolveNight({ phase: 'night' }, 1)).toBe(true);
  });
});
