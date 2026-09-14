export interface ChaosEvent {
  id: string;
  emoji: string;
  name: string;
  description: string;
  mechanical: string;
}

/**
 * Server-owned chaos event catalog.
 * Keep this independent from UI role/event modules so authoritative game logic
 * can select and persist events without importing client code.
 */
export const CHAOS_EVENTS: readonly ChaosEvent[] = [
  {
    id: 'tormenta',
    emoji: '🌩️',
    name: 'Tormenta sobre el Pueblo',
    description: 'El cielo se oscurece. Nadie puede ser exiliado hoy — la votación queda suspendida por las fuerzas de la naturaleza.',
    mechanical: 'noExile',
  },
  {
    id: 'eclipse',
    emoji: '🌑',
    name: 'Eclipse de Sangre',
    description: 'La oscuridad es total. Esta noche los lobos son más poderosos: podrán elegir dos víctimas en lugar de una.',
    mechanical: 'doubleKill',
  },
  {
    id: 'rumor',
    emoji: '👁️',
    name: 'El Rumor del Pueblo',
    description: 'Un testigo anónimo revela algo que vio: se desvela el rol de uno de los jugadores ya eliminados.',
    mechanical: 'revealDead',
  },
  {
    id: 'curacion',
    emoji: '✨',
    name: 'Curación Divina',
    description: 'Una fuerza mística restaura las pociones de la Hechicera. Si está en la partida, recupera tanto el antídoto como el veneno.',
    mechanical: 'healWitch',
  },
  {
    id: 'amnesia',
    emoji: '🔮',
    name: 'Amnesia Colectiva',
    description: 'Un hechizo borra la memoria del pueblo. Los votos de hoy son completamente anónimos — nadie sabrá quién votó a quién.',
    mechanical: 'anonymousVotes',
  },
  {
    id: 'calma',
    emoji: '🕊️',
    name: 'Calma Chicha',
    description: 'Un misterioso silencio cae sobre el pueblo. El debate de hoy dura 30 segundos extra para encontrar la verdad.',
    mechanical: 'extraTime',
  },
  {
    id: 'panico',
    emoji: '😱',
    name: 'Pánico en el Pueblo',
    description: '¡Hay un asesino entre nosotros! El miedo acorta el debate — solo tenéis la mitad del tiempo para tomar una decisión.',
    mechanical: 'halfTime',
  },
  {
    id: 'presagio',
    emoji: '⚡',
    name: 'Presagio del Oráculo',
    description: 'Las estrellas hablan. El Vidente puede consultar a los astros sobre DOS jugadores esta noche en lugar de uno.',
    mechanical: 'doubleSeer',
  },
  {
    id: 'intercambio',
    emoji: '🔀',
    name: 'El Gran Intercambio',
    description: '¡Los roles cambian! Una fuerza desconocida ha barajado las identidades de todos los jugadores vivos. Nadie sabe ya quién es quién.',
    mechanical: 'roleSwap',
  },
  {
    id: 'democracia_inversa',
    emoji: '🙃',
    name: 'Democracia Inversa',
    description: '¡Las reglas han cambiado! Hoy será exiliado el jugador que reciba MENOS votos, no el que reciba más. Piénsalo bien antes de votar.',
    mechanical: 'inverterVotes',
  },
  {
    id: 'juicio_ia',
    emoji: '🤖',
    name: 'El Juicio de la IA',
    description: 'La IA narradora ha tomado el control. Ha estudiado los patrones y ha decidido eliminar a alguien esta misma noche. El pueblo elige, pero la IA también.',
    mechanical: 'aiEliminate',
  },
  {
    id: 'doble_ejecucion',
    emoji: '⚖️',
    name: 'Doble Ejecución',
    description: '¡El pueblo exige sangre doble! Hoy serán exiliados los DOS jugadores más votados. Elegid bien, porque habrá dos sillas vacías esta tarde.',
    mechanical: 'dobleEjecucion',
  },
  {
    id: 'resurreccion_caotica',
    emoji: '💀',
    name: 'Resurrección Caótica',
    description: 'Las reglas de la muerte no aplican hoy. Un alma perdida ha regresado al pueblo. Un jugador eliminado anteriormente vuelve a la vida... pero no sabe en quién confiar.',
    mechanical: 'revive',
  },
  {
    id: 'confesion_forzada',
    emoji: '🎙️',
    name: 'Confesión Forzada',
    description: '¡La verdad sale a la luz! El Narrador ha elegido a un jugador al azar que debe hablar durante 20 segundos sin parar. El pueblo juzgará cada palabra.',
    mechanical: 'forceConfession',
  },
] as const;

/**
 * Preserves the original 30% event probability while making randomness
 * injectable for deterministic server-side tests.
 */
export function drawChaosEvent(random: () => number = Math.random): ChaosEvent | null {
  const chance = random();
  if (chance < 0 || chance >= 1 || chance > 0.30) return null;
  const index = Math.min(CHAOS_EVENTS.length - 1, Math.floor(random() * CHAOS_EVENTS.length));
  return CHAOS_EVENTS[index];
}
