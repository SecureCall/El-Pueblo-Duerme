import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';
import { readNightSubmissions } from '@/lib/server/nightSubmissions';

/**
 * Server-side boundary for night resolution.
 *
 * This endpoint intentionally does NOT resolve the night yet. It only
 * authenticates the caller and proves that the persisted submissions can be
 * read server-side. The actual game-state mutation remains in the existing
 * resolver until it is migrated atomically.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyAuthToken(request);
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();

    if (!gameSnap.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameSnap.data() as Record<string, unknown>;
    const players = Array.isArray(game.players) ? game.players : [];
    const isPlayer = players.some(
      (player) =>
        player &&
        typeof player === 'object' &&
        'uid' in player &&
        player.uid === user.uid
    );

    if (!isPlayer) {
      return NextResponse.json({ error: 'Not a player in this game' }, { status: 403 });
    }

    if (game.phase !== 'night') {
      return NextResponse.json({ error: 'Night phase is not active' }, { status: 409 });
    }

    const submissions = await readNightSubmissions(gameId);

    return NextResponse.json({
      ok: true,
      gameId,
      roundNumber: game.roundNumber ?? null,
      submissions,
    });
  } catch (error) {
    console.error('[resolve-night] request failed', error);
    return NextResponse.json({ error: 'Unauthorized or invalid request' }, { status: 401 });
  }
}
