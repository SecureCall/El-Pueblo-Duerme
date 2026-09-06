import {
  createNightActionSubmissions,
  validateNightActionSubmissions,
  type NightActionSubmission,
  type NightPlayerForValidation,
} from '@/lib/game/nightResolution';

const KNOWN_ACTIONS = new Set([
  'wolfTarget', 'wolfTarget2', 'seerTarget', 'seerTarget2', 'profetaTarget',
  'witchSave', 'witchPoison', 'brujaTarget', 'guardianTarget', 'doctorTarget',
  'salvajeMentor', 'sacerdoteTarget', 'ladronTarget', 'ancianaTarget',
  'angelResucitarTarget', 'silenciadoraTarget', 'sirenaTarget',
  'virginiawoolTarget', 'bansheePrediction', 'cambiaformasTarget',
  'liderCultoTarget', 'pescadorTarget', 'vampiroTarget', 'hadaBuscadoraTarget',
  'forenseTarget', 'saboteadorTarget', 'loboBlancoCide', 'cupidTargets',
  'flautistaTargets', 'vigiaActivate', 'espiaActivate', 'perroLoboSide', '_skip',
]);

const SINGLE_VALUE_ACTIONS = new Set([
  'wolfTarget', 'wolfTarget2', 'seerTarget', 'seerTarget2', 'profetaTarget',
  'witchPoison', 'brujaTarget', 'guardianTarget', 'doctorTarget', 'salvajeMentor',
  'sacerdoteTarget', 'ladronTarget', 'ancianaTarget', 'angelResucitarTarget',
  'silenciadoraTarget', 'sirenaTarget', 'virginiawoolTarget', 'bansheePrediction',
  'cambiaformasTarget', 'liderCultoTarget', 'pescadorTarget', 'vampiroTarget',
  'hadaBuscadoraTarget', 'forenseTarget', 'saboteadorTarget', 'loboBlancoCide',
]);

const MULTI_TARGET_ACTIONS = new Set(['cupidTargets', 'flautistaTargets']);
const BOOLEAN_ACTIONS = new Set(['witchSave', 'vigiaActivate', 'espiaActivate']);

export interface NightActionAuthorityInput {
  players: NightPlayerForValidation[];
  actorUid: string;
  actorRole: string;
  roundNumber: number;
  payload: unknown;
}

export interface NightActionAuthorityResult {
  valid: boolean;
  errors: string[];
  submissions: NightActionSubmission[];
}

function validateSubmissionShape(
  submissions: NightActionSubmission[],
  actorUid: string,
  actorRole: string,
  roundNumber: number,
): string[] {
  const errors: string[] = [];
  const names = submissions.map((action) => action.action);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

  for (const action of submissions) {
    if (SINGLE_VALUE_ACTIONS.has(action.action)) {
      if (typeof action.targetUid !== 'string' || !action.targetUid.length) errors.push(`missing_target:${action.action}`);
      if (action.targetUids !== undefined || action.value !== undefined) errors.push(`invalid_shape:${action.action}`);
    }

    if (MULTI_TARGET_ACTIONS.has(action.action)) {
      if (!Array.isArray(action.targetUids) || action.targetUids.length !== 2) errors.push(`exactly_two_targets:${action.action}`);
      else if (new Set(action.targetUids).size !== 2) errors.push(`duplicate_targets:${action.action}`);
      if (action.targetUid !== undefined || action.value !== undefined) errors.push(`invalid_shape:${action.action}`);
    }

    if (BOOLEAN_ACTIONS.has(action.action) && action.value !== true) errors.push(`invalid_boolean:${action.action}`);
    if (action.action === 'perroLoboSide' && action.value !== 'wolves' && action.value !== 'village') {
      errors.push('invalid_perro_lobo_side');
    }
  }

  for (const action of new Set(duplicates)) errors.push(`duplicate_action:${action}`);
  if (names.includes('_skip') && names.length !== 1) errors.push('skip_must_be_exclusive');
  if (actorRole === 'Lobo Blanco' && names.includes('loboBlancoCide') && roundNumber % 2 !== 0) {
    errors.push('lobo_blanco_cide_only_even_nights');
  }
  if (submissions.some((action) => action.actorUid !== actorUid)) errors.push('actor_mismatch');
  return errors;
}

/**
 * Canonical admission gate for player-submitted night actions.
 * The role must come from private playerRoles/{uid}; public game.roles is never
 * consulted for authorization.
 */
export function validateCanonicalNightAction(input: NightActionAuthorityInput): NightActionAuthorityResult {
  const errors: string[] = [];
  if (!Number.isInteger(input.roundNumber) || input.roundNumber < 1) errors.push('invalid_round');
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) errors.push('invalid_payload');
  if (errors.length) return { valid: false, errors, submissions: [] };

  const raw = input.payload as Record<string, unknown>;
  const keys = Object.keys(raw);
  for (const key of keys.filter((key) => !KNOWN_ACTIONS.has(key))) errors.push(`unknown_action:${key}`);

  const submissions = createNightActionSubmissions(input.actorUid, raw);
  if (!submissions.length && !keys.includes('_skip')) errors.push('empty_submission');
  errors.push(...validateSubmissionShape(submissions, input.actorUid, input.actorRole, input.roundNumber));

  const base = validateNightActionSubmissions(input.players, input.actorUid, input.actorRole, submissions);
  if (!base.valid) errors.push(...base.errors);

  return { valid: errors.length === 0, errors: [...new Set(errors)], submissions };
}

/**
 * Canonical validation for actions already persisted by the server. This keeps
 * the resolver from falling back to the legacy validator for shape/cardinality.
 */
export function validateCanonicalNightSubmissions(
  players: NightPlayerForValidation[],
  actorUid: string,
  actorRole: string,
  roundNumber: number,
  submissions: NightActionSubmission[],
): { valid: boolean; errors: string[] } {
  if (!Number.isInteger(roundNumber) || roundNumber < 1) return { valid: false, errors: ['invalid_round'] };
  const errors = validateSubmissionShape(submissions, actorUid, actorRole, roundNumber);
  const base = validateNightActionSubmissions(players, actorUid, actorRole, submissions);
  if (!base.valid) errors.push(...base.errors);
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
