import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { validatePrivateRoleSnapshot } from '@/lib/server/startNightValidation';

/**
 * Server-authoritative roleReveal -> night transition.
 * Secret night submissions live exclusively in the server-side
 * nightSubmissions subcollection; they are never initialized on the public
 * games/{gameId} document because Firestore reads are document-wide.
 */
export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId es requerido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data() ?? {};

      if (game.hostUid !== uid) throw new Error('NOT_HOST');
      if (game.phase !== 'roleReveal') throw new Error('INVALID_PHASE');
      if (!Array.isArray(game.players) || game.players.length < 1) throw new Error('NO_PLAYERS');

      const privateRoles: Record<string, unknown> = {};
      for (const player of game.players) {
        if (!player || typeof player !== 'object' || typeof player.uid !== 'string' || !player.uid) {
          throw new Error('ROLES_NOT_ASSIGNED');
        }
        const roleSnap = await tx.get(gameRef.collection('playerRoles').doc(player.uid));
        if (!roleSnap.exists) throw new Error('ROLES_NOT_ASSIGNED');
        privateRoles[player.uid] = roleSnap.data()?.role;
      }

      if (!validatePrivateRoleSnapshot({
        players: game.players,
        privateRoles,
      })) {
        throw new Error('ROLES_NOT_ASSIGNED');
      }

      const now = Date.now();
      const roundNumber = Number.isInteger(game.roundNumber) && game.roundNumber >= 1 ? game.roundNumber : 1;

      tx.update(gameRef, {
        phase: 'night',
        roundNumber,
        nightStartedAt: now,
        phaseEndsAt: now + 60_000,
      });

      return { roundNumber, nightStartedAt: now, phaseEndsAt: now + 60_000 };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    if (code === 'NOT_HOST') return NextResponse.json({ error: 'Solo el anfitrión puede iniciar la noche' }, { status: 403 });
    if (code === 'INVALID_PHASE') return NextResponse.json({ error: 'La partida ya no está en revelación de roles' }, { status: 409 });
    if (code === 'NO_PLAYERS') return NextResponse.json({ error: 'La partida no tiene jugadores' }, { status: 409 });
    if (code === 'ROLES_NOT_ASSIGNED') return NextResponse.json({ error: 'Los roles todavía no están asignados' }, { status: 409 });
    console.error('[start-night]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}