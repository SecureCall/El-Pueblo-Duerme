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

/** The client-side night action shape currently used by GamePlay. */
export interface NightActions {
  wolfTarget?: string;
  wolfTarget2?: string;
  seerTarget?: string;
  seerTarget2?: string;
  witchSave?: boolean;
  witchPoison?: string;
  cupidTargets?: string[];
  guardianTarget?: string;
  flautistaTargets?: string[];
  loboBlancoCide?: string;
  perroLoboSide?: 'wolves' | 'village';
  salvajeMentor?: string;
  profetaTarget?: string;
  sacerdoteTarget?: string;
  ladronTarget?: string;
  espiaActivate?: boolean;
  ancianaTarget?: string;
  angelResucitarTarget?: string;
  doctorTarget?: string;
  silenciadoraTarget?: string;
  sirenaTarget?: string;
  virginiawoolTarget?: string;
  vigiaActivate?: boolean;
  bansheePrediction?: string;
  cambiaformasTarget?: string;
  liderCultoTarget?: string;
  pescadorTarget?: string;
  vampiroTarget?: string;
  hadaBuscadoraTarget?: string;
  brujaTarget?: string;
  forenseTarget?: string;
  saboteadorTarget?: string;
}

/**
 * Normalise untrusted Firestore/client action data into the known action
 * contract. This is deliberately conservative: unknown keys are discarded
 * and no game state is mutated here.
 */
export function normalizeNightActions(input: unknown): NightActions {
  if (!input || typeof input !== 'object') return {};

  const source = input as Record<string, unknown>;
  const result: NightActions = {};

  const stringKeys: (keyof NightActions)[] = [
    'wolfTarget', 'wolfTarget2', 'seerTarget', 'seerTarget2', 'witchPoison',
    'guardianTarget', 'loboBlancoCide', 'salvajeMentor', 'profetaTarget',
    'sacerdoteTarget', 'ladronTarget', 'ancianaTarget', 'angelResucitarTarget',
    'doctorTarget', 'silenciadoraTarget', 'sirenaTarget', 'virginiawoolTarget',
    'bansheePrediction', 'cambiaformasTarget', 'liderCultoTarget',
    'pescadorTarget', 'vampiroTarget', 'hadaBuscadoraTarget', 'brujaTarget',
    'forenseTarget', 'saboteadorTarget',
  ];

  for (const key of stringKeys) {
    if (typeof source[key] === 'string' && source[key]) {
      result[key] = source[key] as never;
    }
  }

  const booleanKeys: (keyof NightActions)[] = [
    'witchSave', 'espiaActivate', 'vigiaActivate',
  ];
  for (const key of booleanKeys) {
    if (typeof source[key] === 'boolean') result[key] = source[key] as never;
  }

  const arrayStringKeys: (keyof NightActions)[] = ['cupidTargets', 'flautistaTargets'];
  for (const key of arrayStringKeys) {
    if (Array.isArray(source[key])) {
      const values = (source[key] as unknown[]).filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      );
      if (values.length) result[key] = values as never;
    }
  }

  if (source.perroLoboSide === 'wolves' || source.perroLoboSide === 'village') {
    result.perroLoboSide = source.perroLoboSide;
  }

  return result;
}

/**
 * Marker for the server-side night-resolution boundary.
 */
export function createNightResolutionContext(
  gameId: string,
  roundNumber: number,
): NightResolutionContext {
  return { gameId, roundNumber };
}
