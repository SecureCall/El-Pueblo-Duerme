import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AIWolf { uid: string; name: string; }
interface AlivePl  { uid: string; name: string; }

interface RequestBody {
  humanMessage: string;
  humanName: string;
  aiWolves: AIWolf[];
  alivePlayers: AlivePl[];
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { humanMessage, humanName, aiWolves, alivePlayers } = body;

    if (!aiWolves || aiWolves.length === 0) return NextResponse.json({ messages: [], targetUid: null });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const namesStr = alivePlayers.map(p => p.name).join(', ');
    const botsStr  = aiWolves.map(p => p.name).join(', ');

    const prompt = `Eres el narrador de "El Pueblo Duerme" (Werewolf). Es la fase de noche y estás en el CHAT PRIVADO DE LOS LOBOS.

El lobo humano "${humanName}" ha escrito: "${humanMessage}"

Jugadores vivos: ${namesStr}
Lobos bot (deben RESPONDER): ${botsStr}

TAREA 1 — Detecta si "${humanName}" propone matar a alguien. Si es así, devuelve el nombre exacto del jugador que quieren matar (debe coincidir con uno de los jugadores vivos).

TAREA 2 — Genera 1 mensaje CORTO de acuerdo (máx 8 palabras) por cada lobo bot. Deben estar de acuerdo con lo que dijo el humano. Si propone matar a alguien, deben apoyarlo. Usa español coloquial, sin formalismos.

Ejemplos de mensajes de acuerdo:
- "sí dale"
- "de acuerdo, a por él"
- "perfecto, yo también lo veía raro"
- "sí, esa es la víctima"
- "ok"

Responde SOLO con JSON válido:
{
  "proposedTarget": "NombreDelJugador o null si no propone a nadie",
  "messages": [
    {"uid": "uid-del-bot", "name": "NombreBot", "text": "mensaje corto"}
  ]
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ messages: [], targetUid: null });

    const parsed = JSON.parse(jsonMatch[0]);
    const proposedName: string | null = parsed.proposedTarget ?? null;

    let targetUid: string | null = null;
    if (proposedName && proposedName !== 'null') {
      const normalizedProposed = proposedName.toLowerCase().trim();
      const match = alivePlayers.find(p =>
        p.name.toLowerCase().trim() === normalizedProposed ||
        normalizedProposed.includes(p.name.toLowerCase().trim()) ||
        p.name.toLowerCase().trim().includes(normalizedProposed)
      );
      if (match) targetUid = match.uid;
    }

    return NextResponse.json({ messages: parsed.messages ?? [], targetUid });

  } catch (err) {
    console.error('wolf-agree error:', err);
    return NextResponse.json({ messages: [], targetUid: null });
  }
}
