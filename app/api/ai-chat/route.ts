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
  recentChat?: { name: string; text: string }[];
}

const WOLF_INSTRUCTIONS = `Eres un LOBO disfrazado de aldeano.
- Nunca admitas ser lobo ni hables como si tuvieras información sobrenatural.
- Desvía sospechas de la manada sin defender siempre al mismo jugador.
- Puedes equivocarte, dudar o cambiar de opinión para parecer humano.
- No ataques a alguien sin una razón mínimamente creíble.`;

const VILLAGE_INSTRUCTIONS = `Eres un aldeano inocente.
- Intenta encontrar lobos a partir de contradicciones, votos y comportamiento.
- No sabes los roles de los demás salvo la información propia de tu personaje.
- Puedes sospechar de inocentes y equivocarte.
- No actúes como si conocieras el futuro.`;

const SEER_INSTRUCTIONS = `Eres Vidente/Profeta y tienes información privada sobre algunas personas.
- No reveles tu rol directamente salvo que la situación lo justifique.
- Puedes insinuar o presionar a un sospechoso, pero no inventes información que no tienes.
- Recuerda que revelar demasiado pronto puede hacer que los lobos te maten.`;

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
    const { aiPlayers, eliminatedName, eliminatedRole, round, allAliveNames, recentChat = [] } = body;

    if (!aiPlayers || aiPlayers.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const contextInfo = eliminatedName
      ? `Esta mañana, ${eliminatedName} fue encontrado/a muerto/a (era ${eliminatedRole ?? 'aldeano'}).`
      : `Esta mañana nadie murió. El pueblo está aliviado pero tenso.`;

    const namesStr = allAliveNames.join(', ');
    const chatContext = recentChat.length > 0
      ? `\nConversación reciente del pueblo. Responde a ella cuando tenga sentido; no repitas frases literalmente:\n${recentChat.slice(-12).map(m => `${m.name}: ${m.text}`).join('\n')}`
      : '';

    const playersDesc = aiPlayers
      .map(p => {
        const bType = (p.botType ?? 'caotico') as BotType;
        const personality = BOT_CHAT_STYLE[bType];
        return `- ${p.name} [${p.uid}]: ${personality}. ${getRoleStyle(p.role, p.isWolf)}`;
      })
      .join('\n');

    const prompt = `Eres el director de comportamiento de bots de "El Pueblo Duerme" (Werewolf/Mafia). Es el DÍA ${round}.
${contextInfo}
Los jugadores vivos son: ${namesStr}.${chatContext}

Genera mensajes para estos jugadores IA:
${playersDesc}

REGLAS DE HUMANIDAD:
- Cada mensaje debe reaccionar al estado de la partida o a la conversación cuando sea posible.
- No hagas que todos estén de acuerdo ni que todos acusen.
- No hagas que todos hablen de los mismos jugadores.
- Mantén las personalidades diferenciadas.
- Los bots pueden equivocarse, dudar, corregirse o cambiar de opinión.
- Un lobo debe intentar sobrevivir, pero no parecer artificialmente perfecto.
- Un rol con información privada no puede compartir información que todavía no posee.
- No inventes acciones, muertes o roles que no aparecen en el contexto.
- No uses frases genéricas repetidas si puedes responder a lo que otro jugador dijo.
- Español coloquial natural, como jugadores reales en un chat rápido.
- Máximo 18 palabras por mensaje.
- Algún error tipográfico ocasional está bien, pero no en todos los mensajes.
- Sin saludos formales y sin emojis.

Responde SOLO con JSON válido:
{
  "messages": [
    {"uid": "uid_aqui", "name": "nombre_aqui", "text": "mensaje"}
  ]
}

Genera exactamente 1 mensaje por jugador. Conserva exactamente su uid y nombre.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json(getFallback(aiPlayers));

    const parsed = JSON.parse(jsonMatch[0]);
    const validIds = new Set(aiPlayers.map(p => p.uid));
    const validMessages = Array.isArray(parsed.messages)
      ? parsed.messages
          .filter((m: any) => m && validIds.has(m.uid) && typeof m.text === 'string')
          .map((m: any) => ({
            uid: m.uid,
            name: aiPlayers.find(p => p.uid === m.uid)?.name ?? m.name,
            text: m.text.trim().slice(0, 180),
          }))
      : [];

    return NextResponse.json({ messages: validMessages.length > 0 ? validMessages : getFallback(aiPlayers).messages });

  } catch (error) {
    console.error('ai-chat error:', error);
    return NextResponse.json(getFallback(body.aiPlayers ?? []));
  }
}
