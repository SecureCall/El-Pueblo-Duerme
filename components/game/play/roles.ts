export interface RoleInfo {
  name: string;
  team: 'village' | 'wolves' | 'solo';
  emoji: string;
  description: string;
  nightAction: boolean;
  actionLabel?: string;
}

export const ROLES: Record<string, RoleInfo> = {
  'Aldeano': {
    name: 'Aldeano',
    team: 'village',
    emoji: '🧑‍🌾',
    description: 'Eres un aldeano inocente. Usa tu intuición para descubrir a los lobos durante el día y votar para eliminarlos.',
    nightAction: false,
  },
  'Lobo': {
    name: 'Lobo',
    team: 'wolves',
    emoji: '🐺',
    description: 'Eres un lobo. Cada noche, tú y tu manada elegiréis a una víctima. Durante el día, finged ser aldeanos.',
    nightAction: true,
    actionLabel: 'Elegir víctima',
  },
  'Vidente': {
    name: 'Vidente',
    team: 'village',
    emoji: '🔮',
    description: 'Cada noche puedes revelar la verdadera naturaleza de un jugador. Usa este poder sabiamente.',
    nightAction: true,
    actionLabel: 'Investigar jugador',
  },
  'Bruja': {
    name: 'Bruja',
    team: 'village',
    emoji: '🧪',
    description: 'Tienes una poción de vida y una de muerte. Una vez por partida puedes salvar a la víctima de los lobos o eliminar a un jugador.',
    nightAction: true,
    actionLabel: 'Usar pociones',
  },
  'Cazador': {
    name: 'Cazador',
    team: 'village',
    emoji: '🏹',
    description: 'Al morir, puedes disparar tu última bala y eliminar a otro jugador contigo.',
    nightAction: false,
    actionLabel: 'Disparar última bala',
  },
  'Cupido': {
    name: 'Cupido',
    team: 'village',
    emoji: '💘',
    description: 'La primera noche unes a dos jugadores con tu flecha. Si uno muere, el otro muere de amor.',
    nightAction: true,
    actionLabel: 'Elegir enamorados',
  },
  'Alcalde': {
    name: 'Alcalde',
    team: 'village',
    emoji: '🎖️',
    description: 'Tu voto vale doble durante las votaciones del día. Los aldeanos confían en tu liderazgo.',
    nightAction: false,
  },
};

export function assignRoles(
  players: { uid: string; name: string; isAI?: boolean }[],
  wolvesCount: number,
  specialRoles: string[]
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

export function checkWinCondition(
  players: { uid: string; isAlive: boolean }[],
  roles: Record<string, string>
): 'wolves' | 'village' | null {
  const alive = players.filter(p => p.isAlive);
  const aliveWolves = alive.filter(p => roles[p.uid] === 'Lobo').length;
  const aliveVillagers = alive.filter(p => roles[p.uid] !== 'Lobo').length;
  if (aliveWolves === 0) return 'village';
  if (aliveWolves >= aliveVillagers) return 'wolves';
  return null;
}
