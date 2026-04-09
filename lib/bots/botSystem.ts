export type BotType = 'callado' | 'acusador' | 'listo' | 'caotico';

export const BOT_NAMES = [
  'Carlos', 'Lucía', 'Mateo', 'Sofía', 'Alejandro', 'Valeria', 'Javier', 'Daniela',
  'Miguel', 'Paula', 'Sergio', 'Elena', 'Andrés', 'Nuria', 'Pablo', 'Carmen',
  'Rubén', 'Marta', 'Iván', 'Laura', 'Marcos', 'Alba', 'David', 'Silvia',
  'Adrián', 'Rosa', 'Jorge', 'Ana', 'Rodrigo', 'Irene',
];

export const BOT_TYPE_WEIGHTS: BotType[] = [
  'callado', 'callado',
  'acusador', 'acusador',
  'listo',
  'caotico',
];

export function assignBotType(): BotType {
  return BOT_TYPE_WEIGHTS[Math.floor(Math.random() * BOT_TYPE_WEIGHTS.length)];
}

export interface BotVoteConfig {
  minDelay: number;
  maxDelay: number;
  strategy: 'majority' | 'accuse' | 'analyze' | 'random';
}

export const BOT_VOTE_CONFIG: Record<BotType, BotVoteConfig> = {
  callado:  { minDelay: 42000, maxDelay: 54000, strategy: 'majority' },
  acusador: { minDelay: 8000,  maxDelay: 20000, strategy: 'accuse' },
  listo:    { minDelay: 25000, maxDelay: 38000, strategy: 'analyze' },
  caotico:  { minDelay: 3000,  maxDelay: 14000, strategy: 'random' },
};

export const BOT_CHAT_STYLE: Record<BotType, string> = {
  callado: 'Eres callado y desconfiado. Hablas poco y tarde. Frases cortas, dubitativas. Ejemplo: "no sé..." o "a mí también me parece raro"',
  acusador: 'Eres impulsivo y acusador. Señalas a alguien sin mucha lógica. Ejemplo: "¡Es claramente ${target}!" o "Desde el principio me pareció sospechoso"',
  listo: 'Eres analítico y estratégico. Razonas basándote en comportamientos. Ejemplo: "si ${name} fuera lobo, no habría votado así" o "la lógica dice que..."',
  caotico: 'Eres caótico e impredecible. Cambias de opinión, dices cosas sin sentido. Ejemplo: "yo voto a quien me da la gana" o "que gane el mejor lobo jaja"',
};

export function pickBotVoteTarget(
  botType: BotType,
  botUid: string,
  alivePlayers: { uid: string; name: string; isAI?: boolean }[],
  currentVotes: Record<string, string>,
): string | null {
  const candidates = alivePlayers.filter(p => p.uid !== botUid);
  if (candidates.length === 0) return null;

  const voteCounts: Record<string, number> = {};
  for (const target of Object.values(currentVotes)) {
    voteCounts[target] = (voteCounts[target] ?? 0) + 1;
  }

  switch (botType) {
    case 'callado': {
      const sorted = [...candidates].sort((a, b) => (voteCounts[b.uid] ?? 0) - (voteCounts[a.uid] ?? 0));
      return sorted[0]?.uid ?? null;
    }
    case 'acusador': {
      const notYetVoted = candidates.filter(p => !(voteCounts[p.uid] ?? 0));
      const pool = notYetVoted.length > 0 ? notYetVoted : candidates;
      return pool[Math.floor(Math.random() * pool.length)]?.uid ?? null;
    }
    case 'listo': {
      const topVotes = Math.max(0, ...candidates.map(p => voteCounts[p.uid] ?? 0));
      if (topVotes > 0) {
        const leaders = candidates.filter(p => (voteCounts[p.uid] ?? 0) === topVotes);
        return leaders[Math.floor(Math.random() * leaders.length)]?.uid ?? null;
      }
      return candidates[Math.floor(Math.random() * candidates.length)]?.uid ?? null;
    }
    case 'caotico':
    default:
      return candidates[Math.floor(Math.random() * candidates.length)]?.uid ?? null;
  }
}

export const FALLBACK_BOT_MESSAGES: Record<BotType, string[]> = {
  callado: [
    'no sé... a mí me da mal rollo',
    'algo no cuadra aquí',
    'prefiero esperar y ver',
    'hmmm',
    'yo no me fío de nadie',
  ],
  acusador: [
    '¡Es clarísimo quién es el lobo!',
    'Desde el principio lo vi venir',
    'Solo uno puede ser el culpable',
    '¡Hay que votar ya!',
    'eso que dijiste antes fue muy sospechoso',
  ],
  listo: [
    'Si analizamos los votos de la ronda anterior...',
    'El comportamiento no encaja con ser aldeano',
    'Lógicamente, el lobo no votaría así',
    'Pensad bien antes de votar',
    'hay que seguir la pista de los votos',
  ],
  caotico: [
    'jajaja igual da a quién votamos',
    'yo voto al primero que vea',
    'cambio mi voto sin razón ninguna',
    'el caos es lo mío',
    'que gane el más loco',
  ],
};
