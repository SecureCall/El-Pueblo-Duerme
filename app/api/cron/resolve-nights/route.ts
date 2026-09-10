import { NextResponse } from 'next/server';
import { isAuthorizedServerRequest } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';
import { POST as resolveNight } from '@/app/api/resolve-night/route';

const MAX_GAMES_PER_TICK = 50;

/**
 * Trusted scheduler entry point. It finds overdue night phases and delegates
 * each one to the same authoritative resolver used by player-triggered calls.
 * The resolver's lease remains the final concurrency/fencing authority.
 */
export async function GET(request: Request) {
  if (!isAuthorizedServerRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = getSdks();
  const now = Date.now();
  const snapshot = await db.collection('games')
    .where('phaseEndsAt', '<=', now)
    .limit(MAX_GAMES_PER_TICK)
    .get();

  const candidates = snapshot.docs.filter((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return data.phase === 'night' && Array.isArray(data.players);
  });

  const results: Array<{ gameId: string; status: number; body: unknown }> = [];

  for (const doc of candidates) {
    const response = await resolveNight(new Request(request.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: request.headers.get('authorization') ?? '',
      },
      body: JSON.stringify({ gameId: doc.id }),
    }));

    const body = await response.json().catch(() => ({}));
    results.push({ gameId: doc.id, status: response.status, body });
  }

  return NextResponse.json({
    ok: true,
    scanned: snapshot.size,
    candidates: candidates.length,
    results,
    at: now,
  });
}
