import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * POST /api/banshee-prediction
 * Server-authoritative write for the Banshee's daytime prediction.
 */
export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { gameId, targetUid, round } = body as {
      gameId?: unknown;
      targetUid?: unknown;
      round?: unknown;
    };

    if (typeof gameId !== 'string' || !gameId.trim() || typeof targetUid !== 'string' || !targetUid.trim()) {
      return NextResponse.json({ error: 'gameId y targetUid requeridos' }, { status: 400 });
    }
    if (!Number.isInteger(round) || (round as number) < 1) {
      return NextResponse.json({ error: 'round inválido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');

      const game = snap.data() ?? {};
      if (game.phase !== 'day') throw new Error('DAY_CLOSED');
      if (game.roundNumber !== round) throw new Error('STALE_ROUND');

      const players = Array.isArray(game.players) ? game.players : [];
      const me = players.find((p: any) => p?.uid === tokenUid);
      const target = players.find((p: any) => p?.uid === targetUid);
      const role = game.roles?.[tokenUid];

      if (!me?.isAlive || role !== 'Banshee') throw new Error('BANSHEE_NOT_ELIGIBLE');
      if (!target?.isAlive || target.uid === tokenUid) throw new Error('TARGET_NOT_ELIGIBLE');

      // One prediction per round. The field is reset/consumed by the existing
      // round lifecycle; clients cannot overwrite it through Firestore rules.
      if (game.bansheePredictionUid) throw new Error('PREDICTION_ALREADY_SUBMITTED');

      tx.update(gameRef, {
        bansheePredictionUid: targetUid,
        bansheePredictionRound: round,
      });
    });

    return NextResponse.json({ ok: true, round });
  } catch (err: any) {
    const code = err instanceof Error ? err.message : '';
    const known: Record<string, { status: number; error: string }> = {
      GAME_NOT_FOUND: { status: 404, error: 'Partida no encontrada' },
      DAY_CLOSED: { status: 409, error: 'La predicción solo está disponible durante el día' },
      STALE_ROUND: { status: 409, error: 'La ronda ya ha cambiado' },
      BANSHEE_NOT_ELIGIBLE: { status: 403, error: 'Jugador no elegible para esta predicción' },
      TARGET_NOT_ELIGIBLE: { status: 403, error: 'Objetivo no válido o muerto' },
      PREDICTION_ALREADY_SUBMITTED: { status: 409, error: 'La predicción ya fue enviada esta ronda' },
    };
    if (known[code]) return NextResponse.json({ error: known[code].error }, { status: known[code].status });
    console.error('[banshee-prediction]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
