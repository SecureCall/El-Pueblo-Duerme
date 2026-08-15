import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { z } from 'zod';

const Schema = z.object({ gameId: z.string().trim().min(1).max(128) });

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let input: z.infer<typeof Schema>;
  try {
    input = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  try {
    initAdminApp();
    const db = getFirestore();
    const ref = db.collection('games').doc(input.gameId);
    let deleted = false;

    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');

      const game = snap.data() ?? {};
      if (game.status !== 'lobby') throw new Error('GAME_STARTED');

      const players = Array.isArray(game.players) ? game.players : [];
      const me = players.find((p: any) => p?.uid === uid);
      if (!me) throw new Error('NOT_IN_GAME');

      const remainingHumans = players.filter((p: any) => !p?.isAI && p?.uid !== uid);
      if (remainingHumans.length === 0 && game.isPublic) {
        tx.delete(ref);
        deleted = true;
        return;
      }

      let nextPlayers = players.filter((p: any) => p?.uid !== uid);
      const patch: Record<string, unknown> = {
        players: nextPlayers,
        playerCount: nextPlayers.length,
      };

      if (me.isHost && remainingHumans.length > 0) {
        const newHost = remainingHumans[0];
        nextPlayers = nextPlayers.map((p: any) => ({ ...p, isHost: p.uid === newHost.uid }));
        patch.players = nextPlayers;
        patch.hostUid = newHost.uid;
        patch.hostName = newHost.name;
      }

      tx.update(ref, patch);
    });

    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
    if (code === 'GAME_STARTED') return NextResponse.json({ error: 'La partida ya ha comenzado' }, { status: 409 });
    if (code === 'NOT_IN_GAME') return NextResponse.json({ error: 'No perteneces a esta partida' }, { status: 403 });
    console.error('game/leave failed', error);
    return NextResponse.json({ error: 'No se pudo salir de la sala' }, { status: 500 });
  }
}
