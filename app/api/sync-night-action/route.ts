/**
 * POST /api/sync-night-action
 * Security: verifies Firebase Auth token, derives the role from server state,
 * and rejects actions that are not allowed for that role.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { createNightActionSubmissions, validateNightActionSubmissions } from '@/lib/game/nightResolution';

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { gameId, uid, payload } = body as {
      gameId: string;
      uid: string;
      payload: Record<string, unknown>;
    };

    if (!gameId || !uid || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
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

    const players: { uid: string; isAlive: boolean }[] = Array.isArray(gameData.players) ? gameData.players : [];
    const actor = players.find(p => p.uid === uid);
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

    const submissions = createNightActionSubmissions(uid, payload);
    if (submissions.length === 0) {
      return NextResponse.json({ error: 'Acción nocturna no reconocida' }, { status: 400 });
    }

    // La validación recibe el rol privado obtenido por Admin SDK. Nunca usa
    // gameData.roles, que no debe convertirse en una fuente de autoridad.
    const validation = validateNightActionSubmissions(
      players,
      uid,
      serverRole,
      submissions,
    );
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Acción no permitida para este rol',
        details: validation.errors,
      }, { status: 403 });
    }

    const submissionRef = gameRef.collection('nightSubmissions').doc(uid);
    await submissionRef.set({
      actorUid: uid,
      role: serverRole,
      actions: submissions,
      syncedAt: Date.now(),
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      validated: true,
      actorUid: uid,
      role: serverRole,
      actions: submissions.map(s => s.action),
    });
  } catch (err: unknown) {
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
