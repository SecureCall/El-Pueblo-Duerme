import { NextResponse } from 'next/server';
import { isAuthorizedServerRequest, verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';

const MAX_MESSAGE_LENGTH = 280;

export async function POST(request: Request) {
  try {
    const serverAuthorized = isAuthorizedServerRequest(request);
    const user = serverAuthorized ? null : await verifyAuthToken(request);
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
    const actorUid = typeof body?.actorUid === 'string' ? body.actorUid.trim() : (user?.uid ?? '');
    if (!gameId || !targetUid || !message || !actorUid) return NextResponse.json({ error: 'gameId, actorUid, targetUid and message are required' }, { status: 400 });

    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    const chatRef = gameRef.collection('publicChat').doc();
    await db.runTransaction(async tx => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const game = gameSnap.data() as Record<string, unknown>;
      const pending = Array.isArray(game.fantasmaPending) ? game.fantasmaPending.filter((v): v is string => typeof v === 'string') : [];
      const used = Array.isArray(game.fantasmaUsed) ? game.fantasmaUsed.filter((v): v is string => typeof v === 'string') : [];
      if (!pending.includes(actorUid) || used.includes(actorUid)) throw new Error('GHOST_NOT_PENDING');

      const players = Array.isArray(game.players) ? game.players as Array<Record<string, unknown>> : [];
      const actor = players.find(p => p.uid === actorUid);
      const target = players.find(p => p.uid === targetUid);
      if (!actor || actor.isAlive === true) throw new Error('GHOST_INVALID');
      if (!target || target.isAlive !== true) throw new Error('TARGET_INVALID');
      const authorizedPlayer = user?.uid === actorUid;
      const authorizedAI = actor.isAI === true && user?.uid === game.hostUid;
      if (!serverAuthorized && !authorizedPlayer && !authorizedAI) throw new Error('FORBIDDEN');

      const nextPending = pending.filter(uid => uid !== actorUid);
      tx.set(chatRef, {
        senderId: 'ghost',
        senderName: '👻 Mensaje Anónimo',
        text: `(Mensaje del más allá para ${target.name ?? 'un jugador'}): ${message}`,
        createdAt: new Date(),
      });
      tx.update(gameRef, { fantasmaPending: nextPending, fantasmaUsed: [...used, actorUid] });
    });

    return NextResponse.json({ ok: true, gameId });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const errors: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Game not found'],
      GHOST_NOT_PENDING: [409, 'The ghost has no pending message'],
      GHOST_INVALID: [403, 'The ghost state is invalid'],
      TARGET_INVALID: [403, 'Target must be alive'],
      FORBIDDEN: [403, 'Not authorized to send this ghost message'],
    };
    const [status, message] = errors[code] ?? [500, 'Internal error'];
    if (status >= 500) console.error('[fantasma-message]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
