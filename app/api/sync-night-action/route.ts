/**
 * POST /api/sync-night-action
 * Security: verifies Firebase Auth token, derives the role from private
 * server state, validates the complete action contract, and stores one
 * immutable submission per actor+round.
 *
 * Resolution trigger: once every alive player has an immutable submission
 * (including server-generated AI submissions), this endpoint asks the trusted
 * night resolver to commit the round. The resolver remains the sole authority
 * for applying night effects and advancing the FSM.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { validateCanonicalNightAction } from '@/lib/game/nightActionAuthority';
import { ensureServerAINightSubmissions } from '@/lib/server/aiNight';

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

    const phaseEndsAt = typeof gameData.phaseEndsAt === 'number' ? gameData.phaseEndsAt : null;
    if (phaseEndsAt !== null && Date.now() >= phaseEndsAt) {
      return NextResponse.json({ error: 'La noche ya ha terminado; la acción llegó después del límite' }, { status: 409 });
    }

    const players: { uid: string; isAlive: boolean; isAI?: boolean }[] = Array.isArray(gameData.players)
      ? gameData.players
          .filter((player: unknown): player is Record<string, unknown> => Boolean(player) && typeof player === 'object')
          .flatMap((player) => typeof player.uid === 'string'
            ? [{ uid: player.uid, isAlive: player.isAlive === true, isAI: player.isAI === true }]
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

    const submissionRef = gameRef.collection('nightSubmissions').doc(`${uid}:${roundNumber}`);
    const resolutionLockRef = gameRef.collection('nightResolutions').doc(String(roundNumber));
    const now = Date.now();
    let created = false;

    await db.runTransaction(async (tx) => {
      // The submission and resolution lock are checked in the same transaction.
      // Whichever transaction wins the race establishes the ordering: a submission
      // already committed before resolution is included; a submission racing after
      // the resolver has claimed the lock is rejected.
      const [existing, resolutionLock] = await Promise.all([
        tx.get(submissionRef),
        tx.get(resolutionLockRef),
      ]);
      if (existing.exists) return;
      if (resolutionLock.exists) {
        const lockData = resolutionLock.data() as Record<string, unknown>;
        if (lockData.status === 'resolving' || lockData.status === 'resolved') {
          throw new Error('night_resolution_in_progress');
        }
      }
      tx.create(submissionRef, {
        actorUid: uid,
        role: serverRole,
        roundNumber,
        actions: validation.submissions,
        submittedAt: now,
        syncedAt: now,
      });
      created = true;
    });

    // Complete the AI side on the trusted server before deciding whether the
    // round has enough submissions to be resolved.
    const latestGameSnap = await gameRef.get();
    const latestGame = latestGameSnap.data() as Record<string, unknown> | undefined;
    let resolved = false;

    if (latestGame && latestGame.phase === 'night') {
      const latestPlayers = Array.isArray(latestGame.players) ? latestGame.players : [];
      await ensureServerAINightSubmissions(
        db,
        gameId,
        latestGame,
        latestPlayers as Array<Record<string, unknown>>,
        roundNumber,
      );

      const aliveUids = latestPlayers
        .filter((player) => player && typeof player === 'object' && (player as Record<string, unknown>).isAlive === true)
        .map((player) => (player as Record<string, unknown>).uid)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      const submissionSnap = await gameRef.collection('nightSubmissions').get();
      const submittedUids = new Set(
        submissionSnap.docs
          .map((submission) => submission.data())
          .filter((data) => data && data.roundNumber === roundNumber)
          .map((data) => data.actorUid)
          .filter((value): value is string => typeof value === 'string'),
      );
      const complete = aliveUids.length > 0 && aliveUids.every((aliveUid) => submittedUids.has(aliveUid));

      if (complete) {
        const authorization = req.headers.get('authorization');
        const resolverUrl = new URL('/api/resolve-night', req.url);
        const resolverResponse = await fetch(resolverUrl, {
          method: 'POST',
          headers: authorization ? { Authorization: authorization } : {},
        });
        resolved = resolverResponse.ok;
      }
    }

    return NextResponse.json({
      ok: true,
      validated: true,
      created,
      resolved,
      actorUid: uid,
      role: serverRole,
      roundNumber,
      actions: validation.submissions.map((submission) => submission.action),
    });
  } catch (err: unknown) {
    console.error('[sync-night-action]', err);
    const message = err instanceof Error ? err.message : '';
    if (message === 'night_resolution_in_progress') {
      return NextResponse.json({ error: 'La resolución de la noche ya está en curso' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
