/**
 * POST /api/sync-vote
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Security: verifies Firebase Auth token and validates the vote against the live game state.
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
      gameId: string;
      uid: string;
      target: string;
      round: number;
    };

    if (!gameId || !uid || !target) {
      return NextResponse.json({ error: 'gameId, uid, target required' }, { status: 400 });
    }

    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();

    if (!gameSnap.exists) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    }

    const gameData = gameSnap.data()!;
    if (gameData.phase !== 'day' && gameData.phase !== 'voting') {
      return NextResponse.json({ error: 'No es fase de votación' }, { status: 409 });
    }

    const currentRound = Number(gameData.roundNumber ?? 1);
    if (round != null && Number(round) !== currentRound) {
      return NextResponse.json({ error: 'Voto de una ronda antigua' }, { status: 409 });
    }

    const players: { uid: string; isAlive: boolean }[] = gameData.players ?? [];
    const voter = players.find(p => p.uid === uid);
    const targetPlayer = players.find(p => p.uid === target);

    if (!voter?.isAlive) {
      return NextResponse.json({ error: 'Jugador no válido o muerto' }, { status: 403 });
    }
    if (!targetPlayer?.isAlive || target === uid) {
      return NextResponse.json({ error: 'Objetivo no válido' }, { status: 403 });
    }

    const banned = new Set<string>(gameData.voteBanned ?? []);
    if (gameData.saboteadorBan) banned.add(gameData.saboteadorBan);
    if (banned.has(uid)) {
      return NextResponse.json({ error: 'No puedes votar esta ronda' }, { status: 403 });
    }

    await gameRef.collection('votes').doc(uid).set({
      target,
      round: currentRound,
      submittedAt: Date.now(),
      syncedAt: Date.now(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[sync-vote]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}