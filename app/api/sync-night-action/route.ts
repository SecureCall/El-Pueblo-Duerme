/**
 * POST /api/sync-night-action
 * Security: verifies Firebase Auth token, derives the role from private
 * server state, validates the complete action contract, and stores one
 * submission per actor+round.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { validateCanonicalNightAction } from '@/lib/game/nightActionAuthority';

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { gameId, uid, payload } = body as {
      gameId?: unknown;
      uid?: unknown;
      payload?: unknown;
    };

    if (typeof gameId !== 'string' || !gameId || typeof uid !== 'string' || !uid ||
        !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'gameId, uid y payload requeridos' }, { status: 400 });
    }
    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });

    const gameData = gameSnap.data()!;
    if (gameData.phase !== 'night') {
      return NextResponse.json({ error: 'No es fase de noche' }, { status: 409 });
    }

    const roundNumber = typeof gameData.roundNumber === 'number' && Number.isInteger(gameData.roundNumber)
      ? gameData.roundNumber
      : null;
    if (roundNumber === null || roundNumber < 1) {
      return NextResponse.json({ error: 'Ronda nocturna inválida' }, { status: 409 });
    }

    const players: { uid: string; isAlive: boolean }[] = Array.isArray(gameData.players)
      ? gameData.players
          .filter((player: unknown): player is Record<string, unknown> => Boolean(player) && typeof player === 'object')
          .flatMap((player) => typeof player.uid === 'string'
            ? [{ uid: player.uid, isAlive: player.isAlive === true }]
            : [])
      : [];
    const actor = players.find((player) => player.uid === uid);
    if (!actor || !actor.isAlive) {
      return NextResponse.json({ error: 'Jugador no válido o muerto' }, { status: 403 });
    }

    const roleSnap = await gameRef.collection('playerRoles').doc(uid).get();
    if (!roleSnap.exists) return NextResponse.json({ error: 'Rol no disponible' }, { status: 403 });

    const roleData = roleSnap.data() ?? {};
    const serverRole = typeof roleData.role === 'string'
      ? roleData.role
      : typeof roleData.rol === 'string' ? roleData.rol : null;
    if (!serverRole) return NextResponse.json({ error: 'Rol inválido en servidor' }, { status: 500 });

    const validation = validateCanonicalNightAction({
      players,
      actorUid: uid,
      actorRole: serverRole,
      roundNumber,
      payload,
    });
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Acción no permitida',
        details: validation.errors,
      }, { status: 403 });
    }

    // Round-scoped ID prevents a previous night's submission from being
    // overwritten/reused by the current night.
    const submissionRef = gameRef.collection('nightSubmissions').doc(`${uid}:${roundNumber}`);
    const now = Date.now();
    await submissionRef.set({
      actorUid: uid,
      role: serverRole,
      roundNumber,
      actions: validation.submissions,
      submittedAt: now,
      syncedAt: now,
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      validated: true,
      actorUid: uid,
      role: serverRole,
      roundNumber,
      actions: validation.submissions.map((submission) => submission.action),
    });
  } catch (err: unknown) {
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
