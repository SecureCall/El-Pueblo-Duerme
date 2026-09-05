import type { NightActionSubmission } from '@/lib/game/nightResolution';

export type NightTargetPolicy = 'alive' | 'dead' | 'none';

export interface NightAuthorityState {
  phase: string;
  round: number;
  eclipseActive: boolean;
  doubleSeerActive: boolean;
  criaLoboRage: boolean;
  history: Record<string, unknown>;
}

export interface NightAuthorityPlayer {
  uid: string;
  isAlive: boolean;
}

export interface NightActionSpec {
  role: string;
  action: string;
  targetPolicy: NightTargetPolicy;
  minTargets: number;
  maxTargets: number;
  allowSelfTarget: boolean;
  firstNightOnly?: boolean;
  evenNightOnly?: boolean;
  booleanValue?: boolean;
  enumValues?: readonly string[];
  enabled?: (state: NightAuthorityState) => boolean;
}

export type NightActionValidationCode =
  | 'INVALID_PHASE'
  | 'INVALID_ROUND'
  | 'ACTOR_DEAD'
  | 'ACTION_NOT_ALLOWED'
  | 'ROUND_RESTRICTED'
  | 'ACTION_UNAVAILABLE'
  | 'INVALID_VALUE'
  | 'INVALID_ENUM'
  | 'WRONG_TARGET_COUNT'
  | 'DUPLICATE_TARGET'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_DEAD'
  | 'TARGET_ALIVE'
  | 'SELF_TARGET'
  | 'ALREADY_USED'
  | 'CONFLICTING_ACTIONS';

export interface NightActionValidationResult {
  valid: boolean;
  errors: NightActionValidationCode[];
}

function makeSpec(
  role: string,
  action: string,
  targetPolicy: NightTargetPolicy,
  minTargets: number,
  maxTargets: number,
  options: Partial<Omit<NightActionSpec, 'role' | 'action' | 'targetPolicy' | 'minTargets' | 'maxTargets'>> = {},
): NightActionSpec {
  return { role, action, targetPolicy, minTargets, maxTargets, allowSelfTarget: false, ...options };
}

export const NIGHT_ACTION_SPECS: readonly NightActionSpec[] = [
  makeSpec('Lobo', 'wolfTarget', 'alive', 1, 1),
  makeSpec('Lobo', 'wolfTarget2', 'alive', 0, 1, { enabled: s => s.criaLoboRage || s.eclipseActive }),
  makeSpec('Cría de Lobo', 'wolfTarget', 'alive', 1, 1),
  makeSpec('Cría de Lobo', 'wolfTarget2', 'alive', 0, 1, { enabled: s => s.criaLoboRage || s.eclipseActive }),
  makeSpec('Lobo Blanco', 'wolfTarget', 'alive', 1, 1),
  makeSpec('Lobo Blanco', 'loboBlancoCide', 'alive', 0, 1, { evenNightOnly: true }),
  makeSpec('Vidente', 'seerTarget', 'alive', 1, 1),
  makeSpec('Vidente', 'seerTarget2', 'alive', 0, 1, { enabled: s => s.doubleSeerActive }),
  makeSpec('Hechicera', 'witchSave', 'none', 0, 0, { booleanValue: true }),
  makeSpec('Hechicera', 'witchPoison', 'alive', 0, 1),
  makeSpec('Bruja', 'brujaTarget', 'alive', 1, 1),
  makeSpec('Cupido', 'cupidTargets', 'alive', 2, 2, { firstNightOnly: true }),
  makeSpec('Guardián', 'guardianTarget', 'alive', 1, 1, { allowSelfTarget: true }),
  makeSpec('Doctor', 'doctorTarget', 'alive', 1, 1, { allowSelfTarget: true }),
  makeSpec('Flautista', 'flautistaTargets', 'alive', 2, 2),
  makeSpec('Perro Lobo', 'perroLoboSide', 'none', 1, 1, { firstNightOnly: true, enumValues: ['wolves', 'village'] }),
  makeSpec('Niño Salvaje', 'salvajeMentor', 'alive', 1, 1, { firstNightOnly: true }),
  makeSpec('Profeta', 'profetaTarget', 'alive', 1, 1),
  makeSpec('Sacerdote', 'sacerdoteTarget', 'alive', 1, 1),
  makeSpec('Ladrón', 'ladronTarget', 'alive', 1, 1, { firstNightOnly: true }),
  makeSpec('Espía', 'espiaActivate', 'none', 0, 0, { booleanValue: true }),
  makeSpec('Anciana Líder', 'ancianaTarget', 'alive', 1, 1),
  makeSpec('Ángel Resucitador', 'angelResucitarTarget', 'dead', 1, 1),
  makeSpec('Silenciadora', 'silenciadoraTarget', 'alive', 1, 1),
  makeSpec('Sirena del Río', 'sirenaTarget', 'alive', 1, 1, { firstNightOnly: true }),
  makeSpec('Virginia Woolf', 'virginiawoolTarget', 'alive', 1, 1, { firstNightOnly: true }),
  makeSpec('Vigía', 'vigiaActivate', 'none', 0, 0, { booleanValue: true }),
  makeSpec('Banshee', 'bansheePrediction', 'alive', 1, 1),
  makeSpec('Cambiaformas', 'cambiaformasTarget', 'alive', 1, 1, { firstNightOnly: true }),
  makeSpec('Líder del Culto', 'liderCultoTarget', 'alive', 1, 1),
  makeSpec('Pescador', 'pescadorTarget', 'alive', 1, 1),
  makeSpec('Vampiro', 'vampiroTarget', 'alive', 1, 1),
  makeSpec('Hada Buscadora', 'hadaBuscadoraTarget', 'alive', 1, 1, { enabled: s => s.history.hadaLinked !== true }),
  makeSpec('Médico Forense', 'forenseTarget', 'dead', 1, 1),
  makeSpec('Saboteador', 'saboteadorTarget', 'alive', 1, 1),
];

