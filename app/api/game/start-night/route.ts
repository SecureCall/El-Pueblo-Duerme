import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';

const NIGHT_DURATION_MS = 60_000;

export async function POST(request: NextRequest) {
  const uid = await verifyAuthToken(request);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
  if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });

  const { firestore } = getSdks();
  const gameRef = firestore.collection('games').doc(gameId);
  const now = Date.now();
  const phaseEndsAt = now + NIGHT_DURATION_MS;

  try {
    const result = await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');

      const game = snap.data() as Record<string, any>;
      if (game.hostUid !== uid) throw new Error('NOT_HOST');
      if (game.phase !== 'roleReveal') throw new Error('NOT_ROLE_REVEAL');

      const roundNumber = Number.isInteger(game.roundNumber) && game.roundNumber > 0
        ? game.roundNumber
        : 1;

      tx.update(gameRef, {
        phase: 'night',
        roundNumber,
        nightActions: {},
        nightSubmissions: {},
        nightStartedAt: now,
        phaseEndsAt,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { roundNumber };
    });

    return NextResponse.json({
      ok: true,
      roundNumber: result.roundNumber,
      nightStartedAt: now,
      phaseEndsAt,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    const status = code === 'GAME_NOT_FOUND' ? 404
      : code === 'NOT_HOST' ? 403
      : code === 'NOT_ROLE_REVEAL' ? 409
      : 500;

    return NextResponse.json({ error: code }, { status });
  }
}
