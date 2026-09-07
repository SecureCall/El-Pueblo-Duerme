import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';

const adminApp = initAdminApp();
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);

/**
 * Server-side validation-only endpoint for the night phase.
 * It deliberately does not mutate the game: night actions are submitted
 * through the server-authoritative submission endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const body = await request.json().catch(() => ({}));
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    const actionId = typeof body?.actionId === 'string' ? body.actionId : uid;

    if (!gameId) {
      return NextResponse.json({ ok: false, error: 'INVALID_GAME_ID' }, { status: 400 });
    }
    if (actionId !== uid) {
      return NextResponse.json({ ok: false, error: 'ACTOR_MISMATCH' }, { status: 403 });
    }

    const gameRef = adminDb.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) {
      return NextResponse.json({ ok: false, error: 'GAME_NOT_FOUND' }, { status: 404 });
    }

    const game = gameSnap.data() ?? {};
    const players = Array.isArray(game.players) ? game.players : [];
    const player = players.find((p: unknown) =>
      typeof p === 'object' && p !== null && 'uid' in p && (p as { uid?: unknown }).uid === uid,
    ) as { uid?: string; isAlive?: boolean } | undefined;

    if (!player) {
      return NextResponse.json({ ok: false, error: 'NOT_A_PLAYER' }, { status: 403 });
    }
    if (player.isAlive === false) {
      return NextResponse.json({ ok: false, error: 'PLAYER_DEAD' }, { status: 403 });
    }
    if (game.phase !== 'night') {
      return NextResponse.json({ ok: false, error: 'INVALID_PHASE' }, { status: 409 });
    }

    const roleSnap = await gameRef.collection('playerRoles').doc(uid).get();
    if (!roleSnap.exists) {
      return NextResponse.json({ ok: false, error: 'ROLE_NOT_FOUND' }, { status: 409 });
    }
    const roleData = roleSnap.data() ?? {};
    const role = typeof roleData.role === 'string' ? roleData.role : null;
    if (!role) {
      return NextResponse.json({ ok: false, error: 'ROLE_INVALID' }, { status: 409 });
    }

    return NextResponse.json({ ok: true, validated: true, actorUid: uid, role, phase: game.phase });
  } catch (error) {
    console.error('[validate-night] validation failed', error);
    return NextResponse.json({ ok: false, error: 'VALIDATION_FAILED' }, { status: 500 });
  }
}
