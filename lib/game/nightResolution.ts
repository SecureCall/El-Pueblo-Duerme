export type NightActionValue = string | string[] | boolean | number | null;

export interface NightActionSubmission {
  actorUid: string;
  action: string;
  targetUid?: string;
  targetUids?: string[];
  value?: NightActionValue;
}

const TARGET_ACTIONS = new Set([
  'wolfTarget', 'wolfTarget2', 'seerTarget', 'seerTarget2', 'profetaTarget',
  'witchPoison', 'brujaTarget', 'guardianTarget', 'doctorTarget',
  'salvajeMentor', 'sacerdoteTarget', 'ladronTarget', 'ancianaTarget',
  'angelResucitarTarget', 'silenciadoraTarget', 'sirenaTarget',
  'virginiawoolTarget', 'bansheePrediction', 'cambiaformasTarget',
  'liderCultoTarget', 'pescadorTarget', 'vampiroTarget', 'hadaBuscadoraTarget',
  'forenseTarget', 'saboteadorTarget',
]);

const MULTI_TARGET_ACTIONS = new Set(['cupidTargets', 'flautistaTargets']);

const BOOLEAN_ACTIONS = new Set([
  'witchSave', 'vigiaActivate', 'espiaActivate', '_skip',
]);

const ALLOWED_ACTIONS = new Set([
  ...TARGET_ACTIONS,
  ...MULTI_TARGET_ACTIONS,
  ...BOOLEAN_ACTIONS,
  'loboBlancoCide', 'perroLoboSide', 'salvajeMentor',
]);

export function normalizeNightActions(input: unknown): Record<string, NightActionValue> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const output: Record<string, NightActionValue> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!ALLOWED_ACTIONS.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' || value === null) {
      output[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      const strings = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
      if (strings.length > 0) output[key] = strings;
    }
  }
  return output;
}

export function createNightActionSubmission(
  actorUid: string,
  action: string,
  value?: NightActionValue,
): NightActionSubmission {
  const submission: NightActionSubmission = { actorUid, action };
  if (typeof value === 'string') {
    if (TARGET_ACTIONS.has(action)) submission.targetUid = value;
    else submission.value = value;
  } else if (Array.isArray(value)) {
    submission.targetUids = value.filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);
  } else if (value !== undefined) {
    submission.value = value;
  }
  return submission;
}

export function createNightActionSubmissions(
  actorUid: string,
  actions: unknown,
): NightActionSubmission[] {
  const normalized = normalizeNightActions(actions);
  const submissions: NightActionSubmission[] = [];
  for (const [action, value] of Object.entries(normalized)) {
    if (action === '_skip' || MULTI_TARGET_ACTIONS.has(action) || TARGET_ACTIONS.has(action) || BOOLEAN_ACTIONS.has(action) || typeof value === 'string' || typeof value === 'boolean') {
      submissions.push(createNightActionSubmission(actorUid, action, value));
    }
  }
  return submissions;
}

export interface NightPlayerForValidation {
  uid: string;
  isAlive: boolean;
}

export function validateNightActionSubmissions(
  players: NightPlayerForValidation[],
  actorUid: string,
  actorRole: string,
  submissions: NightActionSubmission[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const playerMap = new Map(players.map(player => [player.uid, player]));
  const actor = playerMap.get(actorUid);

  if (!actor) errors.push(`unknown_actor:${actorUid}`);
  else if (!actor.isAlive) errors.push(`dead_actor:${actorUid}`);

  const allowed = ROLE_ACTIONS[actorRole];
  for (const submission of submissions) {
    if (submission.actorUid !== actorUid) {
      errors.push(`actor_mismatch:${submission.actorUid}`);
      continue;
    }
    if (submission.action !== '_skip' && (!allowed || !allowed.has(submission.action))) {
      errors.push(`role_not_allowed:${actorUid}:${submission.action}`);
    }
    if (submission.targetUid) {
      const target = playerMap.get(submission.targetUid);
      if (!target || !target.isAlive) errors.push(`invalid_target:${submission.targetUid}`);
    }
    if (submission.targetUids) {
      for (const targetUid of submission.targetUids) {
        const target = playerMap.get(targetUid);
        if (!target || !target.isAlive) errors.push(`invalid_target:${targetUid}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

const ROLE_ACTIONS: Record<string, Set<string>> = {
  Lobo: new Set(['wolfTarget', 'wolfTarget2']),
  'Lobo Blanco': new Set(['wolfTarget', 'wolfTarget2', 'loboBlancoCide']),
  'Cría de Lobo': new Set(['wolfTarget', 'wolfTarget2']),
  Vidente: new Set(['seerTarget', 'seerTarget2']),
  Hechicera: new Set(['witchSave', 'witchPoison']),
  Bruja: new Set(['brujaTarget']),
  Cupido: new Set(['cupidTargets']),
  Guardián: new Set(['guardianTarget']),
  Doctor: new Set(['doctorTarget']),
  Flautista: new Set(['flautistaTargets']),
  'Perro Lobo': new Set(['perroLoboSide']),
  'Niño Salvaje': new Set(['salvajeMentor']),
  Profeta: new Set(['profetaTarget']),
  Sacerdote: new Set(['sacerdoteTarget']),
  Ladrón: new Set(['ladronTarget']),
  'Anciana Líder': new Set(['ancianaTarget']),
  'Ángel Resucitador': new Set(['angelResucitarTarget']),
  Silenciadora: new Set(['silenciadoraTarget']),
  'Sirena del Río': new Set(['sirenaTarget']),
  'Virginia Woolf': new Set(['virginiawoolTarget']),
  Vigía: new Set(['vigiaActivate']),
  Banshee: new Set(['bansheePrediction']),
  Cambiaformas: new Set(['cambiaformasTarget']),
  'Líder del Culto': new Set(['liderCultoTarget']),
  Pescador: new Set(['pescadorTarget']),
  Vampiro: new Set(['vampiroTarget']),
  'Hada Buscadora': new Set(['hadaBuscadoraTarget']),
  'Médico Forense': new Set(['forenseTarget']),
  Saboteador: new Set(['saboteadorTarget']),
  Espía: new Set(['espiaActivate']),
};
