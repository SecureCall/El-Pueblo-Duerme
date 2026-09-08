import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  const uid = await verifyAuthToken(request);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const targetUid = typeof body.targetUid === 'string' ? body.targetUid.trim() : '';
    if (!gameId || !targetUid) {
      return NextResponse.json({ error: 'gameId y targetUid son obligatorios' }, { status: 400 });
    }
    if (targetUid === uid) {
      return NextResponse.json({ error: 'No puedes expulsarte a ti mismo' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data() as Record<string, unknown>;
      if (game.status !== 'lobby' || game.phase !== 'lobby') throw new Error('LOBBY_CLOSED');
      if (game.hostUid !== uid) throw new Error('NOT_HOST');

      const players = Array.isArray(game.players) ? game.players as Array<Record<string, unknown>> : [];
      const target = players.find((player) => player?.uid === targetUid);
      if (!target) throw new Error('PLAYER_NOT_FOUND');

      const nextPlayers = players.filter((player) => player?.uid !== targetUid);
      tx.update(gameRef, {
        players: nextPlayers,
        playerCount: nextPlayers.length,
      });

      return { playerCount: nextPlayers.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const errors: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Partida no encontrada', 404],
      NOT_HOST: ['Solo el host puede expulsar jugadores', 403],
      LOBBY_CLOSED: ['La sala ya no está en el lobby', 409],
      PLAYER_NOT_FOUND: ['Jugador no encontrado en la sala', 404],
    };
    const [message, status] = errors[code] ?? ['Error interno', 500];
    console.error('[game-lobby-kick]', code);
    return NextResponse.json({ error: message }, { status });
  }
}
