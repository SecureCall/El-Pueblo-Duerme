import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FALLBACK_BOT_MESSAGES, BOT_CHAT_STYLE, type BotType } from '@/lib/bots/botSystem';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { initAdminApp } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
interface AIPlayer { uid: string; name: string; role: string; isWolf: boolean; botType?: BotType; }
interface RequestBody { gameId?: string; }
const WOLF_INSTRUCTIONS = `Eres un LOBO disfrazado de aldeano. Debes parecer inocente.\n- Nunca confieses que eres un lobo\n- Acusa a aldeanos reales o desvía la atención\n- Muestra "preocupación" falsa por el pueblo`;
const VILLAGE_INSTRUCTIONS = `Eres un aldeano inocente tratando de encontrar a los lobos.\n- Debate activamente sobre quién puede ser el lobo\n- Usa tu lógica e intuición`;
const SEER_INSTRUCTIONS = `Eres un vidente. Tienes información, pero no puedes revelar tu rol.\n- Da pistas sutiles sobre quién es el lobo`;
function getRoleStyle(role: string, isWolf: boolean): string { if (isWolf) return WOLF_INSTRUCTIONS; if (role === 'Vidente' || role === 'Profeta') return SEER_INSTRUCTIONS; return VILLAGE_INSTRUCTIONS; }
function getFallback(players: AIPlayer[]): { messages: { uid: string; name: string; text: string }[] } { return { messages: players.map(p => { const bType = (p.botType ?? 'caotico') as BotType; const pool = FALLBACK_BOT_MESSAGES[bType]; return { uid: p.uid, name: p.name, text: pool[Math.floor(Math.random() * pool.length)] }; }) }; }

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({})) as RequestBody;
    if (!body.gameId || typeof body.gameId !== 'string') {
      return NextResponse.json({ error: 'gameId required' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(body.gameId);
    const snap = await gameRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    const game = snap.data() as Record<string, any>;
    if (game.hostUid !== uid || game.phase !== 'day') {
      return NextResponse.json({ error: 'No autorizado para generar chat IA' }, { status: 403 });
    }

    const players = Array.isArray(game.players) ? game.players.filter((p: any) => p && typeof p.uid === 'string') : [];
    const alivePlayers = players.filter((p: any) => p.isAlive === true);
    const aiPlayers: AIPlayer[] = [];
    for (const p of alivePlayers.filter((p: any) => p.isAI === true)) {
      const roleSnap = await gameRef.collection('playerRoles').doc(p.uid).get();
      const role = typeof roleSnap.data()?.role === 'string' ? roleSnap.data()!.role : 'Aldeano';
      aiPlayers.push({
        uid: p.uid,
        name: typeof p.name === 'string' ? p.name : p.uid,
        role,
        isWolf: role === 'Lobo' || role === 'Lobo Blanco' || role === 'Cría de Lobo',
        botType: p.botType ?? 'caotico',
      });
    }
    if (aiPlayers.length === 0) return NextResponse.json({ messages: [] });

    const round = Number.isInteger(game.roundNumber) ? game.roundNumber : 1;
    const eliminatedPlayer = typeof game.dayEliminatedUid === 'string'
      ? players.find((p: any) => p.uid === game.dayEliminatedUid)
      : null;
    const contextInfo = eliminatedPlayer
      ? `Esta mañana, ${eliminatedPlayer.name} fue encontrado/a muerto/a.`
      : 'Esta mañana nadie murió. El pueblo está aliviado pero tenso.';
    const namesStr = alivePlayers.map((p: any) => p.name).join(', ');
    const playersDesc = aiPlayers.map(p => {
      const bType = (p.botType ?? 'caotico') as BotType;
      return `- ${p.name}: ${BOT_CHAT_STYLE[bType]}. ${getRoleStyle(p.role, p.isWolf)}`;
    }).join('\\n');
    let messages = getFallback(aiPlayers).messages;

    if (process.env.GEMINI_API_KEY) {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const prompt = `Eres el narrador de "El Pueblo Duerme" (Werewolf/Mafia). Es el DÍA ${round}.\n${contextInfo}\nLos jugadores vivos son: ${namesStr}.\n\nGenera mensajes de chat para estos jugadores IA:\n${playersDesc}\n\nREGLAS:\n- ESPAÑOL coloquial y natural\n- Máximo 12 palabras por mensaje\n- Sin saludos formales\n- Cada jugador tiene su personalidad propia\n- NO uses emojis\n\nResponde SOLO con JSON válido:\n{"messages":[{"uid":"uid_aqui","name":"nombre_aqui","text":"mensaje"}]}\nGenera 1 mensaje por jugador.`;
      const result = await model.generateContent(prompt);
      const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const allowed = new Set(aiPlayers.map(p => p.uid));
        messages = Array.isArray(parsed.messages)
          ? parsed.messages.filter((m: any) => m && allowed.has(m.uid) && typeof m.text === 'string')
              .map((m: any) => ({ uid: m.uid, name: aiPlayers.find(p => p.uid === m.uid)!.name, text: m.text.slice(0, 160) }))
          : messages;
      }
    }

    const batch = db.batch();
    for (const message of messages) {
      batch.create(gameRef.collection('publicChat').doc(), {
        senderId: message.uid,
        senderName: message.name,
        text: message.text,
        createdAt: new Date(),
        source: 'server-ai-chat',
        round,
      });
    }
    await batch.commit();
    return NextResponse.json({ messages: [] });
  } catch (error) {
    console.error('ai-chat error:', error);
    return NextResponse.json({ messages: [] });
  }
}