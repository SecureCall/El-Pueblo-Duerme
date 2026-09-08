import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AIWolf { uid: string; name: string; }
interface AlivePl { uid: string; name: string; }
interface RequestBody {
  gameId?: string;
  humanMessage: string;
  humanName: string;
  aiWolves: AIWolf[];
  alivePlayers: AlivePl[];
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json() as RequestBody;
    const { gameId, humanMessage, humanName, aiWolves, alivePlayers } = body;
    if (!gameId || typeof humanMessage !== 'string' || humanMessage.length > 500 || !Array.isArray(aiWolves) || !Array.isArray(alivePlayers)) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }

    initAdminApp();
    const gameSnap = await getFirestore().collection('games').doc(gameId).get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    const game = gameSnap.data()!;
    const caller = Array.isArray(game.players) ? game.players.find((p: any) => p?.uid === uid) : null;
    if (!caller || caller.isAlive === false || game.phase !== 'night') return NextResponse.json({ error: 'No autorizado para esta acción' }, { status: 403 });
    if (game.wolfTeam?.[uid] !== true) return NextResponse.json({ error: 'No eres parte del equipo de lobos' }, { status: 403 });

    const humanIsKnownWolf = game.wolfTeam?.[uid] === true;
    if (!humanIsKnownWolf) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    if (!aiWolves.every(p => game.wolfTeam?.[p.uid] === true && p.name === (game.players?.find((x: any) => x?.uid === p.uid)?.name))) {
      return NextResponse.json({ error: 'Equipo IA inválido' }, { status: 400 });
    }

    if (aiWolves.length === 0) return NextResponse.json({ messages: [], targetUid: null });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const namesStr = alivePlayers.map(p => p.name).join(', ');
    const botsStr = aiWolves.map(p => p.name).join(', ');
    const prompt = `Eres el narrador de "El Pueblo Duerme" (Werewolf). Es la fase de noche y estás en el CHAT PRIVADO DE LOS LOBOS.

El lobo humano "${humanName}" ha escrito: "${humanMessage}"

Jugadores vivos: ${namesStr}
Lobos bot (deben RESPONDER): ${botsStr}

TAREA 1 — Detecta si "${humanName}" propone matar a alguien. Si es así, devuelve el nombre exacto del jugador que quieren matar (debe coincidir con uno de los jugadores vivos).
TAREA 2 — Genera 1 mensaje CORTO de acuerdo (máx 8 palabras) por cada lobo bot.

Responde SOLO con JSON válido:
{"proposedTarget":"NombreDelJugador o null","messages":[{"uid":"uid-del-bot","name":"NombreBot","text":"mensaje corto"}]}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ messages: [], targetUid: null });
    const parsed = JSON.parse(jsonMatch[0]);
    const proposedName: string | null = typeof parsed.proposedTarget === 'string' ? parsed.proposedTarget : null;
    let targetUid: string | null = null;
    if (proposedName && proposedName !== 'null') {
      const normalized = proposedName.toLowerCase().trim();
      const match = alivePlayers.find(p => p.name.toLowerCase().trim() === normalized);
      if (match && game.players?.some((p: any) => p?.uid === match.uid && p?.isAlive !== false)) targetUid = match.uid;
    }

    const allowedBotIds = new Set(aiWolves.map(p => p.uid));
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter((m: any) => m && allowedBotIds.has(m.uid)).map((m: any) => ({ uid: m.uid, name: aiWolves.find(p => p.uid === m.uid)!.name, text: typeof m.text === 'string' ? m.text.slice(0, 120) : '' })).filter((m: any) => m.text)
      : [];
    return NextResponse.json({ messages, targetUid });
  } catch (err) {
    console.error('wolf-agree error:', err);
    return NextResponse.json({ messages: [], targetUid: null });
  }
}
