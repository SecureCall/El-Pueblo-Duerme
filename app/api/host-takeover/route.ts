import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const HOST_ABSENCE_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  const uid = await verifyAuthToken(request);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const presenceRef = db.collection('presence');

    const result = await db.runTransaction(async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');

      const game = gameSnap.data() as Record<string, unknown>;
      const players = Array.isArray(game.players)
        ? game.players.filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object' && !Array.isArray(p)))
        : [];
      const caller = players.find((p) => p.uid === uid);
      if (!caller) throw new Error('NOT_PLAYER');
      if (game.phase === 'lobby' || game.phase === 'ended') throw new Error('TAKEOVER_NOT_ALLOWED');

      const currentHostUid = typeof game.hostUid === 'string' ? game.hostUid : '';
      if (!currentHostUid) throw new Error('HOST_MISSING');
      if (currentHostUid === uid) return { takenOver: false, hostUid: uid };

      const hostPresenceSnap = await tx.get(presenceRef.doc(currentHostUid));
      const lastSeen = hostPresenceSnap.exists && typeof hostPresenceSnap.data()?.lastSeen === 'number'
        ? Number(hostPresenceSnap.data()?.lastSeen)
        : 0;
      if (Date.now() - lastSeen < HOST_ABSENCE_MS) throw new Error('HOST_STILL_ACTIVE');

      const candidates = players
        .filter((p) => p.isAlive !== false && p.isAI !== true && typeof p.uid === 'string')
        .map((p) => p.uid as string)
        .sort((a, b) => a.localeCompare(b));
      if (candidates[0] !== uid) throw new Error('NOT_NEXT_CANDIDATE');

      const newPlayers = players.map((p) => ({ ...p, isHost: p.uid === uid }));
      tx.update(gameRef, { hostUid: uid, players: newPlayers });
      return { takenOver: true, hostUid: uid };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const errors: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Partida no encontrada', 404],
      NOT_PLAYER: ['No eres jugador de esta partida', 403],
      TAKEOVER_NOT_ALLOWED: ['El cambio de host no está permitido en esta fase', 409],
      HOST_MISSING: ['La partida no tiene host válido', 409],
      HOST_STILL_ACTIVE: ['El host sigue activo', 409],
      NOT_NEXT_CANDIDATE: ['Otro jugador tiene prioridad para asumir el host', 409],
    };
    const [message, status] = errors[code] ?? ['Error interno', 500];
    console.error('[host-takeover]', code);
    return NextResponse.json({ error: message }, { status });
  }
}
