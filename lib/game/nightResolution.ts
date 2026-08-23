/**
 * Pure night-resolution boundary.
 *
 * No Firebase imports or writes are allowed in this module.
 */

export interface NightResolutionContext {
  gameId: string;
  roundNumber: number;
}

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

export interface NightPlayerState {
  uid: string;
  role?: string | null;
  isAlive: boolean;
}

export interface NightValidationState {
  players: NightPlayerState[];
  wolfTeam?: Record<string, boolean>;
}

export interface NightActionValidation {
  valid: boolean;
  actions: NightActions;
  errors: string[];
}

/** A single client proposal, with its claimed actor made explicit. */
export interface NightActionSubmission {
  actorUid: string;
  action: keyof NightActions;
  targetUid?: string;
  targetUids?: string[];
  value?: boolean | 'wolves' | 'village';
}

export interface NightActorValidation {
  valid: boolean;
  submissions: NightActionSubmission[];
  errors: string[];
}

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

const SINGLE_ROLE_ACTIONS: Partial<Record<keyof NightActions, string>> = {
  seerTarget: 'Vidente',
  seerTarget2: 'Vidente',
  guardianTarget: 'Guardián',
  profetaTarget: 'Profeta',
  doctorTarget: 'Doctor',
  silenciadoraTarget: 'Silenciadora',
  sirenaTarget: 'Sirena',
  virginiawoolTarget: 'Virginia Woolf',
  angelResucitarTarget: 'Ángel Resucitador',
  liderCultoTarget: 'Líder de Culto',
  pescadorTarget: 'Pescador',
  vampiroTarget: 'Vampiro',
  hadaBuscadoraTarget: 'Hada Buscadora',
  brujaTarget: 'Bruja',
  forenseTarget: 'Forense',
  saboteadorTarget: 'Saboteador',
  ancianaTarget: 'Anciana',
  cambiaformasTarget: 'Cambiaformas',
  salvajeMentor: 'Salvaje',
  sacerdoteTarget: 'Sacerdote',
  ladronTarget: 'Ladrón',
};

const ACTOR_ROLES: Partial<Record<keyof NightActions, string[]>> = {
  ...Object.fromEntries(
    Object.entries(SINGLE_ROLE_ACTIONS).map(([key, role]) => [key, [role as string]]),
  ) as Partial<Record<keyof NightActions, string[]>>,
  witchSave: ['Bruja'],
  witchPoison: ['Bruja'],
  cupidTargets: ['Cupido'],
  flautistaTargets: ['Flautista'],
  loboBlancoCide: ['Lobo Blanco'],
  perroLoboSide: ['Perro Lobo'],
  espiaActivate: ['Espía'],
  vigiaActivate: ['Vigía'],
  bansheePrediction: ['Banshee'],
  wolfTarget: ['Lobo', 'Lobo Alfa', 'Lobo Blanco', 'Cachorro de Lobo', 'Perro Lobo'],
  wolfTarget2: ['Lobo', 'Lobo Alfa', 'Lobo Blanco', 'Cachorro de Lobo', 'Perro Lobo'],
};

function alivePlayer(players: NightPlayerState[], uid: string): boolean {
  return players.some((player) => player.uid === uid && player.isAlive);
}

function hasRole(players: NightPlayerState[], role: string): boolean {
  return players.some((player) => player.isAlive && player.role === role);
}

/**
 * Validates normalized actions against the current public player state.
 * This does not resolve outcomes and deliberately does not perform I/O.
 */
export function validateNightActions(
  input: unknown,
  state: NightValidationState,
): NightActionValidation {
  const actions = normalizeNightActions(input);
  const errors: string[] = [];

  const targets = Object.entries(actions).flatMap(([key, value]) => {
    if (typeof value === 'string' && key !== 'perroLoboSide') return [[key, value] as const];
    if (Array.isArray(value)) return value.map((uid) => [key, uid] as const);
    return [];
  });

  for (const [key, uid] of targets) {
    if (!alivePlayer(state.players, uid)) {
      errors.push(`${key}: target is not an alive player`);
    }
  }

  for (const [key, role] of Object.entries(SINGLE_ROLE_ACTIONS)) {
    if (actions[key as keyof NightActions] !== undefined && !hasRole(state.players, role)) {
      errors.push(`${key}: acting role is not available`);
    }
  }

  if (actions.wolfTarget !== undefined && !Object.values(state.wolfTeam ?? {}).some(Boolean)) {
    errors.push('wolfTarget: no wolf team is available');
  }

  if (actions.cupidTargets && actions.cupidTargets.length !== 2) {
    errors.push('cupidTargets: exactly two targets are required');
  }

  if (actions.flautistaTargets && actions.flautistaTargets.length > 2) {
    errors.push('flautistaTargets: at most two targets are allowed');
  }

  return { valid: errors.length === 0, actions, errors };
}

/**
 * Validates the actor of every submitted action. This is the security boundary
 * used when moving action resolution off the host. A client cannot claim an
 * action for another role or for a dead player.
 */
export function validateNightActionActors(
  submissions: NightActionSubmission[],
  state: NightValidationState,
): NightActorValidation {
  const errors: string[] = [];

  for (const submission of submissions) {
    if (!submission.actorUid) {
      errors.push('action: missing actorUid');
      continue;
    }

    const actor = state.players.find((player) => player.uid === submission.actorUid);
    if (!actor) {
      errors.push(`${submission.action}: actor is not a player`);
      continue;
    }

    if (!actor.isAlive) {
      errors.push(`${submission.action}: actor is dead`);
      continue;
    }

    const allowedRoles = ACTOR_ROLES[submission.action];
    if (!allowedRoles || allowedRoles.length === 0) {
      errors.push(`${String(submission.action)}: action has no server role mapping`);
      continue;
    }

    if (!allowedRoles.includes(actor.role ?? '')) {
      errors.push(`${String(submission.action)}: actor role is not allowed`);
    }

    if (submission.targetUid && !alivePlayer(state.players, submission.targetUid)) {
      errors.push(`${String(submission.action)}: target is not alive`);
    }

    if (submission.targetUids) {
      for (const targetUid of submission.targetUids) {
        if (!alivePlayer(state.players, targetUid)) {
          errors.push(`${String(submission.action)}: target is not alive`);
        }
      }
    }
  }

  return { valid: errors.length === 0, submissions, errors };
}

export function createNightResolutionContext(
  gameId: string,
  roundNumber: number,
): NightResolutionContext {
  return { gameId, roundNumber };
}
