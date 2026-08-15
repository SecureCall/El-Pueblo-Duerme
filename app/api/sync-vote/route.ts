/**
 * POST /api/sync-vote
 * Background Sync / client vote endpoint.
 * The server is authoritative for phase, round, voter and target.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const MAX_GAME_ID_LENGTH = 64;

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { gameId, uid, target } = body as {
      gameId?: unknown;
      uid?: unknown;
      target?: unknown;
    };

    if (
      typeof gameId !== 'string' || gameId.length === 0 || gameId.length > MAX_GAME_ID_LENGTH ||
      typeof uid !== 'string' || typeof target !== 'string' ||
      uid.length === 0 || target.length === 0
    ) {
      return NextResponse.json({ error: 'Datos de voto inválidos' }, { status: 400 });
    }

    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    const result = await db.runTransaction(async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) {
        return { status: 404, body: { error: 'Partida no encontrada' } };
      }

      const gameData = gameSnap.data()!;
      const phase = gameData.phase;
      const currentRound = Number(gameData.roundNumber ?? 1);

      // A vote is only authoritative during the voting phase.
      if (phase !== 'voting') {
        return { status: 409, body: { error: 'No es fase de votación' } };
      }

      const players: { uid: string; isAlive: boolean }[] = Array.isArray(gameData.players)
        ? gameData.players
        : [];
      const voter = players.find(p => p.uid === uid);
      const targetPlayer = players.find(p => p.uid === target);

      if (!voter?.isAlive) {
        return { status: 403, body: { error: 'Jugador no válido o muerto' } };
      }
      if (!targetPlayer?.isAlive || target === uid) {
        return { status: 403, body: { error: 'Objetivo no válido' } };
      }

      const voteRef = gameRef.collection('votes').doc(uid);
      const existing = await tx.get(voteRef);
      const existingData = existing.exists ? existing.data() : null;

      // Idempotent retry: the same vote can safely be submitted again after
      // a network retry, but a player cannot change a vote after it is stored.
      if (existingData?.round === currentRound) {
        if (existingData.target === target) {
          return { status: 200, body: { ok: true, idempotent: true } };
        }
        return { status: 409, body: { error: 'El voto de esta ronda ya fue registrado' } };
      }

      tx.set(voteRef, {
        target,
        round: currentRound,
        submittedAt: Date.now(),
        syncedAt: Date.now(),
      });

      return { status: 200, body: { ok: true } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: unknown) {
    console.error('[sync-vote]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
