export function getRemainingDaySeconds(phaseEndsAt: number | null | undefined, now = Date.now()): number {
  if (!Number.isFinite(phaseEndsAt)) return 0;
  return Math.max(0, Math.ceil((phaseEndsAt - now) / 1000));
}

export function getDayTimerProgress(
  phaseEndsAt: number | null | undefined,
  durationSeconds: number,
  now = Date.now(),
): number {
  if (!Number.isFinite(phaseEndsAt) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const remaining = getRemainingDaySeconds(phaseEndsAt, now);
  return Math.min(1, Math.max(0, remaining / durationSeconds));
}
