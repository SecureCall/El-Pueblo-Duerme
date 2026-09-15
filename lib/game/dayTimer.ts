export function getRemainingDaySeconds(phaseEndsAt: number | null | undefined, now = Date.now()): number {
  if (!Number.isFinite(phaseEndsAt)) return 0;
  return Math.max(0, Math.ceil((phaseEndsAt - now) / 1000));
}
