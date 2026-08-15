import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { z } from 'zod';

const Schema = z.object({ gameId: z.string().trim().min(1).max(128) });

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let input: z.infer<typeof Schema>;
  try { input = Schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }); }
  try {
    initAdminApp();
    const db = getFirestore();
    const ref = db.collection('games').doc(input.gameId);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data() ?? {};
      if (game.status !== 'lobby') throw new Error('NOT_LOBBY');
      if (game.hostUid !== uid) throw new Error('NOT_HOST');
      const players = Array.isArray(game.players) ? game.players : [];
      const humans = players.filter((p: any) => !p?.isAI);
      if (humans.length < 3) throw new Error('NOT_ENOUGH_PLAYERS');
      if (game.fillWithAI && players.length < Number(game.maxPlayers ?? players.length)) throw new Error('NEEDS_AUTOFILL');
      tx.update(ref, { status: 'playing', playerCount: players.length, startedAt: Timestamp.now() });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
    if (code === 'NOT_LOBBY') return NextResponse.json({ error: 'La sala ya no está disponible' }, { status: 409 });
    if (code === 'NOT_HOST') return NextResponse.json({ error: 'Solo el anfitrión puede iniciar' }, { status: 403 });
    if (code === 'NOT_ENOUGH_PLAYERS') return NextResponse.json({ error: 'Se necesitan al menos 3 jugadores' }, { status: 409 });
    if (code === 'NEEDS_AUTOFILL') return NextResponse.json({ error: 'La sala necesita completar los jugadores antes de iniciar' }, { status: 409 });
    console.error('game/start failed', error);
    return NextResponse.json({ error: 'No se pudo iniciar la partida' }, { status: 500 });
  }
}
