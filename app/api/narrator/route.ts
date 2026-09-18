import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export type NarratorEvent = 'day_interrupt';
export type InterruptType = 'warning' | 'suspicion' | 'chaos' | 'irony' | 'accusation';

interface NarratorRequest {
  gameId: string;
  event: NarratorEvent;
  interruptType?: InterruptType;
}

const NARRATOR_PERSONA = `Eres el Narrador de "El Pueblo Duerme", un juego de rol oscuro.
Tu personalidad:
- Dramático y teatral como un escritor gótico
- Sardónico y polémico: te encanta señalar traiciones, patrones de voto sospechosos, cambios de opinión
- Usas los nombres reales de los jugadores
- Hablas en español castellano coloquial oscuro — natural, no formal
- Nunca usas emojis
- Eres conciso: 1-2 frases cortas y poderosas (máx 40 palabras)
- Generas paranoia inmediata`;

const TYPES = new Set<InterruptType>(['warning', 'suspicion', 'chaos', 'irony', 'accusation']);

function buildPrompt(round: number, survivors: string[], interruptType: InterruptType, elapsed: number, silentPlayers: string[], talkingMost: string): string {
  const survivorList = survivors.slice(0, 8).join(', ');
  const silentList = silentPlayers.slice(0, 3).join(', ');
  const roundInfo = `Ronda ${round}. Sobrevivientes: ${survivorList}.`;
  let focus = '';
  if (interruptType === 'suspicion' && silentList) focus = `Estos jugadores no han dicho nada: ${silentList}. El silencio delata.`;
  else if (interruptType === 'accusation' && talkingMost) focus = `${talkingMost} lleva hablando sin parar. ¿Distracción deliberada?`;
  else if (interruptType === 'chaos') focus = `Han pasado ${elapsed} segundos y el debate va en círculos.`;
  else if (interruptType === 'warning') focus = 'El tiempo se acaba. Alguien aquí todavía no ha mostrado sus cartas.';
  else focus = 'El pueblo debate.';
  return `${NARRATOR_PERSONA}\n\n${roundInfo}\n${focus}\n\nGenera UNA frase corta e inquietante que interrumpa el debate. Máximo 35 palabras. NO empieces con "El narrador" ni con "Nota". Empieza directo.`;
}

const FALLBACKS: Record<InterruptType, string[]> = {
  warning: ['El tiempo se acaba. Alguien aquí todavía no ha mostrado sus cartas.'],
  suspicion: ['Alguien aquí lleva demasiado tiempo callado. Los lobos no gritan, susurran.'],
  chaos: ['El debate gira en círculos. Y mientras discutís, alguien gana tiempo.'],
  irony: ['El pueblo discute. La verdad escucha en silencio.'],
  accusation: ['Fíjate en quien más habla. La distracción también mata.'],
};

function fallback(type: InterruptType): string {
  const list = FALLBACKS[type];
  return list[Math.floor(Math.random() * list.length)];
}

function pickServerPlayers(players: Array<{ name?: unknown; isAlive?: unknown }>): { survivors: string[]; silentPlayers: string[]; talkingMost: string } {
  const alive = players.filter(p => p.isAlive === true && typeof p.name === 'string' && p.name.trim()).map(p => p.name as string);
  const shuffled = [...alive].sort(() => Math.random() - 0.5);
  return {
    survivors: alive,
    silentPlayers: shuffled.slice(0, 2),
    talkingMost: shuffled[shuffled.length - 1] ?? '',
  };
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    const event = body?.event;
    const requestedType = typeof body?.interruptType === 'string' ? body.interruptType as InterruptType : 'irony';

    if (!gameId) return NextResponse.json({ error: 'gameId es requerido' }, { status: 400 });
    if (event !== 'day_interrupt') return NextResponse.json({ error: 'Evento no permitido' }, { status: 400 });
    if (!TYPES.has(requestedType)) return NextResponse.json({ error: 'Tipo de narración inválido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const snap = await db.collection('games').doc(gameId).get();
    if (!snap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });

    const game = snap.data() ?? {};
    if (game.hostUid !== uid) return NextResponse.json({ error: 'Solo el anfitrión puede solicitar narraciones' }, { status: 403 });
    if (game.phase !== 'day') return NextResponse.json({ error: 'La narración solo está disponible durante el día' }, { status: 409 });

    const round = typeof game.roundNumber === 'number' ? game.roundNumber : 1;
    const dayStarted = typeof game.dayStartedAt === 'number' ? game.dayStartedAt : Date.now();
    const elapsed = Math.max(0, Math.floor((Date.now() - dayStarted) / 1000));
    const { survivors, silentPlayers, talkingMost } = pickServerPlayers(Array.isArray(game.players) ? game.players : []);

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ narration: fallback(requestedType), interruptType: requestedType });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 1.15, maxOutputTokens: 60 },
    });
    const result = await model.generateContent(buildPrompt(round, survivors, requestedType, elapsed, silentPlayers, talkingMost));
    const narration = result.response.text().trim();

    return NextResponse.json({
      narration: narration.length >= 8 ? narration : fallback(requestedType),
      interruptType: requestedType,
    });
  } catch (error) {
    console.error('[narrator]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
