import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const MAX_MESSAGE_LENGTH = 120;

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const round = Number.isInteger(body.round) ? body.round : null;
    if (!gameId || !message || message.length > MAX_MESSAGE_LENGTH || round === null) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data()!;
      if (game.phase !== 'day' && game.phase !== 'voting') throw new Error('INVALID_PHASE');
      if (game.roundNumber !== round) throw new Error('STALE_ROUND');

      const players = Array.isArray(game.players) ? game.players : [];
      const victim = players.find((p: any) => p?.uid === uid);
      if (!victim || victim.isAlive !== false) throw new Error('NOT_DEAD');

      const usedKey = `lastWordsUsed.${uid}`;
      if (game.lastWordsUsed?.[uid] === round) throw new Error('ALREADY_SENT');

      tx.update(gameRef, {
        lastWordsUsed: { ...(game.lastWordsUsed ?? {}), [uid]: round },
        narratorBroadcast: {
          text: `"${message}" — ${victim.name ?? 'Jugador'}, en sus últimas palabras.`,
          type: 'irony',
          triggeredAt: Date.now(),
        },
      });

      const chatRef = gameRef.collection('publicChat').doc();
      tx.create(chatRef, {
        senderId: uid,
        senderName: victim.name ?? 'Jugador',
        text: message,
        type: 'lastWords',
        createdAt: FieldValue.serverTimestamp(),
      });
      void usedKey;
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL';
    const errors: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Partida no encontrada', 404],
      INVALID_PHASE: ['Las últimas palabras no están disponibles ahora', 409],
      STALE_ROUND: ['Ronda obsoleta', 409],
      NOT_DEAD: ['Solo un jugador eliminado puede usar las últimas palabras', 403],
      ALREADY_SENT: ['Las últimas palabras ya fueron enviadas', 409],
    };
    const [error, status] = errors[message] ?? ['Error interno', 500];
    console.error('[last-words]', message);
    return NextResponse.json({ error }, { status });
  }
}
