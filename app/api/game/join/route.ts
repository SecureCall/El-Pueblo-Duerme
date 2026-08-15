import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { z } from 'zod';

const JoinGameSchema = z.object({
  gameId: z.string().trim().min(1).max(128),
  playerName: z.string().trim().min(1).max(30),
});

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let input: z.infer<typeof JoinGameSchema>;
  try {
    input = JoinGameSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Datos de entrada inválidos' }, { status: 400 });
  }

  try {
    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(input.gameId);
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');

      const game = gameSnap.data() ?? {};
      if (game.status !== 'lobby' && game.phase !== 'lobby') {
        throw new Error('GAME_NOT_JOINABLE');
      }

      const players = Array.isArray(game.players) ? game.players : [];
      const existing = players.find((player: any) => player?.uid === uid);
      if (existing) {
        return { alreadyJoined: true, playerCount: players.length };
      }

      const maxPlayers = Number(game.maxPlayers ?? 0);
      if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || players.length >= maxPlayers) {
        throw new Error('GAME_FULL');
      }

      const userSnap = await tx.get(userRef);
      const profile = userSnap.exists ? userSnap.data() ?? {} : {};
      const xp = Number(profile.xp ?? 0);
      const level = Number.isFinite(xp) && xp > 0 ? Math.max(1, Math.floor(xp / 100) + 1) : 1;

      const player = {
        uid,
        name: input.playerName,
        photoURL: typeof profile.photoURL === 'string' ? profile.photoURL : '',
        isHost: false,
        isAlive: true,
        role: null,
        isAI: false,
        level,
        joinedAt: FieldValue.serverTimestamp(),
        lastSeen: Date.now(),
      };

      tx.update(gameRef, {
        players: [...players, player],
        playerCount: players.length + 1,
      });

      return { alreadyJoined: false, playerCount: players.length + 1 };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
    if (code === 'GAME_NOT_JOINABLE') return NextResponse.json({ error: 'La partida ya ha comenzado' }, { status: 409 });
    if (code === 'GAME_FULL') return NextResponse.json({ error: 'La partida está llena' }, { status: 409 });
    console.error('game/join failed', error);
    return NextResponse.json({ error: 'No se pudo unir a la partida' }, { status: 500 });
  }
}
