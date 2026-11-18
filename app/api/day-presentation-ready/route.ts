import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';

/**
 * Records that the host has finished the day-transition presentation.
 * This timestamp drives narration timing only; the authoritative voting
 * deadline (phaseEndsAt) is deliberately left unchanged.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyAuthToken(request);
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });

    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    const now = Date.now();

    await db.runTransaction(async tx => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const game = gameSnap.data() as Record<string, unknown>;
      if (game.hostUid !== user.uid) throw new Error('FORBIDDEN');
      if (game.phase !== 'day') throw new Error('PHASE_CLOSED');
      tx.update(gameRef, { dayStartedAt: now });
    });

    return NextResponse.json({ ok: true, gameId, dayStartedAt: now });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const errors: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Game not found'],
      FORBIDDEN: [403, 'Only the host may mark the day presentation ready'],
      PHASE_CLOSED: [409, 'The game is not in the day phase'],
      UNAUTHORIZED: [401, 'Unauthorized'],
    };
    const [status, message] = errors[code] ?? [500, 'Internal error'];
    if (status >= 500) console.error('[day-presentation-ready]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
