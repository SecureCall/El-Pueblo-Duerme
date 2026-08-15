import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { z } from 'zod';

const PresenceSchema = z.object({
  gameId: z.string().trim().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let input: z.infer<typeof PresenceSchema>;
  try {
    input = PresenceSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Datos de entrada inválidos' }, { status: 400 });
  }

  try {
    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(input.gameId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data() ?? {};
      const players = Array.isArray(game.players) ? game.players : [];
      const index = players.findIndex((player: any) => player?.uid === uid);
      if (index < 0) throw new Error('NOT_IN_GAME');

      const updatedPlayers = players.map((player: any, i: number) =>
        i === index ? { ...player, lastSeen: Timestamp.now() } : player
      );
      tx.update(gameRef, { players: updatedPlayers });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
    if (code === 'NOT_IN_GAME') return NextResponse.json({ error: 'No perteneces a esta partida' }, { status: 403 });
    console.error('game/presence failed', error);
    return NextResponse.json({ error: 'No se pudo actualizar la presencia' }, { status: 500 });
  }
}