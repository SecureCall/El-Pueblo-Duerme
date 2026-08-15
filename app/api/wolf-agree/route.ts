import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AIWolf { uid: string; name: string; }
interface AlivePl { uid: string; name: string; }
interface RequestBody {
  humanMessage: string;
  humanName: string;
  aiWolves: AIWolf[];
  alivePlayers: AlivePl[];
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body: RequestBody = await req.json();
    const { humanMessage, humanName, aiWolves, alivePlayers } = body;

    if (typeof humanMessage !== 'string' || humanMessage.length > 500) {
      return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 });
    }
    if (typeof humanName !== 'string' || humanName.length > 80) {
      return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
    }
    if (!Array.isArray(aiWolves) || aiWolves.length > 10 || !Array.isArray(alivePlayers) || alivePlayers.length > 20) {
      return NextResponse.json({ error: 'Lista de jugadores inválida' }, { status: 400 });
    }
    if (aiWolves.length === 0) return NextResponse.json({ messages: [], targetUid: null });
    if ([...aiWolves, ...alivePlayers].some(p => !p || typeof p.uid !== 'string' || p.uid.length > 128 || typeof p.name !== 'string' || p.name.length > 80)) {
      return NextResponse.json({ error: 'Jugador inválido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const usageRef = db.collection('apiUsage').doc(uid);
    const now = Date.now();
    const allowed = await db.runTransaction(async tx => {
      const snap = await tx.get(usageRef);
      const lastAt = snap.exists ? Number(snap.data()?.wolfAgreeLastAt ?? 0) : 0;
      if (now - lastAt < 5000) return false;
      tx.set(usageRef, { wolfAgreeLastAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });
    if (!allowed) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });

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
    const proposedName = typeof parsed.proposedTarget === 'string' ? parsed.proposedTarget.trim() : null;
    let targetUid: string | null = null;
    if (proposedName && proposedName.toLowerCase() !== 'null') {
      const normalized = proposedName.toLowerCase();
      const match = alivePlayers.find(p => {
        const name = p.name.toLowerCase().trim();
        return name === normalized || normalized.includes(name) || name.includes(normalized);
      });
      if (match) targetUid = match.uid;
    }

    const allowedBotUids = new Set(aiWolves.map(p => p.uid));
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
          .filter((m: any) => m && allowedBotUids.has(m.uid) && typeof m.name === 'string' && typeof m.text === 'string')
          .map((m: any) => ({ uid: m.uid, name: m.name.slice(0, 80), text: m.text.slice(0, 160) }))
      : [];

    return NextResponse.json({ messages, targetUid });
  } catch (err) {
    console.error('wolf-agree error:', err);
    return NextResponse.json({ messages: [], targetUid: null });
  }
}
