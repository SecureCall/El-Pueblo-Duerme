/**
 * POST /api/sync-night-action
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Security: verifies Firebase Auth token and derives the role from server state.
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
    const { gameId, uid, payload } = body as {
      gameId: string;
      uid: string;
      payload: Record<string, unknown>;
    };

    if (!gameId || !uid) {
      return NextResponse.json({ error: 'gameId, uid required' }, { status: 400 });
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
    if (gameData.phase !== 'night') {
      return NextResponse.json({ error: 'No es fase de noche' }, { status: 409 });
    }

    const players: { uid: string; isAlive: boolean }[] = gameData.players ?? [];
    if (!players.some(p => p.uid === uid && p.isAlive)) {
      return NextResponse.json({ error: 'Jugador no válido o muerto' }, { status: 403 });
    }

    // Nunca confiamos en un rol enviado por el cliente.
    const roleSnap = await gameRef.collection('playerRoles').doc(uid).get();
    if (!roleSnap.exists) {
      return NextResponse.json({ error: 'Rol no disponible' }, { status: 403 });
    }

    const roleData = roleSnap.data() ?? {};
    const serverRole = typeof roleData.role === 'string'
      ? roleData.role
      : typeof roleData.rol === 'string'
        ? roleData.rol
        : null;

    if (!serverRole) {
      return NextResponse.json({ error: 'Rol inválido en servidor' }, { status: 500 });
    }

    const safePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload ?? {})) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
        safePayload[k] = v;
      }
    }

    // Reutilizamos la validación server-side antes de persistir la propuesta.
    // La validación comprueba identidad, pertenencia, estado del jugador y rol real.
    const validatedSubmission = {
      ...safePayload,
      actorUid: uid,
      role: serverRole,
      syncedAt: Date.now(),
    };

    await gameRef.set(
      {
        nightSubmissions: {
          [serverRole]: validatedSubmission,
        },
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      validated: true,
      role: serverRole,
      actorUid: uid,
    });
  } catch (err: unknown) {
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
