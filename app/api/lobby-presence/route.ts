import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';

type GamePlayer = Record<string, unknown>;
const isRecord = (value: unknown): value is GamePlayer =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ERRORS: Record<string, [string, number]> = {
  GAME_NOT_FOUND: ['Partida no encontrada', 404],
  NOT_LOBBY: ['La partida ya no está en el lobby', 409],
  NOT_IN_GAME: ['No estás en esta partida', 409],
};

/**
 * Updates only the authenticated player's lobby presence.
 * The client must never be allowed to replace the complete players array
 * just to refresh lastSeen, because doing so can overwrite concurrent joins,
 * kicks, host transfers or other authoritative state.
 */
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

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');

      const game = snap.data()!;
      if (game.status !== 'lobby' || game.phase !== 'lobby') throw new Error('NOT_LOBBY');

      const players = Array.isArray(game.players) ? game.players.filter(isRecord) : [];
      const index = players.findIndex((player) => player.uid === uid);
      if (index < 0) throw new Error('NOT_IN_GAME');

      const nextPlayers = players.map((player, playerIndex) =>
        playerIndex === index ? { ...player, lastSeen: Date.now() } : player,
      );

      // Keep the complete player object intact; only lastSeen changes.
      // This transaction prevents a stale client snapshot from clobbering
      // concurrent lobby mutations.
      tx.update(gameRef, { players: nextPlayers });
    });

    return NextResponse.json({ ok: true, uid, lastSeen: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL';
    const [error, status] = ERRORS[message] ?? ['Error interno', 500];
    console.error('[lobby-presence]', message);
    return NextResponse.json({ error }, { status });
  }
}
