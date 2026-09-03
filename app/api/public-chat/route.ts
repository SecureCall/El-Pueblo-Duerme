import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const MAX_TEXT = 280;

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!gameId || !text || text.length > MAX_TEXT) {
      return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');

      const game = snap.data()!;
      const players = Array.isArray(game.players) ? game.players : [];
      const player = players.find((p: any) => p?.uid === uid);
      if (!player) throw new Error('NOT_MEMBER');

      if (game.status === 'ended') throw new Error('GAME_ENDED');
      if (player.isAlive === false) throw new Error('DEAD_PLAYER');
      if (game.phase !== 'day' && game.phase !== 'voting') throw new Error('INVALID_PHASE');
      if (game.silencedPlayers?.includes?.(uid)) throw new Error('SILENCED');

      const chatRef = gameRef.collection('publicChat').doc();
      tx.create(chatRef, {
        senderId: uid,
        senderName: typeof player.name === 'string' ? player.name.slice(0, 60) : 'Jugador',
        text,
        type: 'normal',
        createdAt: new Date(),
      });

      return chatRef.id;
    });

    return NextResponse.json({ ok: true, messageId: result });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'INTERNAL';
    const errors: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Partida no encontrada', 404],
      NOT_MEMBER: ['No perteneces a esta partida', 403],
      GAME_ENDED: ['La partida ha terminado', 409],
      DEAD_PLAYER: ['Los jugadores eliminados no pueden usar el chat público', 403],
      INVALID_PHASE: ['El chat público no está disponible ahora', 409],
      SILENCED: ['Estás silenciado', 403],
    };
    const [error, status] = errors[code] ?? ['Error interno', 500];
    console.error('[public-chat]', code);
    return NextResponse.json({ error }, { status });
  }
}
