import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);

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
    const { gameId, humanMessage, aiWolves } = body;
    if (!gameId || typeof humanMessage !== 'string' || humanMessage.length > 500 || !Array.isArray(aiWolves)) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }
    if (aiWolves.length > 32) return NextResponse.json({ error: 'Equipo IA inválido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });

    const game = gameSnap.data()!;
    const players = Array.isArray(game.players)
      ? game.players.filter((p: any) => p && typeof p.uid === 'string' && typeof p.name === 'string')
      : [];
    const caller = players.find((p: any) => p.uid === uid);
    if (!caller || caller.isAlive === false || game.phase !== 'night') {
      return NextResponse.json({ error: 'No autorizado para esta acción' }, { status: 403 });
    }

    const callerRoleSnap = await gameRef.collection('playerRoles').doc(uid).get();
    const callerRole = callerRoleSnap.data()?.role;
    if (typeof callerRole !== 'string' || !WOLF_ROLES.has(callerRole)) {
      return NextResponse.json({ error: 'No eres parte del equipo de lobos' }, { status: 403 });
    }

    const playerByUid = new Map(players.map((p: any) => [p.uid, p]));
    const aiRoleEntries = await Promise.all(
      aiWolves.map(async (bot) => {
        if (!bot || typeof bot.uid !== 'string' || typeof bot.name !== 'string') return null;
        const player = playerByUid.get(bot.uid);
        if (!player || player.isAlive === false || player.name !== bot.name) return null;
        const roleSnap = await gameRef.collection('playerRoles').doc(bot.uid).get();
        const role = roleSnap.data()?.role;
        return typeof role === 'string' && WOLF_ROLES.has(role) ? { player, role } : null;
      }),
    );
    if (aiRoleEntries.some((entry) => !entry)) {
      return NextResponse.json({ error: 'Equipo IA inválido' }, { status: 400 });
    }

    if (aiWolves.length === 0) return NextResponse.json({ messages: [], targetUid: null });

    const canonicalAlivePlayers: AlivePl[] = players
      .filter((p: any) => p.isAlive !== false)
      .map((p: any) => ({ uid: p.uid, name: p.name }));
    const canonicalAiWolves = aiWolves.map((bot) => ({
      uid: bot.uid,
      name: playerByUid.get(bot.uid)!.name,
    }));

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const namesStr = canonicalAlivePlayers.map(p => p.name).join(', ');
    const botsStr = canonicalAiWolves.map(p => p.name).join(', ');
    const prompt = `Eres el narrador de "El Pueblo Duerme" (Werewolf). Es la fase de noche y estás en el CHAT PRIVADO DE LOS LOBOS.\n\nEl lobo humano "${caller.name}" ha escrito: "${humanMessage}"\n\nJugadores vivos: ${namesStr}\nLobos bot (deben RESPONDER): ${botsStr}\n\nTAREA 1 — Detecta si "${caller.name}" propone matar a alguien. Si es así, devuelve el nombre exacto del jugador que quieren matar (debe coincidir con uno de los jugadores vivos).\nTAREA 2 — Genera 1 mensaje CORTO de acuerdo (máx 8 palabras) por cada lobo bot.\n\nResponde SOLO con JSON válido:\n{"proposedTarget":"NombreDelJugador o null","messages":[{"uid":"uid-del-bot","name":"NombreBot","text":"mensaje corto"}]}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ messages: [], targetUid: null });
    const parsed = JSON.parse(jsonMatch[0]);
    const proposedName: string | null = typeof parsed.proposedTarget === 'string' ? parsed.proposedTarget : null;
    let targetUid: string | null = null;
    if (proposedName && proposedName !== 'null') {
      const normalized = proposedName.toLowerCase().trim();
      const match = canonicalAlivePlayers.find(p => p.name.toLowerCase().trim() === normalized);
      if (match) targetUid = match.uid;
    }

    const allowedBotIds = new Set(canonicalAiWolves.map(p => p.uid));
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
        .filter((m: any) => m && allowedBotIds.has(m.uid))
        .map((m: any) => ({
          uid: m.uid,
          name: canonicalAiWolves.find(p => p.uid === m.uid)!.name,
          text: typeof m.text === 'string' ? m.text.slice(0, 120) : '',
        }))
        .filter((m: any) => m.text)
      : [];
    return NextResponse.json({ messages, targetUid });
  } catch (err) {
    console.error('wolf-agree error:', err);
    return NextResponse.json({ messages: [], targetUid: null });
  }
}
