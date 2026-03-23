import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AIPlayer {
  uid: string;
  name: string;
  role: string;
  isWolf: boolean;
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
- Muestra "preocupación" falsa por el pueblo
- Usa frases como "Hay algo raro en..." o "¿No os parece sospechoso que...?"`;

const VILLAGE_INSTRUCTIONS = `Eres un aldeano inocente tratando de encontrar a los lobos.
- Debate activamente sobre quién puede ser el lobo
- Usa tu lógica e intuición
- Puedes defender a otros o señalar comportamientos sospechosos`;

const SEER_INSTRUCTIONS = `Eres un vidente. Tienes información, pero no puedes revelar tu rol directamente.
- Da pistas sutiles sobre quién es el lobo sin revelar que eres el vidente
- Usa frases como "Tengo una corazonada sobre..." o "Algo me dice que..."`;

function getRoleStyle(role: string, isWolf: boolean): string {
  if (isWolf) return WOLF_INSTRUCTIONS;
  if (role === 'Vidente' || role === 'Profeta') return SEER_INSTRUCTIONS;
  return VILLAGE_INSTRUCTIONS;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
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
      .map(p => `- ${p.name} (rol secreto: ${p.role}${p.isWolf ? ', LOBO' : ''})`)
      .join('\n');

    const prompt = `Eres el narrador de un juego de rol "El Pueblo Duerme" (Werewolf/Mafia). Es el DÍA ${round}.
${contextInfo}
Los jugadores vivos son: ${namesStr}.

Debes generar mensajes de chat para estos jugadores IA durante el debate del pueblo:
${playersDesc}

INSTRUCCIONES CRÍTICAS:
- Cada mensaje debe estar en ESPAÑOL natural y coloquial
- Máximo 15 palabras por mensaje (como un chat de móvil)
- Los mensajes deben sonar como personas reales hablando, con errores tipográficos ocasionales, abreviaciones, etc.
- NO uses saludos formales ni lenguaje de IA
- Cada jugador tiene su propia personalidad y estilo
- Contexto: acaban de ver quién murió y están debatiendo a quién votar

${aiPlayers.map(p => `JUGADOR "${p.name}" (${getRoleStyle(p.role, p.isWolf)})`).join('\n\n')}

Responde SOLO con un objeto JSON válido con este formato exacto:
{
  "messages": [
    {"uid": "${aiPlayers[0]?.uid}", "name": "${aiPlayers[0]?.name}", "text": "mensaje aquí"},
    ...
  ]
}

Genera 1-2 mensajes por jugador. Si hay 5+ jugadores, genera solo 1 por jugador. Los mensajes deben ser variados y coherentes con el debate.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ messages: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ messages: parsed.messages ?? [] });

  } catch (error) {
    console.error('ai-chat error:', error);
    return NextResponse.json({ messages: [] }, { status: 200 });
  }
}
