import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const TYPES = new Set(['warning', 'suspicion', 'chaos', 'irony', 'accusation']);

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const type = typeof body?.type === 'string' ? body.type : '';

    if (!gameId) return NextResponse.json({ error: 'gameId es requerido' }, { status: 400 });
    if (!text || text.length > 280) return NextResponse.json({ error: 'Texto inválido' }, { status: 400 });
    if (!TYPES.has(type)) return NextResponse.json({ error: 'Tipo de narración inválido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data() ?? {};
      if (game.hostUid !== uid) throw new Error('NOT_HOST');
      if (game.phase !== 'night' && game.phase !== 'day' && game.phase !== 'voting') throw new Error('INVALID_PHASE');

      tx.update(gameRef, {
        narratorBroadcast: { text, type, triggeredAt: Date.now() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    if (code === 'NOT_HOST') return NextResponse.json({ error: 'Solo el anfitrión puede emitir narraciones' }, { status: 403 });
    if (code === 'INVALID_PHASE') return NextResponse.json({ error: 'La narración no está disponible en esta fase' }, { status: 409 });
    console.error('[narrator-broadcast]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
