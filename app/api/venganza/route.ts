import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const targetUid = typeof body.targetUid === 'string' ? body.targetUid.trim() : '';
    const round = Number.isInteger(body.round) ? body.round : null;

    if (!gameId || !targetUid || round === null || targetUid === uid) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');

      const game = snap.data()!;
      if (game.phase !== 'day' && game.phase !== 'voting') throw new Error('INVALID_PHASE');
      if (game.roundNumber !== round) throw new Error('STALE_ROUND');

      const players = Array.isArray(game.players) ? game.players : [];
      const victim = players.find((p: any) => p?.uid === uid);
      const target = players.find((p: any) => p?.uid === targetUid);

      if (!victim || victim.isAlive !== false) throw new Error('NOT_DEAD');
      if (!target || target.isAlive !== true) throw new Error('INVALID_TARGET');

      const existing = game.cursed;
      if (existing?.byUid === uid && existing?.round === round) {
        throw new Error('ALREADY_USED');
      }

      tx.update(gameRef, {
        cursed: {
          uid: targetUid,
          byName: victim.name ?? 'Jugador',
          byUid: uid,
          round,
        },
        narratorBroadcast: {
          text: `Con su último aliento, ${victim.name ?? 'Jugador'} lanza su maldición sobre ${target.name ?? 'Jugador'}. El destino ya está escrito.`,
          type: 'chaos',
          triggeredAt: Date.now(),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'INTERNAL';
    const errors: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Partida no encontrada', 404],
      INVALID_PHASE: ['La venganza no está disponible ahora', 409],
      STALE_ROUND: ['Ronda obsoleta', 409],
      NOT_DEAD: ['Solo un jugador eliminado puede usar la venganza', 403],
      INVALID_TARGET: ['El objetivo ya no está disponible', 409],
      ALREADY_USED: ['La venganza ya fue utilizada', 409],
    };
    const [error, status] = errors[code] ?? ['Error interno', 500];
    console.error('[venganza]', code);
    return NextResponse.json({ error }, { status });
  }
}
