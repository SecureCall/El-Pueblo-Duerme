// DEFINICIÓN DE ROLES - lo más básico para empezar
export const ROLES = {
  ALDEANO: { id: 'aldeano', name: 'Aldeano', team: 'aldeanos' },
  LOBO: { id: 'lobo', name: 'Hombre Lobo', team: 'lobos' },
  VIDENTE: { id: 'vidente', name: 'Vidente', team: 'aldeanos' }
} as const;

export type Role = keyof typeof ROLES;
export type Team = 'aldeanos' | 'lobos';

export interface RoleInfo {
    id: Role;
    name: string;
    team: Team;
}
