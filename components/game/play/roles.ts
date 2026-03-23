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
    description: 'Eres un lobo. Cada noche, tú y tu manada elegiréis a una víctima. Durante el día, fingid ser aldeanos.',
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

  // ── Roles adicionales ─────────────────────────────────────────────────────

  'Guardián': {
    name: 'Guardián de Aldea',
    team: 'village',
    emoji: '🛡️',
    description: 'Cada noche puedes proteger a un jugador del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas.',
    nightAction: true,
    actionLabel: 'Proteger jugador',
  },
  'Niña': {
    name: 'Niña',
    team: 'village',
    emoji: '👧',
    description: 'Puedes espiar a los lobos mientras deliberan de noche. Conoces su identidad, pero eres frágil: si los lobos sospechan de ti, te atacarán primero.',
    nightAction: false,
  },
  'Antiguo': {
    name: 'El Antiguo',
    team: 'village',
    emoji: '🧙',
    description: 'Tienes dos vidas: la primera vez que los lobos te ataquen, sobrevives. Si el pueblo te vota para eliminar, todos los aldeanos pierden sus poderes especiales.',
    nightAction: false,
  },
  'Ángel': {
    name: 'Ángel',
    team: 'solo',
    emoji: '😇',
    description: '¡Quieres ser eliminado! Si el pueblo te vota en la primera ronda, ¡ganas tú solo! Si sobrevives a la primera votación, debes unirte al bando del pueblo.',
    nightAction: false,
  },
  'Pícaro': {
    name: 'Pícaro',
    team: 'solo',
    emoji: '🃏',
    description: 'Ganas si eres el único no-lobo vivo junto a los lobos. Debes conseguir que todos los aldeanos sean eliminados sin que los lobos ganen antes.',
    nightAction: false,
  },
  'Flautista': {
    name: 'Flautista',
    team: 'solo',
    emoji: '🪈',
    description: 'Cada noche encanta a dos jugadores con tu melodía mágica. ¡Ganas si todos los jugadores vivos están hechizados!',
    nightAction: true,
    actionLabel: 'Encantar jugadores',
  },
  'Perro Lobo': {
    name: 'Perro Lobo',
    team: 'solo',
    emoji: '🐕',
    description: 'La primera noche debes elegir bando: aldeano o lobo. Si eliges ser lobo, te unes a la manada. Si eliges aldeano, juegas con el pueblo.',
    nightAction: true,
    actionLabel: 'Elegir bando',
  },
  'Lobo Blanco': {
    name: 'Lobo Blanco',
    team: 'wolves',
    emoji: '🤍',
    description: 'Eres parte de la manada, pero tu objetivo es sobrevivir solo. Cada dos noches puedes eliminar a uno de tus compañeros lobos.',
    nightAction: true,
    actionLabel: 'Eliminar lobo aliado',
  },
  'Niño Salvaje': {
    name: 'Niño Salvaje',
    team: 'village',
    emoji: '🌿',
    description: 'La primera noche elige un modelo a seguir. Si esa persona muere durante la partida, ¡te conviertes en lobo!',
    nightAction: true,
    actionLabel: 'Elegir modelo',
  },
  'Gemelas': {
    name: 'Gemelas',
    team: 'village',
    emoji: '👯',
    description: 'Sois dos hermanas que se conocen entre sí. Trabajad juntas para salvar al pueblo. Si una fuera lobo, ambas serían lobas.',
    nightAction: false,
  },
  'Hermanos': {
    name: 'Hermanos',
    team: 'village',
    emoji: '👬',
    description: 'Sois tres hermanos que se conocen. Coordinad vuestra estrategia en secreto para proteger al pueblo.',
    nightAction: false,
  },
  'Médium': {
    name: 'Médium',
    team: 'village',
    emoji: '👻',
    description: 'Tienes el don de comunicarte con los muertos. Puedes leer los mensajes de los jugadores eliminados en el chat de fantasmas.',
    nightAction: false,
  },
  'Profeta': {
    name: 'Profeta',
    team: 'village',
    emoji: '📜',
    description: 'Como la Vidente, puedes investigar a un jugador cada noche. Sin embargo, debes revelar en voz alta al pueblo lo que has visto.',
    nightAction: true,
    actionLabel: 'Profetizar',
  },
  'Juez': {
    name: 'Juez',
    team: 'village',
    emoji: '⚖️',
    description: 'Una vez por partida puedes exigir una segunda votación antes de que se ejecute la sentencia del pueblo.',
    nightAction: false,
  },
  'Ladrón': {
    name: 'Ladrón',
    team: 'village',
    emoji: '🦹',
    description: 'La primera noche puedes robar el rol de otro jugador. Si hay lobos entre tus opciones, debes coger uno.',
    nightAction: true,
    actionLabel: 'Robar rol',
  },
  'Oso': {
    name: 'Domador de Oso',
    team: 'village',
    emoji: '🐻',
    description: 'Cada mañana el oso gruñe si alguno de tus vecinos inmediatos es un lobo. ¡Usa esa información!',
    nightAction: false,
  },
  'Sacerdote': {
    name: 'Sacerdote',
    team: 'village',
    emoji: '✝️',
    description: 'Una vez por partida puedes bendecir a un jugador para que los lobos no puedan atacarle esa noche.',
    nightAction: true,
    actionLabel: 'Bendecir jugador',
  },
  'Alquimista': {
    name: 'Alquimista',
    team: 'village',
    emoji: '⚗️',
    description: 'Cada noche creas una poción al azar: puede salvar a la víctima, revelar un rol, o no tener efecto.',
    nightAction: false,
  },
  'Espía': {
    name: 'Espía',
    team: 'village',
    emoji: '🕵️',
    description: 'Una vez por partida puedes escuchar el chat de los lobos durante una noche entera.',
    nightAction: false,
  },
  'Chivo Expiatorio': {
    name: 'Chivo Expiatorio',
    team: 'village',
    emoji: '🐐',
    description: 'Si la votación del día acaba en empate, eres tú quien muere. A cambio, decides quién no podrá votar en la próxima votación.',
    nightAction: false,
  },
};

