/**
 * Pure night-resolution boundary.
 *
 * This module intentionally contains no Firebase imports or writes. The
 * existing GamePlay night resolver remains the source of behaviour while the
 * resolution is migrated incrementally to the server.
 */

export interface NightResolutionContext {
  gameId: string;
  roundNumber: number;
}

/**
 * Marker for the server-side night-resolution boundary.
 *
 * Keep this function deliberately small until the existing processNight()
 * branches have been extracted one by one. Returning the input context makes
 * the first extraction behaviour-preserving and gives us a stable seam for
 * tests and the future Admin SDK resolver.
 */
export function createNightResolutionContext(
  gameId: string,
  roundNumber: number,
): NightResolutionContext {
  return { gameId, roundNumber };
}
