/**
 * POST /api/sync-vote
 * Persists one authenticated player's vote after validating the current game state.
 * The server is authoritative for voter identity and round; the client cannot
 * submit a vote for a different round or a player who is not currently alive.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { gameId, uid, target, round } = body as {
      gameId?: unknown;
      uid?: unknown;
      target?: unknown;
      round?: unknown;
    };

    if (typeof gameId !== 'string' || !gameId.trim()) {
      return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });
    }
    if (typeof uid !== 'string' || !uid.trim() || typeof target !== 'string' || !target.trim()) {
      return NextResponse.json({ error: 'uid y target requeridos' }, { status: 400 });
    }
    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    }
    if (!Number.isInteger(round) || (round as number) < 1) {
      return NextResponse.json({ error: 'round inválido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const voteRef = gameRef.collection('votes').doc(tokenUid);

    await db.runTransaction(async tx => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) {
        throw new Error('GAME_NOT_FOUND');
      }

      const gameData = gameSnap.data() ?? {};
      const phase = gameData.phase;
      if (phase !== 'day' && phase !== 'voting') {
        throw new Error('VOTING_CLOSED');
      }

      const currentRound = gameData.roundNumber;
      if (!Number.isInteger(currentRound) || currentRound < 1) {
        throw new Error('INVALID_GAME_ROUND');
      }
      if (round !== currentRound) {
        throw new Error('STALE_ROUND');
      }

      const players = Array.isArray(gameData.players) ? gameData.players : [];
      const voter = players.find((player: any) => player?.uid === tokenUid);
      if (!voter?.isAlive) {
        throw new Error('VOTER_NOT_ELIGIBLE');
      }

      const targetPlayer = players.find((player: any) => player?.uid === target);
      if (!targetPlayer?.isAlive) {
        throw new Error('TARGET_NOT_ELIGIBLE');
      }

      tx.set(voteRef, {
        target,
        round: currentRound,
        submittedAt: Date.now(),
        syncedAt: Date.now(),
      });
    });

    return NextResponse.json({ ok: true, round });
  } catch (err: any) {
    const code = err instanceof Error ? err.message : '';
    const known: Record<string, { status: number; error: string }> = {
      GAME_NOT_FOUND: { status: 404, error: 'Partida no encontrada' },
      VOTING_CLOSED: { status: 409, error: 'No es fase de votación' },
      INVALID_GAME_ROUND: { status: 500, error: 'Ronda de partida inválida' },
      STALE_ROUND: { status: 409, error: 'La ronda de votación ya ha cambiado' },
      VOTER_NOT_ELIGIBLE: { status: 403, error: 'Jugador no válido o muerto' },
      TARGET_NOT_ELIGIBLE: { status: 403, error: 'Objetivo no válido o muerto' },
    };

    const response = known[code];
    if (response) return NextResponse.json({ error: response.error }, { status: response.status });

    console.error('[sync-vote]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
