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

/**
 * Canonical admission gate for player-submitted night actions.
 * This is intentionally independent from public game.roles. The caller must
 * provide the role read from the private playerRoles/{uid} document.
 */
export function validateCanonicalNightAction(input: NightActionAuthorityInput): NightActionAuthorityResult {
  const errors: string[] = [];

  if (!Number.isInteger(input.roundNumber) || input.roundNumber < 1) {
    errors.push('invalid_round');
    return { valid: false, errors, submissions: [] };
  }

  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    errors.push('invalid_payload');
    return { valid: false, errors, submissions: [] };
  }

  const raw = input.payload as Record<string, unknown>;
  const keys = Object.keys(raw);
  const unknownKeys = keys.filter((key) => !KNOWN_ACTIONS.has(key));
  if (unknownKeys.length) errors.push(...unknownKeys.map((key) => `unknown_action:${key}`));

  const submissions = createNightActionSubmissions(input.actorUid, raw);
  if (!submissions.length && !keys.includes('_skip')) errors.push('empty_submission');

  if (keys.includes('_skip') && keys.length !== 1) errors.push('skip_must_be_exclusive');

  for (const action of submissions) {
    if (SINGLE_VALUE_ACTIONS.has(action.action)) {
      if (typeof action.targetUid !== 'string' || !action.targetUid.length) {
        errors.push(`missing_target:${action.action}`);
      }
      if (action.targetUids !== undefined || action.value !== undefined) {
        errors.push(`invalid_shape:${action.action}`);
      }
    }

    if (MULTI_TARGET_ACTIONS.has(action.action)) {
      if (!Array.isArray(action.targetUids) || action.targetUids.length !== 2) {
        errors.push(`exactly_two_targets:${action.action}`);
      } else if (new Set(action.targetUids).size !== 2) {
        errors.push(`duplicate_targets:${action.action}`);
      }
      if (action.targetUid !== undefined || action.value !== undefined) {
        errors.push(`invalid_shape:${action.action}`);
      }
    }

    if (BOOLEAN_ACTIONS.has(action.action) && action.value !== true) {
      errors.push(`invalid_boolean:${action.action}`);
    }

    if (action.action === 'perroLoboSide' && action.value !== 'wolves' && action.value !== 'village') {
      errors.push('invalid_perro_lobo_side');
    }
  }

  const actionNames = submissions.map((action) => action.action);
  const duplicateNames = actionNames.filter((action, index) => actionNames.indexOf(action) !== index);
  for (const action of new Set(duplicateNames)) errors.push(`duplicate_action:${action}`);

  if (input.actorRole === 'Lobo Blanco' && raw.loboBlancoCide !== undefined && input.roundNumber % 2 !== 0) {
    errors.push('lobo_blanco_cide_only_even_nights');
  }

  const baseValidation = validateNightActionSubmissions(
    input.players,
    input.actorUid,
    input.actorRole,
    submissions,
  );
  if (!baseValidation.valid) errors.push(...baseValidation.errors);

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    submissions,
  };
}
