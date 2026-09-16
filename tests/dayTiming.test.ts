import { describe, expect, it } from 'vitest';
import {
  DAY_RESOLUTION_GRACE_MS,
  calculateDayDurationSeconds,
  calculateDayPhaseEndsAt,
} from '@/lib/server/dayTiming';

describe('authoritative day timing', () => {
  it('uses the normal duration for a typical living-player count', () => {
    expect(calculateDayDurationSeconds(8)).toBe(80);
  });

  it('enforces the 60 second normal minimum', () => {
    expect(calculateDayDurationSeconds(0)).toBe(60);
    expect(calculateDayDurationSeconds(1)).toBe(60);
    expect(calculateDayDurationSeconds(6)).toBe(60);
  });

  it('enforces the 120 second normal maximum', () => {
    expect(calculateDayDurationSeconds(12)).toBe(120);
    expect(calculateDayDurationSeconds(32)).toBe(120);
  });

  it('adds 30 seconds for extraTime without exceeding five minutes', () => {
    expect(calculateDayDurationSeconds(8, 'extraTime')).toBe(110);
    expect(calculateDayDurationSeconds(12, 'extraTime')).toBe(150);
    expect(calculateDayDurationSeconds(32, 'extraTime')).toBe(150);
  });

  it('halves the normal duration while enforcing a 30 second minimum', () => {
    expect(calculateDayDurationSeconds(8, 'halfTime')).toBe(40);
    expect(calculateDayDurationSeconds(6, 'halfTime')).toBe(30);
    expect(calculateDayDurationSeconds(1, 'halfTime')).toBe(30);
  });

  it('includes the explicit resolution grace in the authoritative deadline', () => {
    const now = 1_000_000;
    expect(calculateDayPhaseEndsAt(now, 8)).toBe(now + 80_000 + DAY_RESOLUTION_GRACE_MS);
    expect(calculateDayPhaseEndsAt(now, 8, 'extraTime')).toBe(now + 110_000 + DAY_RESOLUTION_GRACE_MS);
    expect(calculateDayPhaseEndsAt(now, 8, 'halfTime')).toBe(now + 40_000 + DAY_RESOLUTION_GRACE_MS);
  });
});
