import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const ERRORS: Record<string, [string, number]> = {
  GAME_NOT_FOUND: ['Partida no encontrada', 404],
  NOT_LOBBY: ['La partida ya no está disponible para unirse', 409],
  GAME_FULL: ['La partida está llena', 409],
  ALREADY_JOINED: ['Ya estás en la partida', 409],
  INVALID_NAME: ['Nombre de jugador inválido', 400],
};

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const requestedName = typeof body.name === 'string' ? body.name.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const auth = getAuth();
    const user = await auth.getUser(uid);
    const gameRef = db.collection('games').doc(gameId);

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data()!;
      if (game.status !== 'lobby' || game.phase !== 'lobby') throw new Error('NOT_LOBBY');

      const players = Array.isArray(game.players) ? game.players : [];
      if (players.some((p: any) => p?.uid === uid)) throw new Error('ALREADY_JOINED');
      const maxPlayers = Number.isInteger(game.maxPlayers) ? game.maxPlayers : 0;
      if (maxPlayers <= 0 || players.length >= maxPlayers) throw new Error('GAME_FULL');

      const fallbackName = user.displayName || user.email?.split('@')[0] || 'Jugador';
      const name = (requestedName || fallbackName).slice(0, 32).trim();
      if (!name) throw new Error('INVALID_NAME');

      const newPlayer = {
        uid,
        name,
        photoURL: user.photoURL ?? '',
        isHost: false,
        isAlive: true,
        role: null,
        isAI: false,
        level: 1,
        lastSeen: Date.now(),
      };
      const nextPlayers = [...players, newPlayer];
      tx.update(gameRef, {
        players: nextPlayers,
        playerCount: nextPlayers.length,
      });
    });

    return NextResponse.json({ ok: true, uid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL';
    const [error, status] = ERRORS[message] ?? ['Error interno', 500];
    console.error('[lobby-join]', message);
    return NextResponse.json({ error }, { status });
  }
}