// Submission keys per role (for night phase tracking)
export const ROLE_SUBMISSION_KEY: Record<string, string> = {
  'Lobo': 'wolves',
  'Lobo Blanco': 'wolves',
  'Vidente': 'vidente',
  'Bruja': 'bruja',
  'Cupido': 'cupido',
  'Guardián': 'guardian',
  'Flautista': 'flautista',
  'Perro Lobo': 'perrolo',
  'Niño Salvaje': 'salvaje',
  'Profeta': 'profeta',
  'Sacerdote': 'sacerdote',
  'Ladrón': 'ladron',
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

interface WinCheckOpts {
  enchanted?: string[];
  round?: number;
  dayEliminatedUid?: string | null;
  eliminatedByVote?: boolean;
  perroLoboChoices?: Record<string, 'wolves' | 'village'>;
}

interface WinResult {
  winner: 'wolves' | 'village' | 'flautista' | 'angel' | 'picaro' | null;
  message: string | null;
}

export function checkWinCondition(
  players: { uid: string; isAlive: boolean }[],
  roles: Record<string, string>,
  opts: WinCheckOpts = {}
): WinResult {
  const { enchanted = [], round = 1, dayEliminatedUid, eliminatedByVote, perroLoboChoices = {} } = opts;

  // Build effective roles (Perro Lobo who chose wolf = treated as wolf)
  const effectiveRoles: Record<string, string> = { ...roles };
  for (const [uid, choice] of Object.entries(perroLoboChoices)) {
    if (choice === 'wolves') effectiveRoles[uid] = 'Lobo';
  }

  const alive = players.filter(p => p.isAlive);

  // Angel: wins if eliminated by village vote in round 1
  if (dayEliminatedUid && eliminatedByVote && round === 1) {
    const elimRole = effectiveRoles[dayEliminatedUid];
    if (elimRole === 'Ángel') {
      return { winner: 'angel' as any, message: '¡El Ángel fue ejecutado en la primera ronda y gana solo!' };
    }
  }

  const aliveWolves = alive.filter(p =>
    effectiveRoles[p.uid] === 'Lobo' || effectiveRoles[p.uid] === 'Lobo Blanco'
  );
  const aliveVillagers = alive.filter(p =>
    effectiveRoles[p.uid] !== 'Lobo' && effectiveRoles[p.uid] !== 'Lobo Blanco'
  );

  // Flautista: wins if all alive players are enchanted
  if (alive.length > 0 && alive.every(p => enchanted.includes(p.uid))) {
    const flautista = alive.find(p => effectiveRoles[p.uid] === 'Flautista');
    if (flautista) {
      return { winner: 'flautista' as any, message: '¡El Flautista ha hechizado a todo el pueblo y gana solo!' };
    }
  }

  // Pícaro: wins if only Pícaro + wolves remain (no other villagers)
  if (aliveWolves.length > 0) {
    const alivePicaros = alive.filter(p => effectiveRoles[p.uid] === 'Pícaro');
    const aliveOthers = alive.filter(p =>
      effectiveRoles[p.uid] !== 'Lobo' &&
      effectiveRoles[p.uid] !== 'Lobo Blanco' &&
      effectiveRoles[p.uid] !== 'Pícaro'
    );
    if (alivePicaros.length > 0 && aliveOthers.length === 0) {
      return { winner: 'picaro' as any, message: '¡El Pícaro ha sobrevivido hasta el final y gana solo!' };
    }
  }

  // Wolves win if they outnumber or equal villagers
  if (aliveWolves.length === 0) {
    return { winner: 'village', message: '¡El pueblo ha eliminado a todos los lobos!' };
  }
  if (aliveWolves.length >= aliveVillagers.length) {
    return { winner: 'wolves', message: '¡Los lobos han devorado al pueblo!' };
  }

  return { winner: null, message: null };
}
