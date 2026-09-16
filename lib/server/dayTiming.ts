export const DAY_RESOLUTION_GRACE_MS = 2_000;

export type DayTimingMechanical = string | null | undefined;

/**
 * Single authoritative source for the normal day debate duration.
 * The browser may display the deadline, but never calculates a different one.
 */
export function calculateDayDurationSeconds(
  aliveCount: number,
  mechanical?: DayTimingMechanical,
): number {
  const safeAliveCount = Number.isFinite(aliveCount) ? Math.max(0, Math.floor(aliveCount)) : 0;
  const base = Math.min(120, Math.max(60, safeAliveCount * 10));

  if (mechanical === 'extraTime') return Math.min(300, base + 30);
  if (mechanical === 'halfTime') return Math.max(30, Math.floor(base / 2));
  return base;
}

export function calculateDayPhaseEndsAt(
  now: number,
  aliveCount: number,
  mechanical?: DayTimingMechanical,
): number {
  const durationMs = calculateDayDurationSeconds(aliveCount, mechanical) * 1_000;
  return now + durationMs + DAY_RESOLUTION_GRACE_MS;
}
