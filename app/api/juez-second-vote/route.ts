import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const SECOND_VOTE_MS = 35_000;
const ALLOWED_PHASES = new Set(['day', 'voting']);

type Player = { uid?: string; isAlive?: boolean };

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const roleRef = gameRef.collection('playerRoles').doc(tokenUid);
    const now = Date.now();

    await db.runTransaction(async tx => {
      const [gameSnap, roleSnap] = await Promise.all([tx.get(gameRef), tx.get(roleRef)]);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      if (!roleSnap.exists || roleSnap.data()?.role !== 'Juez') throw new Error('ROLE_INVALID');

      const game = gameSnap.data() as Record<string, unknown>;
      const players = Array.isArray(game.players) ? game.players as Player[] : [];
      const me = players.find(p => p.uid === tokenUid);
      if (!me?.isAlive) throw new Error('PLAYER_INVALID');
      if (!ALLOWED_PHASES.has(String(game.phase))) throw new Error('PHASE_CLOSED');
      if (game.juezUsed === true) throw new Error('ALREADY_USED');

      const phaseEndsAt = typeof game.phaseEndsAt === 'number' ? game.phaseEndsAt : null;
      if (phaseEndsAt !== null && now >= phaseEndsAt) throw new Error('PHASE_EXPIRED');

      tx.update(gameRef, {
        dayVotes: {},
        juezUsed: true,
        dayStartedAt: now,
        phaseEndsAt: now + SECOND_VOTE_MS,
      });
    });

    return NextResponse.json({ ok: true, gameId, phaseEndsAt: now + SECOND_VOTE_MS });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'INTERNAL';
    const errors: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Partida no encontrada', 404],
      ROLE_INVALID: ['Solo el Juez puede solicitar la segunda votación', 403],
      PLAYER_INVALID: ['El Juez no está vivo o no pertenece a la partida', 403],
      PHASE_CLOSED: ['La segunda votación no está disponible en esta fase', 409],
      ALREADY_USED: ['El Juez ya utilizó su segunda votación', 409],
      PHASE_EXPIRED: ['El tiempo de la votación ya ha terminado', 409],
    };
    const [message, status] = errors[code] ?? ['Error interno', 500];
    if (status >= 500) console.error('[juez-second-vote]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
