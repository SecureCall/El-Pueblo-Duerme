/**
 * POST /api/sync-night-action
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Body matches PendingNightAction shape from lib/firebase/backgroundSync.ts
 *
 * Security: validates that uid is a player in the game and the game is in night phase.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameId, uid, role, payload, submittedAt } = body as {
      gameId: string;
      uid: string;
      role: string;
      payload: Record<string, unknown>;
      submittedAt: number;
    };

    if (!gameId || !uid || !role) {
      return NextResponse.json({ error: 'gameId, uid, role required' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();

    // Validar que el juego existe, está en fase de noche y uid es un jugador
    const gameSnap = await db.collection('games').doc(gameId).get();
    if (!gameSnap.exists) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    }
    const gameData = gameSnap.data()!;
    if (gameData.phase !== 'night') {
      return NextResponse.json({ error: 'No es fase de noche' }, { status: 409 });
    }
    const players: { uid: string; isAlive: boolean }[] = gameData.players ?? [];
    const isValidPlayer = players.some(p => p.uid === uid);
    if (!isValidPlayer) {
      return NextResponse.json({ error: 'Jugador no válido' }, { status: 403 });
    }

    // Sanitizar payload: solo tipos primitivos permitidos
    const safePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload ?? {})) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
        safePayload[k] = v;
      }
    }

    await db
      .collection('games')
      .doc(gameId)
      .set(
        { nightSubmissions: { [role]: { ...safePayload, syncedAt: Date.now() } } },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
