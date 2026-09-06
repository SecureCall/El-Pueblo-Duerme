import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { getTakeoverDecision } from '@/lib/server/hostTakeoverPolicy';

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
    const presenceCollection = db.collection('presence');

    const result = await db.runTransaction(async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');

      const game = gameSnap.data() as Record<string, unknown>;
      const currentHostUid = typeof game.hostUid === 'string' ? game.hostUid : '';
      if (!currentHostUid) throw new Error('HOST_MISSING');

      const hostPresenceSnap = await tx.get(presenceCollection.doc(currentHostUid));
      const hostLastSeen = hostPresenceSnap.exists && typeof hostPresenceSnap.data()?.lastSeen === 'number'
        ? Number(hostPresenceSnap.data()?.lastSeen)
        : 0;

      const decision = getTakeoverDecision(game, uid, hostLastSeen, Date.now());
      if (!decision.ok) throw new Error(decision.code);
      if (!decision.takenOver) return { takenOver: false, hostUid: decision.hostUid };

      tx.update(gameRef, { hostUid: decision.hostUid, players: decision.players });
      return { takenOver: true, hostUid: decision.hostUid };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const errors: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Partida no encontrada', 404],
      NOT_PLAYER: ['No eres jugador de esta partida', 403],
      NOT_ELIGIBLE: ['No puedes asumir el host', 403],
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
