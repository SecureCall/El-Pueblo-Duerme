import { ROLES } from '@/components/game/play/roles';

export const CASUAL_ROLES = new Set([
  'Vidente', 'Doctor', 'Hechicera', 'Cazador', 'Cupido', 'Guardián', 'Príncipe', 'Sheriff',
]);

export function validateCreateGameRoles(roles: string[], mode: 'casual' | 'normal' | 'chaos') {
  const unique = new Set(roles);
  if (unique.size !== roles.length) return 'No se permiten roles duplicados';

  const invalid = roles.filter(role => !ROLES[role] && !CASUAL_ROLES.has(role));
  if (invalid.length) return `Roles no válidos: ${invalid.join(', ')}`;

  if (mode === 'casual' && roles.some(role => !CASUAL_ROLES.has(role))) {
    return 'El modo Casual contiene roles no permitidos';
  }

  return null;
}

export function calculateWolfCount(maxPlayers: number) {
  return Math.max(1, Math.floor(maxPlayers / 5));
}
