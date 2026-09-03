import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';

const ERRORS: Record<string, [string, number]> = {
  GAME_NOT_FOUND: ['Partida no encontrada', 404],
  NOT_IN_GAME: ['No estás en esta partida', 409],
  NOT_LOBBY: ['La partida ya no está en el lobby', 409],
  HOST_CANNOT_LEAVE: ['El anfitrión no puede salir sin transferir el lobby', 409],
};

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    let deleted = false;
    let newHostUid: string | null = null;

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data()!;
      if (game.status !== 'lobby' || game.phase !== 'lobby') throw new Error('NOT_LOBBY');

      const players = Array.isArray(game.players) ? game.players : [];
      const me = players.find((p: any) => p?.uid === uid);
      if (!me) throw new Error('NOT_IN_GAME');

      const remaining = players.filter((p: any) => p?.uid !== uid);
      const remainingHumans = remaining.filter((p: any) => !p?.isAI);

      if (me.isHost && remainingHumans.length === 0) {
        tx.delete(gameRef);
        deleted = true;
        return;
      }

      if (me.isHost) {
        const newHost = remainingHumans[0];
        if (!newHost?.uid) throw new Error('HOST_CANNOT_LEAVE');
        newHostUid = newHost.uid;
        const nextPlayers = remaining.map((p: any) => ({
          ...p,
          isHost: p.uid === newHost.uid,
        }));
        tx.update(gameRef, {
          players: nextPlayers,
          playerCount: nextPlayers.length,
          hostUid: newHost.uid,
          hostName: newHost.name || 'Jugador',
        });
        return;
      }

      tx.update(gameRef, {
        players: remaining,
        playerCount: remaining.length,
      });
    });

    return NextResponse.json({ ok: true, deleted, newHostUid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL';
    const [error, status] = ERRORS[message] ?? ['Error interno', 500];
    console.error('[lobby-leave]', message);
    return NextResponse.json({ error }, { status });
  }
}
