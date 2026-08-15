export const ALLOWED_NIGHT_ACTION_KEYS = new Set([
  'wolfTarget', 'wolfTarget2', 'seerTarget', 'seerTarget2',
  'witchSave', 'witchPoison', 'cupidTargets', 'guardianTarget',
  'flautistaTargets', 'loboBlancoCide', 'perroLoboSide', 'salvajeMentor',
  'profetaTarget', 'sacerdoteTarget', 'ladronTarget', 'espiaActivate',
  'ancianaTarget', 'angelResucitarTarget', 'doctorTarget', 'silenciadoraTarget',
  'sirenaTarget', 'virginiawoolTarget', 'vigiaActivate', 'bansheePrediction',
  'cambiaformasTarget', 'liderCultoTarget', 'pescadorTarget', 'vampiroTarget',
  'hadaBuscadoraTarget', 'brujaTarget', 'forenseTarget', 'saboteadorTarget',
]);

export function isSafeNightActionValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length <= 8 && value.every(item => typeof item === 'string' && item.length <= 128);
  }
  return false;
}

export function validateNightActionPayload(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).every(key => ALLOWED_NIGHT_ACTION_KEYS.has(key))
    && Object.values(payload).every(isSafeNightActionValue);
}

export function resolveAuthoritativeRole(
  privateRole: unknown,
  gameRoles: unknown,
  uid: string,
): string | null {
  if (privateRole && typeof privateRole === 'object' && 'role' in privateRole) {
    const role = (privateRole as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  }
  if (gameRoles && typeof gameRoles === 'object') {
    const role = (gameRoles as Record<string, unknown>)[uid];
    return typeof role === 'string' ? role : null;
  }
  return null;
}
