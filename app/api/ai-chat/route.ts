import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FALLBACK_BOT_MESSAGES, BOT_CHAT_STYLE, type BotType } from '@/lib/bots/botSystem';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AIPlayer {
  uid: string;
  name: string;
  role: string;
  isWolf: boolean;
  botType?: BotType;
}

interface RequestBody {
  aiPlayers: AIPlayer[];
  eliminatedName?: string | null;
  eliminatedRole?: string | null;
  round: number;
  allAliveNames: string[];
}

const WOLF_INSTRUCTIONS = `Eres un LOBO disfrazado de aldeano. Debes parecer inocente.
- Nunca confieses que eres un lobo
- Acusa a aldeanos reales o desvía la atención
- Muestra "preocupación" falsa por el pueblo`;
const VILLAGE_INSTRUCTIONS = `Eres un aldeano inocente tratando de encontrar a los lobos.
- Debate activamente sobre quién puede ser el lobo
- Usa tu lógica e intuición`;
const SEER_INSTRUCTIONS = `Eres un vidente. Tienes información, pero no puedes revelar tu rol.
- Da pistas sutiles sobre quién es el lobo`;

function getRoleStyle(role: string, isWolf: boolean): string {
  if (isWolf) return WOLF_INSTRUCTIONS;
  if (role === 'Vidente' || role === 'Profeta') return SEER_INSTRUCTIONS;
  return VILLAGE_INSTRUCTIONS;
}

function getFallback(players: AIPlayer[]): { messages: { uid: string; name: string; text: string }[] } {
  return {
    messages: players.map(p => {
      const bType = (p.botType ?? 'caotico') as BotType;
      const pool = FALLBACK_BOT_MESSAGES[bType];
      const text = pool[Math.floor(Math.random() * pool.length)];
      return { uid: p.uid, name: p.name, text };
    }),
  };
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: RequestBody = { aiPlayers: [], round: 1, allAliveNames: [] };
  try {
    body = await req.json();
    const { aiPlayers, eliminatedName, eliminatedRole, round, allAliveNames } = body;

    if (!Array.isArray(aiPlayers) || aiPlayers.length === 0 || aiPlayers.length > 10) {
      return NextResponse.json({ messages: [] });
    }
    if (!Number.isInteger(round) || round < 1 || round > 1000) {
      return NextResponse.json({ error: 'Ronda inválida' }, { status: 400 });
    }
    if (!Array.isArray(allAliveNames) || allAliveNames.length > 20 || allAliveNames.some(name => typeof name !== 'string' || name.length > 80)) {
      return NextResponse.json({ error: 'Jugadores inválidos' }, { status: 400 });
    }
    if (aiPlayers.some(p => !p || typeof p.uid !== 'string' || p.uid.length > 128 || typeof p.name !== 'string' || p.name.length > 80)) {
      return NextResponse.json({ error: 'IA inválida' }, { status: 400 });
    }

    // Basic server-side abuse throttle. The game normally needs at most one
    // batch of AI messages per day phase, so repeated calls within 5 seconds
    // are almost certainly retries/abuse.
    initAdminApp();
    const db = getFirestore();
    const usageRef = db.collection('apiUsage').doc(uid);
    const now = Date.now();
    const allowed = await db.runTransaction(async tx => {
      const snap = await tx.get(usageRef);
      const lastAt = snap.exists ? Number(snap.data()?.aiChatLastAt ?? 0) : 0;
      if (now - lastAt < 5000) return false;
      tx.set(usageRef, { aiChatLastAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });
    if (!allowed) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const contextInfo = eliminatedName
      ? `Esta mañana, ${eliminatedName} fue encontrado/a muerto/a (era ${eliminatedRole ?? 'aldeano'}).`
      : `Esta mañana nadie murió. El pueblo está aliviado pero tenso.`;
    const namesStr = allAliveNames.join(', ');
    const playersDesc = aiPlayers.map(p => {
      const bType = (p.botType ?? 'caotico') as BotType;
      return `- ${p.name}: ${BOT_CHAT_STYLE[bType]}. ${getRoleStyle(p.role, p.isWolf)}`;
    }).join('\n');

    const prompt = `Eres el narrador de "El Pueblo Duerme" (Werewolf/Mafia). Es el DÍA ${round}.
${contextInfo}
Los jugadores vivos son: ${namesStr}.

Genera mensajes de chat para estos jugadores IA:
${playersDesc}

REGLAS:
- ESPAÑOL coloquial y natural
- Máximo 12 palabras por mensaje
- Sin saludos formales
- Cada jugador tiene su personalidad propia
- Errores tipográficos ocasionales están bien
- NO uses emojis

Responde SOLO con JSON válido:
{"messages":[{"uid":"uid_aqui","name":"nombre_aqui","text":"mensaje"}]}
Genera 1 mensaje por jugador.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json(getFallback(aiPlayers));

    const parsed = JSON.parse(jsonMatch[0]);
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter((m: any) => m && typeof m.uid === 'string' && typeof m.name === 'string' && typeof m.text === 'string')
          .map((m: any) => ({ uid: m.uid.slice(0, 128), name: m.name.slice(0, 80), text: m.text.slice(0, 240) }))
      : [];
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('ai-chat error:', error);
    return NextResponse.json(getFallback(body.aiPlayers ?? []));
  }
}
