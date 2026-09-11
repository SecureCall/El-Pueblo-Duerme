import { NextResponse } from 'next/server';
import { isAuthorizedServerRequest, verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';

export async function POST(request: Request) {
  try {
    const serverAuthorized = isAuthorizedServerRequest(request);
    const user = serverAuthorized ? null : await verifyAuthToken(request);
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    if (!gameId || !targetUid) return NextResponse.json({ error: 'gameId and targetUid are required' }, { status: 400 });

    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    await db.runTransaction(async tx => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const game = gameSnap.data() as Record<string, unknown>;
      const pendingUid = typeof game.chivoPendingChoice === 'string' ? game.chivoPendingChoice : null;
      if (!pendingUid) throw new Error('NO_PENDING_CHOICE');
      const players = Array.isArray(game.players) ? game.players as Array<{ uid: string; isAlive: boolean; isAI?: boolean }> : [];
      const chivo = players.find(p => p.uid === pendingUid);
      const target = players.find(p => p.uid === targetUid);
      if (!chivo || chivo.isAlive) throw new Error('CHIVO_INVALID');
      if (!target || !target.isAlive || target.uid === pendingUid) throw new Error('TARGET_INVALID');

      const roleSnap = await tx.get(gameRef.collection('playerRoles').doc(pendingUid));
      if (!roleSnap.exists || roleSnap.data()?.role !== 'Chivo Expiatorio') throw new Error('ROLE_INVALID');

      const authorizedPlayer = user?.uid === pendingUid;
      const authorizedAI = chivo.isAI === true && user?.uid === game.hostUid;
      if (!serverAuthorized && !authorizedPlayer && !authorizedAI) throw new Error('FORBIDDEN');

      tx.update(gameRef, { chivoPendingChoice: null, voteBanned: [targetUid] });
    });
    return NextResponse.json({ ok: true, gameId, targetUid });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const statuses: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Game not found'],
      NO_PENDING_CHOICE: [409, 'No scapegoat choice is pending'],
      CHIVO_INVALID: [409, 'Scapegoat state is invalid'],
      TARGET_INVALID: [403, 'Target is invalid or already dead'],
      ROLE_INVALID: [409, 'Scapegoat role could not be verified'],
      FORBIDDEN: [403, 'Not authorized to perform this choice'],
    };
    const [status, message] = statuses[code] ?? [500, 'Internal error'];
    if (status >= 500) console.error('[chivo-choice]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
