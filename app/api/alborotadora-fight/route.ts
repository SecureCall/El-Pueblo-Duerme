import { NextResponse } from 'next/server';
import { isAuthorizedServerRequest, verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';

const ALLOWED_PHASES = new Set(['day', 'voting']);

export async function POST(request: Request) {
  try {
    const serverAuthorized = isAuthorizedServerRequest(request);
    const user = serverAuthorized ? null : await verifyAuthToken(request);
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    const firstUid = typeof body?.firstUid === 'string' ? body.firstUid.trim() : '';
    const secondUid = typeof body?.secondUid === 'string' ? body.secondUid.trim() : '';
    if (!gameId || !firstUid || !secondUid) return NextResponse.json({ error: 'gameId, firstUid and secondUid are required' }, { status: 400 });
    if (firstUid === secondUid) return NextResponse.json({ error: 'Targets must be different' }, { status: 400 });

    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    await db.runTransaction(async tx => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const game = gameSnap.data() as Record<string, unknown>;
      if (!ALLOWED_PHASES.has(String(game.phase))) throw new Error('PHASE_CLOSED');
      if (game.alborotadoraUsed === true || game.alborotadoraFight != null) throw new Error('ALREADY_USED');

      const players = Array.isArray(game.players) ? game.players as Array<Record<string, unknown>> : [];
      const actorUid = typeof body?.actorUid === 'string' ? body.actorUid.trim() : (user?.uid ?? '');
      const actor = players.find(p => p.uid === actorUid);
      const first = players.find(p => p.uid === firstUid);
      const second = players.find(p => p.uid === secondUid);
      if (!actor || actor.isAlive !== true) throw new Error('ACTOR_INVALID');
      if (!first || first.isAlive !== true || !second || second.isAlive !== true) throw new Error('TARGET_INVALID');
      if (firstUid === actorUid || secondUid === actorUid) throw new Error('ACTOR_TARGET_FORBIDDEN');

      const roleSnap = await tx.get(gameRef.collection('playerRoles').doc(actorUid));
      if (!roleSnap.exists || roleSnap.data()?.role !== 'Alborotadora') throw new Error('ROLE_INVALID');
      const authorizedPlayer = user?.uid === actorUid;
      const authorizedAI = actor.isAI === true && user?.uid === game.hostUid;
      if (!serverAuthorized && !authorizedPlayer && !authorizedAI) throw new Error('FORBIDDEN');

      tx.update(gameRef, { alborotadoraFight: [firstUid, secondUid], alborotadoraUsed: true });
    });

    return NextResponse.json({ ok: true, gameId });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const errors: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Game not found'],
      PHASE_CLOSED: [409, 'The Alborotadora action is not available in this phase'],
      ALREADY_USED: [409, 'The Alborotadora action was already used'],
      ACTOR_INVALID: [403, 'The Alborotadora is not alive or is not in the game'],
      TARGET_INVALID: [403, 'Both targets must be alive players'],
      ACTOR_TARGET_FORBIDDEN: [403, 'The Alborotadora cannot target herself'],
      ROLE_INVALID: [409, 'The Alborotadora role could not be verified'],
      FORBIDDEN: [403, 'Not authorized to perform this action'],
    };
    const [status, message] = errors[code] ?? [500, 'Internal error'];
    if (status >= 500) console.error('[alborotadora-fight]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
