import { ROLES } from '@/components/game/play/roles';

export type RoleAuthorityRule = {
  phase: 'night';
  maxTargets: number;
  allowSelfTarget: boolean;
  firstNightOnly?: boolean;
  everyNRounds?: number;
};

const rules: Record<string, RoleAuthorityRule> = {
  'Doctor': { phase: 'night', maxTargets: 1, allowSelfTarget: true },
  'Guardián': { phase: 'night', maxTargets: 1, allowSelfTarget: true },
  'Vidente': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Profeta': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Silenciadora': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Sacerdote': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Lobo': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Cría de Lobo': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Lobo Blanco': { phase: 'night', maxTargets: 1, allowSelfTarget: false, everyNRounds: 2 },
  'Cupido': { phase: 'night', maxTargets: 2, allowSelfTarget: false, firstNightOnly: true },
  'Niño Salvaje': { phase: 'night', maxTargets: 1, allowSelfTarget: false, firstNightOnly: true },
  'Perro Lobo': { phase: 'night', maxTargets: 1, allowSelfTarget: false, firstNightOnly: true },
  'Ladrón': { phase: 'night', maxTargets: 1, allowSelfTarget: false, firstNightOnly: true },
  'Virginia Woolf': { phase: 'night', maxTargets: 1, allowSelfTarget: false, firstNightOnly: true },
  'Banshee': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Cambiaformas': { phase: 'night', maxTargets: 1, allowSelfTarget: false, firstNightOnly: true },
  'Líder del Culto': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Pescador': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Vampiro': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Hada Buscadora': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Médico Forense': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Saboteador': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Anciana Líder': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Ángel Resucitador': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
  'Sirena del Río': { phase: 'night', maxTargets: 1, allowSelfTarget: false, firstNightOnly: true },
  'Vigía': { phase: 'night', maxTargets: 1, allowSelfTarget: false },
};

export function getRoleAuthorityRule(role: string): RoleAuthorityRule | null {
  if (!ROLES[role]?.nightAction) return null;
  return rules[role] ?? { phase: 'night', maxTargets: 1, allowSelfTarget: false };
}

export function canUseRoleAtRound(role: string, round: number): boolean {
  const rule = getRoleAuthorityRule(role);
  if (!rule || round < 1) return false;
  if (rule.firstNightOnly && round !== 1) return false;
  if (rule.everyNRounds && round % rule.everyNRounds !== 0) return false;
  return true;
}
