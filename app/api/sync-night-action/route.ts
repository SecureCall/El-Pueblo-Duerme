/**
 * POST /api/sync-night-action
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Security: verifies Firebase Auth token and that uid matches the authenticated user.
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
    const { gameId, uid, role, payload } = body as {
      gameId: string;
      uid: string;
      role: string;
      payload: Record<string, unknown>;
    };

    if (!gameId || !uid || !role) {
      return NextResponse.json({ error: 'gameId, uid, role required' }, { status: 400 });
    }

    // El uid del body debe coincidir con el del token
    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    }

    initAdminApp();
    const db = getFirestore();

    const gameSnap = await db.collection('games').doc(gameId).get();
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

    // Sanitizar payload: solo tipos primitivos permitidos
    const safePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload ?? {})) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
        safePayload[k] = v;
      }
    }

    await db.collection('games').doc(gameId).set(
      { nightSubmissions: { [role]: { ...safePayload, syncedAt: Date.now() } } },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
