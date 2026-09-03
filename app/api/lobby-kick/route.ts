import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const ERRORS: Record<string, [string, number]> = {
  GAME_NOT_FOUND: ['Partida no encontrada', 404],
  NOT_HOST: ['Solo el host puede expulsar jugadores', 403],
  NOT_LOBBY: ['La partida ya no está en el lobby', 409],
  INVALID_TARGET: ['Jugador objetivo inválido', 400],
  TARGET_NOT_FOUND: ['El jugador ya no está en la partida', 409],
};

type Player = Record<string, unknown>;

export async function POST(req: NextRequest) {
  const token = await verifyAuthToken(req);
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const targetUid = typeof body.targetUid === 'string' ? body.targetUid.trim() : '';
    if (!gameId || !targetUid || targetUid === token) {
      throw new Error('INVALID_TARGET');
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');

      const game = snap.data()!;
      if (game.hostUid !== token) throw new Error('NOT_HOST');
      if (game.status !== 'lobby' || game.phase !== 'lobby') throw new Error('NOT_LOBBY');

      const players = Array.isArray(game.players) ? game.players as Player[] : [];
      const target = players.find(p => p.uid === targetUid);
      if (!target) throw new Error('TARGET_NOT_FOUND');
      if (target.uid === game.hostUid) throw new Error('INVALID_TARGET');

      const nextPlayers = players.filter(p => p.uid !== targetUid);
      tx.update(gameRef, {
        players: nextPlayers,
        playerCount: nextPlayers.length,
      });
    });

    return NextResponse.json({ ok: true, kickedUid: targetUid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL';
    const [error, status] = ERRORS[message] ?? ['Error interno', 500];
    console.error('[lobby-kick]', message);
    return NextResponse.json({ error }, { status });
  }
}
