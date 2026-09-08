import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export type NarratorEvent =
  | 'night_death' | 'night_safe' | 'night_multiple_deaths' | 'day_exile'
  | 'day_no_exile' | 'game_start' | 'final_duel' | 'day_interrupt';
export type InterruptType = 'warning' | 'suspicion' | 'chaos' | 'irony' | 'accusation';
interface VoteEntry { voter: string; target: string; }
interface NarratorRequest {
  event: NarratorEvent;
  victimName?: string; victimRole?: string; killedBy?: string;
  eliminatedName?: string; eliminatedRole?: string; eliminatedWasWolf?: boolean;
  secondVictimName?: string; secondVictimRole?: string; round: number;
  survivors: string[]; totalPlayers?: number; voteHistory?: VoteEntry[];
  prevVoteHistory?: VoteEntry[]; accusationsToday?: string[]; fastVoter?: string;
  loneVoter?: string; chaosEvent?: string; interruptType?: InterruptType;
  silentPlayers?: string[]; talkingMost?: string; timeElapsedSeconds?: number;
  recentMessages?: string[];
}

const NARRATOR_PERSONA = `Eres el Narrador de "El Pueblo Duerme", un juego de rol oscuro.
Tu personalidad:
- Dramático y teatral como un escritor gótico
- Sardónico y polémico: te encanta señalar traiciones, patrones de voto sospechosos, cambios de opinión
- Usas los nombres reales de los jugadores — no "un jugador", sino el nombre exacto
- Mencionas comportamientos específicos: quién habla mucho, quién calla, quién acusa sin pruebas
- Hablas en español castellano coloquial oscuro — natural, no formal
- Nunca usas emojis
- Cada narración es única — nunca repites las mismas frases
- Eres conciso: 1-2 frases cortas y poderosas (máx 40 palabras en total)
- Generas paranoia inmediata`;

function buildVoteContext(req: NarratorRequest): string {
  const parts: string[] = [];
  if (req.voteHistory?.length) parts.push(`Votos de hoy: ${req.voteHistory.slice(0, 6).map(v => `${v.voter} votó a ${v.target}`).join(', ')}.`);
  if (req.fastVoter) parts.push(`${req.fastVoter} fue el primero en votar, quizá demasiado rápido.`);
  if (req.loneVoter) parts.push(`${req.loneVoter} fue el único que votó diferente al resto.`);
  if (req.accusationsToday?.length) parts.push(`Los más acusados hoy: ${req.accusationsToday.slice(0, 3).join(', ')}.`);
  if (req.chaosEvent) parts.push(`Evento especial activo: "${req.chaosEvent}".`);
  return parts.join(' ');
}

function buildPrompt(req: NarratorRequest): string {
  const survivorList = req.survivors.slice(0, 8).join(', ');
  const roundInfo = `Ronda ${req.round}. Sobrevivientes: ${survivorList}.`;
  const voteCtx = buildVoteContext(req);
  switch (req.event) {
    case 'day_interrupt': {
      const silentList = (req.silentPlayers ?? []).slice(0, 3).join(', ');
      const recentCtx = (req.recentMessages ?? []).slice(0, 4).join(' | ');
      const elapsed = req.timeElapsedSeconds ?? 0;
      const talkingMost = req.talkingMost ?? '';
      let focus = '';
      if (req.interruptType === 'suspicion' && silentList) focus = `Estos jugadores no han dicho nada: ${silentList}. El silencio delata.`;
      else if (req.interruptType === 'accusation' && talkingMost) focus = `${talkingMost} lleva hablando sin parar. ¿Distracción deliberada?`;
      else if (req.interruptType === 'chaos') focus = `Han pasado ${elapsed} segundos y el debate va en círculos.`;
      else if (req.interruptType === 'warning') focus = `El tiempo se acaba. Alguien aquí todavía no ha mostrado sus cartas.`;
      else focus = recentCtx ? `El debate está así: ${recentCtx}` : 'El pueblo debate.';
      return `${NARRATOR_PERSONA}\n\n${roundInfo}\n${focus}\n\nGenera UNA frase corta e inquietante que interrumpa el debate. Debe crear paranoia inmediata sobre alguien específico. Máximo 35 palabras. NO empieces con "El narrador" ni con "Nota". Empieza directo.`;
    }
    case 'night_death': return `${NARRATOR_PERSONA}\n\n${roundInfo}\n${voteCtx ? `Contexto del día anterior: ${voteCtx}` : ''}\nEsta noche, ${req.victimName} ha muerto. Era ${req.victimRole ?? 'un aldeano'}.${req.killedBy ? ` Lo mató: ${req.killedBy}.` : ''}\n\nNarra este momento con drama y oscuridad. Menciona el nombre, el rol. Puedes insinuar traición, soledad, o ironía. NO empieces con "Esta noche". Empieza de otra forma.`;
    case 'night_safe': return `${NARRATOR_PERSONA}\n\n${roundInfo}\nEsta noche nadie murió. El pueblo se despertó entero... por ahora.\n\nNarra este respiro con tensión contenida. El alivio dura poco. Los lobos siguen ahí. Hazlo inquietante, no tranquilizador.`;
    case 'night_multiple_deaths': return `${NARRATOR_PERSONA}\n\n${roundInfo}\nEsta noche murieron DOS personas: ${req.victimName} (${req.victimRole ?? 'aldeano'}) y ${req.secondVictimName} (${req.secondVictimRole ?? 'aldeano'}).\n\nNarra esta carnicería con intensidad. Dos muertes en una noche es una masacre.`;
    case 'day_exile': return `${NARRATOR_PERSONA}\n\n${roundInfo}\n${voteCtx ? `Datos de la votación: ${voteCtx}` : ''}\nEl pueblo ha votado y ha desterrado a ${req.eliminatedName}, que era ${req.eliminatedRole ?? 'aldeano'}.${req.eliminatedWasWolf ? ' Era un lobo. El pueblo acertó.' : ' Era inocente. El pueblo cometió un error terrible.'}\n\nNarra este destierro con datos específicos. Menciona el nombre. Sé específico con los votos si tienes datos. Genera paranoia.`;
    case 'day_no_exile': return `${NARRATOR_PERSONA}\n\n${roundInfo}\n${voteCtx ? `Datos de la votación: ${voteCtx}` : ''}\nEl pueblo debatió pero no llegó a un acuerdo. Nadie fue desterrado hoy.\n\nNarra este fracaso señalando a alguien específico del contexto de votos como responsable del caos. Los lobos ganan tiempo.`;
    case 'game_start': return `${NARRATOR_PERSONA}\n\nUna nueva partida comienza. ${req.totalPlayers ?? req.survivors.length} jugadores. Lobos ocultos entre el pueblo.\nLos jugadores: ${survivorList}.\n\nNarra el inicio del juego. Crea atmósfera de miedo e incertidumbre. Advierte que entre estos nombres hay traidores. No reveles quiénes.`;
    case 'final_duel': return `${NARRATOR_PERSONA}\n\n${roundInfo}\nSolo quedan ${req.survivors.length} jugadores: ${survivorList}.\nEl final está cerca. La tensión es insoportable.\n\nNarra este momento final con toda la intensidad que merece. Es la última oportunidad para descubrir la verdad.`;
    default: return `${NARRATOR_PERSONA}\n${roundInfo}\nNarra un momento dramático del juego.`;
  }
}

