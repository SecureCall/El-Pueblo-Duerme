import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FALLBACK_BOT_MESSAGES, BOT_CHAT_STYLE, type BotType } from '@/lib/bots/botSystem';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
interface AIPlayer { uid: string; name: string; role: string; isWolf: boolean; botType?: BotType; }
interface RequestBody { aiPlayers: AIPlayer[]; eliminatedName?: string | null; eliminatedRole?: string | null; round: number; allAliveNames: string[]; }
const WOLF_INSTRUCTIONS = `Eres un LOBO disfrazado de aldeano. Debes parecer inocente.\n- Nunca confieses que eres un lobo\n- Acusa a aldeanos reales o desvía la atención\n- Muestra "preocupación" falsa por el pueblo`;
const VILLAGE_INSTRUCTIONS = `Eres un aldeano inocente tratando de encontrar a los lobos.\n- Debate activamente sobre quién puede ser el lobo\n- Usa tu lógica e intuición`;
const SEER_INSTRUCTIONS = `Eres un vidente. Tienes información, pero no puedes revelar tu rol.\n- Da pistas sutiles sobre quién es el lobo`;
function getRoleStyle(role: string, isWolf: boolean): string { if (isWolf) return WOLF_INSTRUCTIONS; if (role === 'Vidente' || role === 'Profeta') return SEER_INSTRUCTIONS; return VILLAGE_INSTRUCTIONS; }
function getFallback(players: AIPlayer[]): { messages: { uid: string; name: string; text: string }[] } { return { messages: players.map(p => { const bType = (p.botType ?? 'caotico') as BotType; const pool = FALLBACK_BOT_MESSAGES[bType]; return { uid: p.uid, name: p.name, text: pool[Math.floor(Math.random() * pool.length)] }; }) }; }

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: RequestBody = { aiPlayers: [], round: 1, allAliveNames: [] };
  try {
    body = await req.json();
    const { aiPlayers, eliminatedName, eliminatedRole, round, allAliveNames } = body;
    if (!Array.isArray(aiPlayers) || aiPlayers.length === 0) return NextResponse.json({ messages: [] });
    if (aiPlayers.length > 32 || !Array.isArray(allAliveNames) || allAliveNames.length > 32 || typeof round !== 'number') return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json(getFallback(aiPlayers));

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const contextInfo = eliminatedName ? `Esta mañana, ${eliminatedName} fue encontrado/a muerto/a (era ${eliminatedRole ?? 'aldeano'}).` : 'Esta mañana nadie murió. El pueblo está aliviado pero tenso.';
    const namesStr = allAliveNames.join(', ');
    const playersDesc = aiPlayers.map(p => { const bType = (p.botType ?? 'caotico') as BotType; return `- ${p.name}: ${BOT_CHAT_STYLE[bType]}. ${getRoleStyle(p.role, p.isWolf)}`; }).join('\n');
    const prompt = `Eres el narrador de "El Pueblo Duerme" (Werewolf/Mafia). Es el DÍA ${round}.\n${contextInfo}\nLos jugadores vivos son: ${namesStr}.\n\nGenera mensajes de chat para estos jugadores IA:\n${playersDesc}\n\nREGLAS:\n- ESPAÑOL coloquial y natural\n- Máximo 12 palabras por mensaje\n- Sin saludos formales\n- Cada jugador tiene su personalidad propia\n- Errores tipográficos ocasionales están bien\n- NO uses emojis\n\nResponde SOLO con JSON válido:\n{"messages":[{"uid":"uid_aqui","name":"nombre_aqui","text":"mensaje"}]}\nGenera 1 mensaje por jugador.`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json(getFallback(aiPlayers));
    const parsed = JSON.parse(jsonMatch[0]);
    const allowed = new Set(aiPlayers.map(p => p.uid));
    const messages = Array.isArray(parsed.messages) ? parsed.messages.filter((m: any) => m && allowed.has(m.uid) && typeof m.text === 'string').map((m: any) => ({ uid: m.uid, name: aiPlayers.find(p => p.uid === m.uid)!.name, text: m.text.slice(0, 160) })) : [];
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('ai-chat error:', error);
    return NextResponse.json(getFallback(body.aiPlayers ?? []));
  }
}
