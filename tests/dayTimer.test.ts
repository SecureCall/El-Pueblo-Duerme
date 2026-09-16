import { describe, expect, it } from 'vitest';
import { getDayTimerProgress, getRemainingDaySeconds } from '@/lib/game/dayTimer';

describe('day timer', () => {
  it('derives remaining time from the authoritative phase deadline', () => {
    expect(getRemainingDaySeconds(110_000, 100_000)).toBe(10);
    expect(getRemainingDaySeconds(110_001, 100_000)).toBe(11);
  });

  it('never returns negative time after the authoritative deadline', () => {
    expect(getRemainingDaySeconds(100_000, 100_001)).toBe(0);
  });

  it('returns zero when no authoritative deadline exists', () => {
    expect(getRemainingDaySeconds(null, 100_000)).toBe(0);
    expect(getRemainingDaySeconds(undefined, 100_000)).toBe(0);
  });

  it('derives progress from the same authoritative deadline', () => {
    expect(getDayTimerProgress(110_000, 20, 100_000)).toBe(0.5);
    expect(getDayTimerProgress(100_000, 20, 100_001)).toBe(0);
    expect(getDayTimerProgress(null, 20, 100_000)).toBe(0);
  });
});