const FALLBACKS: Record<NarratorEvent, string[]> = {
  night_death: ['El amanecer descubrió lo que la noche ocultó. Otra víctima. Otro nombre borrado del mapa.', 'La oscuridad se lo llevó sin avisar. El pueblo despierta con una silla vacía.', 'Murió como vivió: sin saber en quién confiar.'],
  night_safe: ['Milagrosamente, el alba llegó sin sangre. Pero la calma nunca dura.', 'Esta noche, el pueblo tuvo suerte. Mañana puede que no.', 'Los lobos esperan. El pueblo respira. De momento.'],
  night_multiple_deaths: ['Dos sillas vacías. Dos nombres menos. Esta noche, el pueblo sangró doble.', 'La masacre no tiene justificación. Solo consecuencias.'],
  day_exile: ['El pueblo habló. La voz del pueblo rara vez se equivoca... o sí.', 'Destierro. La multitud decidió. Lo correcto es otra historia.'],
  day_no_exile: ['El debate terminó en nada. Los lobos agradecen la indecisión.', 'Sin acuerdo. Sin justicia. Sin esperanza esta tarde.'],
  game_start: ['Que comience el juego. Alguien aquí miente. La pregunta es quién.', 'El pueblo duerme... pero no todos duermen tranquilos esta noche.'],
  final_duel: ['El momento de la verdad. Solo quedan unos pocos. La mentira ya no tiene dónde esconderse.'],
  day_interrupt: ['Alguien aquí lleva demasiado tiempo callado. Los lobos no gritan, susurran.', 'Fíjate en quien más habla. La distracción es la herramienta favorita del lobo.', 'El tiempo pasa. Y cada segundo de silencio acusa a alguien.'],
};
function getFallback(event: NarratorEvent): string { const list = FALLBACKS[event] ?? FALLBACKS.night_death; return list[Math.floor(Math.random() * list.length)]; }
function getInterruptType(req: NarratorRequest): InterruptType { if (req.interruptType) return req.interruptType; const elapsed = req.timeElapsedSeconds ?? 0; if (elapsed < 30) return 'irony'; if ((req.silentPlayers ?? []).length) return 'suspicion'; if (req.talkingMost) return 'accusation'; if (elapsed > 90) return 'warning'; return 'chaos'; }

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: NarratorRequest = { event: 'night_death', round: 1, survivors: [] };
  try {
    body = await req.json();
    if (!Array.isArray(body.survivors) || typeof body.round !== 'number' || typeof body.event !== 'string') {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ narration: getFallback(body.event), interruptType: body.event === 'day_interrupt' ? getInterruptType(body) : undefined });
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', generationConfig: { temperature: 1.15, maxOutputTokens: body.event === 'day_interrupt' ? 60 : 120 } });
    const result = await model.generateContent(buildPrompt(body));
    const text = result.response.text().trim();
    if (!text || text.length < 8) return NextResponse.json({ narration: getFallback(body.event), interruptType: body.event === 'day_interrupt' ? getInterruptType(body) : undefined });
    return NextResponse.json({ narration: text, interruptType: body.event === 'day_interrupt' ? getInterruptType(body) : undefined });
  } catch (err) {
    console.error('[narrator]', err);
    return NextResponse.json({ narration: getFallback(body.event ?? 'night_death'), interruptType: body.event === 'day_interrupt' ? getInterruptType(body) : undefined });
  }
}
