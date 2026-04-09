import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FALLBACK_BOT_MESSAGES, BOT_CHAT_STYLE, type BotType } from '@/lib/bots/botSystem';

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
  const messages = players.map(p => {
    const bType = (p.botType ?? 'caotico') as BotType;
    const pool = FALLBACK_BOT_MESSAGES[bType];
    const text = pool[Math.floor(Math.random() * pool.length)];
    return { uid: p.uid, name: p.name, text };
  });
  return { messages };
}

export async function POST(req: NextRequest) {
  let body: RequestBody = { aiPlayers: [], round: 1, allAliveNames: [] };
  try {
    body = await req.json();
    const { aiPlayers, eliminatedName, eliminatedRole, round, allAliveNames } = body;

    if (!aiPlayers || aiPlayers.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const contextInfo = eliminatedName
      ? `Esta mañana, ${eliminatedName} fue encontrado/a muerto/a (era ${eliminatedRole ?? 'aldeano'}).`
      : `Esta mañana nadie murió. El pueblo está aliviado pero tenso.`;

    const namesStr = allAliveNames.join(', ');

    const playersDesc = aiPlayers
      .map(p => {
        const bType = (p.botType ?? 'caotico') as BotType;
        const personality = BOT_CHAT_STYLE[bType];
        return `- ${p.name}: ${personality}. ${getRoleStyle(p.role, p.isWolf)}`;
      })
      .join('\n');

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
{
  "messages": [
    {"uid": "uid_aqui", "name": "nombre_aqui", "text": "mensaje"},
    ...
  ]
}

Genera 1 mensaje por jugador.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json(getFallback(aiPlayers));

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ messages: parsed.messages ?? [] });

  } catch (error) {
    console.error('ai-chat error:', error);
    return NextResponse.json(getFallback(body.aiPlayers ?? []));
  }
}
