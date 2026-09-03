/**
 * POST /api/banshee-prediction
 * Stores the Banshee's prediction through the server, never through a
 * client-side write to the authoritative game document.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const ALLOWED_PHASES = new Set(['day', 'voting']);

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const gameId = typeof body?.gameId === 'string' ? body.gameId : '';
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid : '';
    const round = Number(body?.round);
    if (!gameId || !targetUid || !Number.isInteger(round)) {
      return NextResponse.json({ error: 'gameId, targetUid y round son obligatorios' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const lockRef = gameRef.collection('locks').doc('dayResolution');

    await db.runTransaction(async tx => {
      const [gameSnap, lockSnap] = await Promise.all([tx.get(gameRef), tx.get(lockRef)]);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');

      const game = gameSnap.data()!;
      const currentRound = Number(game.roundNumber ?? 1);
      if (!ALLOWED_PHASES.has(String(game.phase))) throw new Error('PHASE_CLOSED');
      if (!Number.isInteger(currentRound) || round !== currentRound) throw new Error('STALE_ROUND');

      if (lockSnap.exists) {
        const lock = lockSnap.data() as { expiresAt?: number };
        if (typeof lock.expiresAt === 'number' && lock.expiresAt > Date.now()) {
          throw new Error('RESOLUTION_LOCKED');
        }
      }

      const players = Array.isArray(game.players)
        ? game.players as Array<{ uid?: string; isAlive?: boolean; isAI?: boolean }>
        : [];
      const actor = players.find(p => p.uid === tokenUid);
      const target = players.find(p => p.uid === targetUid);

      if (!actor?.isAlive || actor.isAI === true) throw new Error('ACTOR_INVALID');
      if (!target?.isAlive) throw new Error('TARGET_INVALID');

      const roles = game.roles && typeof game.roles === 'object' ? game.roles as Record<string, string> : {};
      if (roles[tokenUid] !== 'Banshee') throw new Error('ROLE_FORBIDDEN');

      // Prediction is one-shot per round. A retry with the same value is
      // idempotent; changing an already submitted prediction is forbidden.
      const existing = typeof game.bansheePredictionUid === 'string' ? game.bansheePredictionUid : '';
      if (existing && existing !== targetUid) throw new Error('ALREADY_SUBMITTED');

      tx.update(gameRef, {
        bansheePredictionUid: targetUid,
        bansheePredictionRound: currentRound,
        bansheePredictionSubmittedAt: Date.now(),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const code = err?.message;
    const statuses: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Partida no encontrada'],
      PHASE_CLOSED: [409, 'La predicción ya no está disponible'],
      STALE_ROUND: [409, 'Ronda no válida o desactualizada'],
      RESOLUTION_LOCKED: [409, 'La resolución del día ya está en curso'],
      ACTOR_INVALID: [403, 'Jugador no válido'],
      TARGET_INVALID: [403, 'Objetivo no válido'],
      ROLE_FORBIDDEN: [403, 'No autorizado para usar esta acción'],
      ALREADY_SUBMITTED: [409, 'La predicción ya fue enviada'],
    };
    const [status, message] = statuses[code] ?? [500, 'Error interno'];
    if (status >= 500) console.error('[banshee-prediction]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
