export interface RoleInfo {
  name: string;
  team: 'village' | 'wolves' | 'solo';
  emoji: string;
  description: string;
  nightAction: boolean;
  actionLabel?: string;
}

export const ROLES: Record<string, RoleInfo> = {
  // ── ALDEANOS ──────────────────────────────────────────────────────────────
  'Aldeano': {
    name: 'Aldeano',
    team: 'village',
    emoji: '🧑‍🌾',
    description: 'Eres un aldeano inocente. No tienes poderes especiales. Tu única misión es observar, debatir y votar para linchar a los Hombres Lobo y salvar al pueblo.',
    nightAction: false,
  },
  'Alborotadora': {
    name: 'Alborotadora',
    team: 'village',
    emoji: '💥',
    description: 'Una vez por partida, durante el día, puedes elegir a dos jugadores para que luchen entre sí. Ambos morirán instantáneamente al final de la fase de votación.',
    nightAction: false,
  },
  'Anciana Líder': {
    name: 'Anciana Líder',
    team: 'village',
    emoji: '👵',
    description: 'Cada noche, eliges a un jugador para exiliarlo. Ese jugador no podrá usar ninguna habilidad nocturna durante esa noche.',
    nightAction: true,
    actionLabel: 'Exiliar jugador',
  },
  'Ángel Resucitador': {
    name: 'Ángel Resucitador',
    team: 'village',
    emoji: '🪄',
    description: 'Una vez por partida, durante la noche, puedes elegir a un jugador muerto para devolverlo a la vida con su rol original.',
    nightAction: true,
    actionLabel: 'Resucitar jugador',
  },
  'Aprendiz de Vidente': {
    name: 'Aprendiz de Vidente',
    team: 'village',
    emoji: '🔭',
    description: 'Eres un aldeano normal, pero si la Vidente muere, heredas su poder y te conviertes en la nueva Vidente a partir de la noche siguiente.',
    nightAction: false,
  },
  'Doctor': {
    name: 'Doctor',
    team: 'village',
    emoji: '🩺',
    description: 'Cada noche, eliges a un jugador (o a ti mismo) para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas.',
    nightAction: true,
    actionLabel: 'Proteger jugador',
  },
  'Fantasma': {
    name: 'Fantasma',
    team: 'village',
    emoji: '👻',
    description: 'Si mueres, podrás enviar un único mensaje anónimo de 280 caracteres a un jugador vivo de tu elección para intentar guiar al pueblo desde el más allá.',
    nightAction: false,
  },
  'Gemela': {
    name: 'Gemela',
    team: 'village',
    emoji: '👯‍♀️',
    description: 'En la primera noche, tú y tu gemela os reconoceréis. A partir de entonces, podréis hablar en un chat privado. Si una muere, la otra morirá de pena al instante.',
    nightAction: false,
  },
  'Hechicera': {
    name: 'Hechicera',
    team: 'village',
    emoji: '🧪',
    description: 'Posees dos pociones de un solo uso: una de veneno para eliminar a un jugador durante la noche, y una de vida para salvar al objetivo de los lobos. No puedes salvarte a ti misma.',
    nightAction: true,
    actionLabel: 'Usar pociones',
  },
  'Leprosa': {
    name: 'Leprosa',
    team: 'village',
    emoji: '🤒',
    description: 'Si los lobos te matan durante la noche, tu enfermedad se propaga a la manada, impidiéndoles atacar en la noche siguiente.',
    nightAction: false,
  },
  'Licántropo': {
    name: 'Licántropo',
    team: 'village',
    emoji: '🐾',
    description: 'Perteneces al equipo del pueblo, pero tienes sangre de lobo. Si la Vidente te investiga, te verá como si fueras un Hombre Lobo, sembrando la confusión.',
    nightAction: false,
  },
  'Príncipe': {
    name: 'Príncipe',
    team: 'village',
    emoji: '👑',
    description: 'Si el pueblo vota para lincharte, revelarás tu identidad y sobrevivirás, anulando la votación. Esta habilidad solo se puede usar una vez por partida.',
    nightAction: false,
  },
  'Silenciadora': {
    name: 'Silenciadora',
    team: 'village',
    emoji: '🤫',
    description: 'Cada noche, eliges a un jugador. Esa persona no podrá hablar (enviar mensajes en el chat) durante todo el día siguiente.',
    nightAction: true,
    actionLabel: 'Silenciar jugador',
  },
  'Sirena del Río': {
    name: 'Sirena del Río',
    team: 'village',
    emoji: '🧜‍♀️',
    description: 'En la primera noche, hechizas a un jugador. A partir de entonces, esa persona está obligada a votar por el mismo objetivo que tú durante el día.',
    nightAction: true,
    actionLabel: 'Hechizar jugador',
  },
  'Vigía': {
    name: 'Vigía',
    team: 'village',
    emoji: '🔦',
    description: 'Una vez por partida, en la noche, puedes arriesgarte a espiar a los lobos. Si tienes éxito, los conocerás. Si fallas (si los lobos te atacan esa noche), morirás.',
    nightAction: true,
    actionLabel: 'Espiar a los lobos',
  },
  'Virginia Woolf': {
    name: 'Virginia Woolf',
    team: 'village',
    emoji: '📖',
    description: 'En la primera noche, eliges a un jugador para vincular tu destino. Si tú mueres en cualquier momento, la persona que elegiste también morirá automáticamente.',
    nightAction: true,
    actionLabel: 'Vincular destino',
  },
  // ── Roles de aldeano ya existentes ────────────────────────────────────────
  'Vidente': {
    name: 'Vidente',
    team: 'village',
    emoji: '🔮',
    description: 'Cada noche puedes revelar la verdadera naturaleza de un jugador. Se te revelará si es un Hombre Lobo o no. Los Licántropos también son vistos como lobos.',
    nightAction: true,
    actionLabel: 'Investigar jugador',
  },
  'Cazador': {
    name: 'Cazador',
    team: 'village',
    emoji: '🏹',
    description: 'Al morir, ya sea de noche o linchado, tendrás un último disparo. Deberás elegir a otro jugador para que muera contigo. Tu disparo es ineludible.',
    nightAction: false,
    actionLabel: 'Disparar última bala',
  },
  'Cupido': {
    name: 'Cupido',
    team: 'village',
    emoji: '💘',
    description: 'La primera noche unes a dos jugadores con tu flecha. Si uno de ellos muere, el otro morirá de amor. Su objetivo es sobrevivir juntos por encima de todo.',
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
  'Guardián': {
    name: 'Guardián de Aldea',
    team: 'village',
    emoji: '🛡️',
    description: 'Cada noche puedes proteger a un jugador del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas, y solo puedes protegerte a ti mismo una vez por partida.',
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
  'Profeta': {
    name: 'Profeta',
    team: 'village',
    emoji: '📜',
    description: 'Como la Vidente, puedes investigar a un jugador cada noche. Sin embargo, el resultado se revela públicamente a todo el pueblo.',
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
  'Médium': {
    name: 'Médium',
    team: 'village',
    emoji: '🌀',
    description: 'Tienes el don de comunicarte con los muertos. Puedes leer los mensajes de los jugadores eliminados en el chat de fantasmas.',
    nightAction: false,
  },
  'Gemelas': {
    name: 'Gemelas',
    team: 'village',
    emoji: '👯',
    description: 'Sois dos hermanas que se conocen entre sí. Trabajad juntas para salvar al pueblo. Si una muere, la otra morirá de pena al instante.',
    nightAction: false,
  },
  'Hermanos': {
    name: 'Hermanos',
    team: 'village',
    emoji: '👬',
    description: 'Sois tres hermanos que se conocen. Coordinad vuestra estrategia en secreto para proteger al pueblo.',
    nightAction: false,
  },

  // ── LOBOS ─────────────────────────────────────────────────────────────────
  'Lobo': {
    name: 'Hombre Lobo',
    team: 'wolves',
    emoji: '🐺',
    description: 'Cada noche, te despiertas con tu manada para elegir a una víctima. Tu objetivo es eliminar a los aldeanos hasta que vuestro número sea igual o superior.',
    nightAction: true,
    actionLabel: 'Elegir víctima',
  },
  'Bruja': {
    name: 'Bruja',
    team: 'wolves',
    emoji: '🧙‍♀️',
    description: 'Eres aliada de los lobos. Cada noche, eliges a un jugador. Si eliges a la Vidente, la descubrirás y los lobos serán informados. Desde ese momento, los lobos no podrán matarte.',
    nightAction: true,
    actionLabel: 'Buscar la Vidente',
  },
  'Cría de Lobo': {
    name: 'Cría de Lobo',
    team: 'wolves',
    emoji: '🐶',
    description: 'Eres un lobo joven. Si mueres, la manada se enfurecerá y podrá realizar dos asesinatos en la noche siguiente a tu muerte.',
    nightAction: true,
    actionLabel: 'Elegir víctima',
  },
  'Hada Buscadora': {
    name: 'Hada Buscadora',
    team: 'wolves',
    emoji: '🧚',
    description: 'Equipo de los Lobos. Cada noche, buscas al Hada Durmiente. Si la encuentras, ambas despertáis un poder de un solo uso para matar a un jugador.',
    nightAction: true,
    actionLabel: 'Buscar al Hada Durmiente',
  },
  'Maldito': {
    name: 'Maldito',
    team: 'wolves',
    emoji: '😈',
    description: 'Empiezas como un aldeano. Sin embargo, si eres atacado por los lobos, no mueres; en su lugar, te transformas en un Hombre Lobo y te unes a ellos.',
    nightAction: false,
  },
  'Lobo Blanco': {
    name: 'Lobo Blanco',
    team: 'wolves',
    emoji: '🤍',
    description: 'Eres parte de la manada, pero tu objetivo es sobrevivir solo. Cada dos noches puedes eliminar a uno de tus compañeros lobos.',
    nightAction: true,
    actionLabel: 'Eliminar lobo aliado',
  },
  'Perro Lobo': {
    name: 'Perro Lobo',
    team: 'solo',
    emoji: '🐕',
    description: 'La primera noche debes elegir bando: aldeano o lobo. Si eliges ser lobo, te unes a la manada. Si eliges aldeano, juegas con el pueblo.',
    nightAction: true,
    actionLabel: 'Elegir bando',
  },

  // ── NEUTRALES / SOLITARIOS ─────────────────────────────────────────────────
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
  'Niño Salvaje': {
    name: 'Niño Salvaje',
    team: 'village',
    emoji: '🌿',
    description: 'La primera noche elige un modelo a seguir. Si esa persona muere durante la partida, ¡te conviertes en lobo!',
    nightAction: true,
    actionLabel: 'Elegir modelo',
  },
  'Banshee': {
    name: 'Banshee',
    team: 'solo',
    emoji: '💀',
    description: 'Cada noche, predices la muerte de un jugador. Si ese jugador muere esa misma noche (por cualquier causa), ganas un punto. Ganas la partida si acumulas 2 puntos.',
    nightAction: true,
    actionLabel: 'Predecir muerte',
  },
  'Cambiaformas': {
    name: 'Cambiaformas',
    team: 'solo',
    emoji: '🦎',
    description: 'En la primera noche, eliges a un jugador. Si esa persona muere, adoptarás su rol y su equipo, transformándote completamente. Tu lealtad es incierta.',
    nightAction: true,
    actionLabel: 'Elegir jugador a seguir',
  },
  'Hada Durmiente': {
    name: 'Hada Durmiente',
    team: 'solo',
    emoji: '🌙',
    description: 'Empiezas como Neutral. Si el Hada Buscadora (del equipo de los lobos) te encuentra, os unís. Vuestro objetivo es ser las últimas en pie.',
    nightAction: false,
  },
  'Hombre Ebrio': {
    name: 'Hombre Ebrio',
    team: 'solo',
    emoji: '🍺',
    description: 'Ganas la partida en solitario si consigues que el pueblo te linche. No tienes acciones nocturnas; tu habilidad es la manipulación social.',
    nightAction: false,
  },
  'Líder del Culto': {
    name: 'Líder del Culto',
    team: 'solo',
    emoji: '🕯️',
    description: 'Cada noche, conviertes a un jugador a tu culto. Ganas si todos los jugadores vivos se han unido a tu culto. Juegas solo contra todos.',
    nightAction: true,
    actionLabel: 'Convertir al culto',
  },
  'Pescador': {
    name: 'Pescador',
    team: 'solo',
    emoji: '🎣',
    description: 'Cada noche, subes a un jugador a tu barco. Ganas si logras tener a todos los aldeanos vivos en tu barco. Pero si pescas a un lobo, mueres.',
    nightAction: true,
    actionLabel: 'Subir al barco',
  },
  'Vampiro': {
    name: 'Vampiro',
    team: 'solo',
    emoji: '🧛',
    description: 'Juegas solo. Cada noche, muerdes a un jugador. Un jugador mordido 3 veces, muere. Si consigues 3 muertes por mordisco, ganas la partida.',
    nightAction: true,
    actionLabel: 'Morder jugador',
  },
  'Verdugo': {
    name: 'Verdugo',
    team: 'solo',
    emoji: '🪓',
    description: 'Al inicio se te asigna un objetivo secreto. Tu única misión es convencer al pueblo para que lo linchen. Si lo consigues, ganas la partida en solitario.',
    nightAction: false,
  },
};

// Submission keys per role (for night phase tracking)
export const ROLE_SUBMISSION_KEY: Record<string, string> = {
  'Lobo': 'wolves',
  'Lobo Blanco': 'wolves',
  'Cría de Lobo': 'wolves',
  'Vidente': 'vidente',
  'Hechicera': 'hechicera',
  'Bruja': 'bruja',
  'Cupido': 'cupido',
  'Guardián': 'guardian',
  'Flautista': 'flautista',
  'Perro Lobo': 'perrolo',
  'Niño Salvaje': 'salvaje',
  'Profeta': 'profeta',
  'Sacerdote': 'sacerdote',
  'Ladrón': 'ladron',
  'Espía': 'espia',
  'Anciana Líder': 'anciana',
  'Ángel Resucitador': 'angelresucitador',
  'Doctor': 'doctor',
  'Silenciadora': 'silenciadora',
  'Sirena del Río': 'sirena',
  'Virginia Woolf': 'virginiawoolf',
  'Vigía': 'vigia',
  'Banshee': 'banshee',
  'Cambiaformas': 'cambiaformas',
  'Líder del Culto': 'liderculto',
  'Pescador': 'pescador',
  'Vampiro': 'vampiro',
  'Hada Buscadora': 'hadabuscadora',
  'Lobo Blanco_kill': 'loboblanco',
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
  cultMembers?: string[];
  vampiroKills?: number;
  pescadorBoat?: string[];
  hadaLinked?: boolean;
  nightKilledUids?: string[];
}

interface WinResult {
  winner: string | null;
  message: string | null;
}

export function checkWinCondition(
  players: { uid: string; isAlive: boolean }[],
  roles: Record<string, string>,
  opts: WinCheckOpts = {}
): WinResult {
  const {
    enchanted = [], round = 1, dayEliminatedUid, eliminatedByVote,
    perroLoboChoices = {}, cultMembers = [], vampiroKills = 0,
    pescadorBoat = [], hadaLinked = false, nightKilledUids = [],
  } = opts;

  const effectiveRoles: Record<string, string> = { ...roles };
  for (const [uid, choice] of Object.entries(perroLoboChoices)) {
    if (choice === 'wolves') effectiveRoles[uid] = 'Lobo';
  }

  const alive = players.filter(p => p.isAlive);

  // Angel: wins if eliminated by village vote in round 1
  if (dayEliminatedUid && eliminatedByVote && round === 1) {
    if (effectiveRoles[dayEliminatedUid] === 'Ángel') {
      return { winner: 'angel', message: '¡El Ángel fue ejecutado en la primera ronda y gana solo!' };
    }
  }

  // Hombre Ebrio: wins if lynched by village vote OR killed by wolves at night
  if (dayEliminatedUid && eliminatedByVote) {
    if (effectiveRoles[dayEliminatedUid] === 'Hombre Ebrio') {
      return { winner: 'ebrio', message: '¡El Hombre Ebrio lo logró! Consiguió que el pueblo lo linchara y gana en solitario. ¡Era su plan desde el principio!' };
    }
  }
  // Night kill (wolves / poison / etc.)
  if (nightKilledUids.some(uid => effectiveRoles[uid] === 'Hombre Ebrio')) {
    return { winner: 'ebrio', message: '¡El Hombre Ebrio consiguió que lo eliminaran esta noche y gana en solitario. ¡Era exactamente lo que buscaba!' };
  }

  const aliveWolves = alive.filter(p =>
    effectiveRoles[p.uid] === 'Lobo' || effectiveRoles[p.uid] === 'Lobo Blanco' ||
    effectiveRoles[p.uid] === 'Cría de Lobo'
  );
  const aliveVillagers = alive.filter(p =>
    effectiveRoles[p.uid] !== 'Lobo' && effectiveRoles[p.uid] !== 'Lobo Blanco' &&
    effectiveRoles[p.uid] !== 'Cría de Lobo'
  );

  // Flautista: wins if all alive players are enchanted
  if (alive.length > 0 && alive.every(p => enchanted.includes(p.uid))) {
    const flautista = alive.find(p => effectiveRoles[p.uid] === 'Flautista');
    if (flautista) {
      return { winner: 'flautista', message: '¡El Flautista ha hechizado a todo el pueblo y gana solo!' };
    }
  }

  // Pícaro: wins if only Pícaro + wolves remain
  if (aliveWolves.length > 0) {
    const alivePicaros = alive.filter(p => effectiveRoles[p.uid] === 'Pícaro');
    const aliveOthers = alive.filter(p =>
      effectiveRoles[p.uid] !== 'Lobo' && effectiveRoles[p.uid] !== 'Lobo Blanco' &&
      effectiveRoles[p.uid] !== 'Cría de Lobo' && effectiveRoles[p.uid] !== 'Pícaro'
    );
    if (alivePicaros.length > 0 && aliveOthers.length === 0) {
      return { winner: 'picaro', message: '¡El Pícaro ha sobrevivido hasta el final y gana solo!' };
    }
  }

  // Vampiro: wins if 3 bite-deaths
  if (vampiroKills >= 3) {
    return { winner: 'vampiro', message: '¡El Vampiro ha conseguido 3 muertes por mordisco y gana solo!' };
  }

  // Banshee win is checked separately (on 2nd correct prediction)

  // Líder del Culto: wins if all alive players are cult members
  if (alive.length > 0 && cultMembers.length > 0 && alive.every(p => cultMembers.includes(p.uid))) {
    return { winner: 'lider_culto', message: '¡El Líder del Culto ha convertido a todo el pueblo y gana solo!' };
  }

  // Pescador: wins if all alive aldeanos are on his boat
  if (pescadorBoat.length > 0) {
    const aliveVillage = alive.filter(p =>
      effectiveRoles[p.uid] !== 'Lobo' && effectiveRoles[p.uid] !== 'Lobo Blanco' &&
      effectiveRoles[p.uid] !== 'Cría de Lobo' && effectiveRoles[p.uid] !== 'Pescador'
    );
    if (aliveVillage.length > 0 && aliveVillage.every(p => pescadorBoat.includes(p.uid))) {
      return { winner: 'pescador', message: '¡El Pescador ha subido a todos los aldeanos a su barco y gana solo!' };
    }
  }

  // Hada Buscadora + Hada Durmiente: win together if last ones standing
  if (hadaLinked) {
    const nonHadas = alive.filter(p =>
      effectiveRoles[p.uid] !== 'Hada Buscadora' && effectiveRoles[p.uid] !== 'Hada Durmiente'
    );
    if (nonHadas.length === 0 && alive.some(p => effectiveRoles[p.uid] === 'Hada Buscadora') &&
        alive.some(p => effectiveRoles[p.uid] === 'Hada Durmiente')) {
      return { winner: 'hadas', message: '¡Las Hadas son las últimas en pie y ganan juntas!' };
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
