/**
 * POST /api/sync-vote
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Body matches PendingVote shape from lib/firebase/backgroundSync.ts
 *
 * Security: validates that uid is a player in the game and the game accepts votes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameId, uid, target, round, submittedAt } = body as {
      gameId: string;
      uid: string;
      target: string;
      round: number;
      submittedAt: number;
    };

    if (!gameId || !uid || !target) {
      return NextResponse.json({ error: 'gameId, uid, target required' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();

    // Validar que el juego existe, está en fase de día y uid es un jugador vivo
    const gameSnap = await db.collection('games').doc(gameId).get();
    if (!gameSnap.exists) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    }
    const gameData = gameSnap.data()!;
    if (gameData.phase !== 'day' && gameData.phase !== 'voting') {
      return NextResponse.json({ error: 'No es fase de votación' }, { status: 409 });
    }
    const players: { uid: string; isAlive: boolean }[] = gameData.players ?? [];
    const isValidPlayer = players.some(p => p.uid === uid && p.isAlive);
    if (!isValidPlayer) {
      return NextResponse.json({ error: 'Jugador no válido' }, { status: 403 });
    }
    const isValidTarget = players.some(p => p.uid === target && p.isAlive);
    if (!isValidTarget) {
      return NextResponse.json({ error: 'Objetivo no válido' }, { status: 403 });
    }

    await db
      .collection('games')
      .doc(gameId)
      .collection('votes')
      .doc(uid)
      .set({ target, round: round ?? gameData.roundNumber, submittedAt, syncedAt: Date.now() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[sync-vote]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
