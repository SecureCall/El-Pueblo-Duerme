/**
 * POST /api/sync-vote
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Security: the authenticated Firebase UID and current round/phase come from the server.
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
    const { gameId, target } = body as {
      gameId?: unknown;
      target?: unknown;
    };

    if (typeof gameId !== 'string' || !gameId || typeof target !== 'string' || !target) {
      return NextResponse.json({ error: 'gameId y target son obligatorios' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();

    if (!gameSnap.exists) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    }

    const gameData = gameSnap.data()!;

    // In the current game FSM, daytime is the voting phase.
    if (gameData.phase !== 'day') {
      return NextResponse.json({ error: 'No es fase de votación' }, { status: 409 });
    }

    // Respect the authoritative server-side phase deadline as well as the phase flag.
    const phaseEndsAt = typeof gameData.phaseEndsAt === 'number' ? gameData.phaseEndsAt : null;
    if (phaseEndsAt !== null && Date.now() >= phaseEndsAt) {
      return NextResponse.json({ error: 'La votación ha terminado' }, { status: 409 });
    }

    const players = Array.isArray(gameData.players)
      ? gameData.players as Array<{ uid?: unknown; isAlive?: unknown; isAI?: unknown }>
      : [];

    const voter = players.find(player => player.uid === tokenUid);
    if (!voter || voter.isAlive !== true || voter.isAI === true) {
      return NextResponse.json({ error: 'Jugador no válido o muerto' }, { status: 403 });
    }

    const targetPlayer = players.find(player => player.uid === target);
    if (!targetPlayer || targetPlayer.isAlive !== true) {
      return NextResponse.json({ error: 'Objetivo no válido' }, { status: 403 });
    }

    const round = Number(gameData.roundNumber ?? 1);
    if (!Number.isInteger(round) || round < 1) {
      return NextResponse.json({ error: 'Ronda no válida' }, { status: 409 });
    }

    const now = Date.now();
    await gameRef.collection('votes').doc(tokenUid).set(
      {
        target,
        round,
        submittedAt: now,
        syncedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, round });
  } catch (err) {
    console.error('[sync-vote]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