const SPEC_BY_KEY = new Map(NIGHT_ACTION_SPECS.map(spec => [`${spec.role}\0${spec.action}`, spec]));

export function getNightActionSpec(role: string, action: string): NightActionSpec | null {
  return SPEC_BY_KEY.get(`${role}\0${action}`) ?? null;
}

function targetsFor(action: NightActionSubmission): string[] {
  if (Array.isArray(action.targetUids)) return action.targetUids;
  if (typeof action.targetUid === 'string') return [action.targetUid];
  return [];
}

export function validateNightActionSpec(
  state: NightAuthorityState,
  players: readonly NightAuthorityPlayer[],
  actorUid: string,
  role: string,
  action: NightActionSubmission,
): NightActionValidationResult {
  const errors: NightActionValidationCode[] = [];
  if (state.phase !== 'night') errors.push('INVALID_PHASE');
  if (!Number.isInteger(state.round) || state.round < 1) errors.push('INVALID_ROUND');

  const actor = players.find(player => player.uid === actorUid);
  if (!actor || !actor.isAlive) errors.push('ACTOR_DEAD');

  const actionSpec = getNightActionSpec(role, action.action);
  if (!actionSpec) {
    errors.push('ACTION_NOT_ALLOWED');
    return { valid: false, errors: [...new Set(errors)] };
  }

  if (actionSpec.firstNightOnly && state.round !== 1) errors.push('ROUND_RESTRICTED');
  if (actionSpec.evenNightOnly && state.round % 2 !== 0) errors.push('ROUND_RESTRICTED');
  if (actionSpec.enabled && !actionSpec.enabled(state)) errors.push('ACTION_UNAVAILABLE');

  if (actionSpec.booleanValue !== undefined) {
    if (action.value !== actionSpec.booleanValue) errors.push('INVALID_VALUE');
  } else if (actionSpec.enumValues) {
    if (actionSpec.enumValues.length === 0 || !actionSpec.enumValues.includes(String(action.value))) {
      errors.push('INVALID_ENUM');
    }
  } else if (actionSpec.targetPolicy !== 'none') {
    const targets = targetsFor(action);
    if (targets.length < actionSpec.minTargets || targets.length > actionSpec.maxTargets) {
      errors.push('WRONG_TARGET_COUNT');
    }
    if (new Set(targets).size !== targets.length) errors.push('DUPLICATE_TARGET');

    const playerByUid = new Map(players.map(player => [player.uid, player]));
    for (const targetUid of targets) {
      const target = playerByUid.get(targetUid);
      if (!target) {
        errors.push('TARGET_NOT_FOUND');
        continue;
      }
      if (actionSpec.targetPolicy === 'alive' && !target.isAlive) errors.push('TARGET_DEAD');
      if (actionSpec.targetPolicy === 'dead' && target.isAlive) errors.push('TARGET_ALIVE');
      if (!actionSpec.allowSelfTarget && targetUid === actorUid) errors.push('SELF_TARGET');
    }
  } else if (action.targetUid || action.targetUids?.length) {
    errors.push('INVALID_VALUE');
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateNightSubmission(
  state: NightAuthorityState,
  players: readonly NightAuthorityPlayer[],
  actorUid: string,
  role: string,
  actions: readonly NightActionSubmission[],
): NightActionValidationResult {
  const errors: NightActionValidationCode[] = [];
  const seen = new Set<string>();
  const hasSkip = actions.some(action => action.action === '_skip');

  if (actions.length === 0) errors.push('INVALID_VALUE');
  if (hasSkip && actions.length > 1) errors.push('CONFLICTING_ACTIONS');

  for (const action of actions) {
    if (seen.has(action.action)) errors.push('CONFLICTING_ACTIONS');
    seen.add(action.action);
    const result = validateNightActionSpec(state, players, actorUid, role, action);
    errors.push(...result.errors);
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function getNightActionSpecsForRole(role: string): readonly NightActionSpec[] {
  return NIGHT_ACTION_SPECS.filter(spec => spec.role === role);
}
