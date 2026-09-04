export type NightResolutionTimingState = {
  phase: string;
  phaseEndsAt?: number | null;
};

/**
 * Server-side timing gate for night resolution.
 * A missing timer is intentionally allowed for legacy/recovery games; the
 * caller remains responsible for requiring phase === 'night'.
 */
export function canResolveNight(
  state: NightResolutionTimingState,
  now: number = Date.now(),
): boolean {
  if (state.phase !== 'night') return false;
  if (state.phaseEndsAt == null) return true;
  return now >= state.phaseEndsAt;
}
