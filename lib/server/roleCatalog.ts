export type RoleTeam = 'village' | 'wolves' | 'solo';

export interface ServerRoleInfo {
  team: RoleTeam;
}

/**
 * Server-only role metadata.
 *
 * The UI role catalog contains presentation text and action labels. Server
 * code must not import that module because it lives under components/.
 * Keep this catalog deliberately small: authoritative code only needs role
 * identity/team membership and validation of configured special roles.
 */
export const ROLES: Record<string, ServerRoleInfo> = {
  'Aldeano': { team: 'village' },
  'Alborotadora': { team: 'village' },
  'Anciana Líder': { team: 'village' },
  'Ángel Resucitador': { team: 'village' },
  'Aprendiz de Vidente': { team: 'village' },
  'Ladrón': { team: 'village' },
  'Doctor': { team: 'village' },
  'Fantasma': { team: 'village' },
  'Gemela': { team: 'village' },
  'Hechicera': { team: 'village' },
  'Leprosa': { team: 'village' },
  'Licántropo': { team: 'village' },
  'Príncipe': { team: 'village' },
  'Silenciadora': { team: 'village' },
  'Sirena del Río': { team: 'village' },
  'Vigía': { team: 'village' },
  'Virginia Woolf': { team: 'village' },
  'Vidente': { team: 'village' },
  'Cazador': { team: 'village' },
  'Cupido': { team: 'village' },
  'Alcalde': { team: 'village' },
  'Guardián': { team: 'village' },
  'Niña': { team: 'village' },
  'Antiguo': { team: 'village' },
  'Profeta': { team: 'village' },
  'Juez': { team: 'village' },
  'Oso': { team: 'village' },
  'Sacerdote': { team: 'village' },
  'Alquimista': { team: 'village' },
  'Espía': { team: 'village' },
  'Chivo Expiatorio': { team: 'village' },
  'Médium': { team: 'village' },
  'Gemelas': { team: 'village' },
  'Hermanos': { team: 'village' },
  'Niño Salvaje': { team: 'village' },
  'Médico Forense': { team: 'village' },
  'Iluminado': { team: 'village' },
  'Saboteador': { team: 'village' },
  'Lobo': { team: 'wolves' },
  'Bruja': { team: 'wolves' },
  'Cría de Lobo': { team: 'wolves' },
  'Hada Buscadora': { team: 'wolves' },
  'Maldito': { team: 'wolves' },
  'Lobo Blanco': { team: 'wolves' },
  'Perro Lobo': { team: 'solo' },
  'Ángel': { team: 'solo' },
  'Pícaro': { team: 'solo' },
  'Flautista': { team: 'solo' },
  'Banshee': { team: 'solo' },
  'Cambiaformas': { team: 'solo' },
  'Hada Durmiente': { team: 'solo' },
  'Hombre Ebrio': { team: 'solo' },
  'Líder del Culto': { team: 'solo' },
  'Pescador': { team: 'solo' },
  'Vampiro': { team: 'solo' },
  'Verdugo': { team: 'solo' },
};

export function assignRoles(
  players: { uid: string; name: string; isAI?: boolean }[],
  wolvesCount: number,
  specialRoles: string[],
): Record<string, string> {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const roles: Record<string, string> = {};

  let idx = 0;
  for (let i = 0; i < Math.min(wolvesCount, shuffled.length); i++) {
    roles[shuffled[idx++].uid] = 'Lobo';
  }

  for (const role of specialRoles) {
    if (idx < shuffled.length && ROLES[role]) {
      roles[shuffled[idx++].uid] = role;
    }
  }

  while (idx < shuffled.length) {
    roles[shuffled[idx++].uid] = 'Aldeano';
  }

  return roles;
}
