/**
 * POST /api/award-coins
 * Otorga 50 monedas por ver un vídeo publicitario.
 *
 * Requiere Authorization: Bearer <firebase_id_token>
 * El uid se extrae del token — el cliente no puede especificarlo.
 * Aplica el límite de 5 vídeos por día via Admin SDK (server-side, no bypassable).
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const COINS_PER_VIDEO = 50;
const MAX_VIDEOS_PER_DAY = 5;

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    initAdminApp();
    const db = getFirestore();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Verificar límite diario server-side (usa Admin SDK, no bypassable)
    const historySnap = await db
      .collection('users')
      .doc(uid)
      .collection('coinHistory')
      .where('reason', '==', 'video')
      .where('createdAt', '>=', new Date(startOfDay))
      .get();

    if (historySnap.size >= MAX_VIDEOS_PER_DAY) {
      return NextResponse.json({ error: 'Límite diario de vídeos alcanzado', limitReached: true }, { status: 429 });
    }

    // Otorgar monedas via transacción
    const userRef = db.collection('users').doc(uid);
    const historyRef = db.collection('users').doc(uid).collection('coinHistory');

    await db.runTransaction(async (tx) => {
      tx.update(userRef, { coins: FieldValue.increment(COINS_PER_VIDEO) });
      tx.set(historyRef.doc(), {
        amount: COINS_PER_VIDEO,
        reason: 'video',
        createdAt: new Date(),
      });
    });

    const remaining = MAX_VIDEOS_PER_DAY - historySnap.size - 1;
    return NextResponse.json({ ok: true, coinsGranted: COINS_PER_VIDEO, videosRemaining: remaining });

  } catch (err: any) {
    console.error('[award-coins]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
