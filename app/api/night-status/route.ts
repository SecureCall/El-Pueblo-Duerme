/**
 * GET /api/night-status?gameId=...
 * Returns only non-secret night progress for the authenticated player.
 * The submission collection is server-readable; clients never read it directly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const gameId = req.nextUrl.searchParams.get('gameId');
  if (!gameId || !/^[A-Za-z0-9_-]{3,64}$/.test(gameId)) {
    return NextResponse.json({ error: 'gameId inválido' }, { status: 400 });
  }

  try {
    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });

    const game = gameSnap.data() ?? {};
    const players = Array.isArray(game.players)
      ? game.players.filter((player: unknown): player is Record<string, unknown> => Boolean(player) && typeof player === 'object')
      : [];
    const isParticipant = players.some(player => player.uid === tokenUid);
    if (!isParticipant) return NextResponse.json({ error: 'No eres participante' }, { status: 403 });

    if (game.phase !== 'night') {
      return NextResponse.json({
        ok: true,
        phase: typeof game.phase === 'string' ? game.phase : null,
        roundNumber: typeof game.roundNumber === 'number' ? game.roundNumber : null,
        submitted: false,
        submittedCount: 0,
        aliveCount: players.filter(player => player.isAlive === true).length,
        phaseEndsAt: typeof game.phaseEndsAt === 'number' ? game.phaseEndsAt : null,
        resolving: false,
      });
    }

    const roundNumber = typeof game.roundNumber === 'number' && Number.isInteger(game.roundNumber)
      ? game.roundNumber
      : null;
    if (roundNumber === null || roundNumber < 1) {
      return NextResponse.json({ error: 'Ronda nocturna inválida' }, { status: 409 });
    }

    const aliveUids = players
      .filter(player => player.isAlive === true)
      .map(player => player.uid)
      .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);

    const [mySubmissionSnap, submissionsSnap, lockSnap] = await Promise.all([
      gameRef.collection('nightSubmissions').doc(`${tokenUid}:${roundNumber}`).get(),
      gameRef.collection('nightSubmissions').where('roundNumber', '==', roundNumber).get(),
      gameRef.collection('nightResolutions').doc(String(roundNumber)).get(),
    ]);

    const aliveSet = new Set(aliveUids);
    const submittedUids = new Set(
      submissionsSnap.docs
        .map(doc => doc.data().actorUid)
        .filter((uid): uid is string => typeof uid === 'string' && aliveSet.has(uid)),
    );

    const lockData = lockSnap.exists ? lockSnap.data() ?? {} : {};
    const resolving = lockData.status === 'resolving';

    return NextResponse.json({
      ok: true,
      phase: 'night',
      roundNumber,
      submitted: mySubmissionSnap.exists,
      submittedCount: submittedUids.size,
      aliveCount: aliveUids.length,
      phaseEndsAt: typeof game.phaseEndsAt === 'number' ? game.phaseEndsAt : null,
      resolving,
    });
  } catch (error) {
    console.error('[night-status]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
