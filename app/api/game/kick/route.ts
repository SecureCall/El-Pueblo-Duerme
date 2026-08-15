import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { z } from 'zod';

const Schema = z.object({
  gameId: z.string().trim().min(1).max(128),
  targetUid: z.string().trim().min(1).max(256),
});

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let input: z.infer<typeof Schema>;
  try { input = Schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }); }
  if (uid === input.targetUid) return NextResponse.json({ error: 'No puedes expulsarte a ti mismo' }, { status: 400 });

  try {
    initAdminApp();
    const db = getFirestore();
    const ref = db.collection('games').doc(input.gameId);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data() ?? {};
      if (game.status !== 'lobby') throw new Error('GAME_STARTED');
      if (game.hostUid !== uid) throw new Error('NOT_HOST');
      const players = Array.isArray(game.players) ? game.players : [];
      if (!players.some((p: any) => p?.uid === input.targetUid)) throw new Error('TARGET_NOT_FOUND');
      const nextPlayers = players.filter((p: any) => p?.uid !== input.targetUid);
      tx.update(ref, { players: nextPlayers, playerCount: nextPlayers.length });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
    if (code === 'GAME_STARTED') return NextResponse.json({ error: 'La partida ya ha comenzado' }, { status: 409 });
    if (code === 'NOT_HOST') return NextResponse.json({ error: 'Solo el anfitrión puede expulsar jugadores' }, { status: 403 });
    if (code === 'TARGET_NOT_FOUND') return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
    console.error('game/kick failed', error);
    return NextResponse.json({ error: 'No se pudo expulsar al jugador' }, { status: 500 });
  }
}
