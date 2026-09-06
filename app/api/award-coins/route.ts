/**
 * POST /api/award-coins
 * Otorga 50 monedas por ver un vídeo publicitario.
 *
 * Requiere Authorization: Bearer <firebase_id_token>.
 * El uid se extrae del token — el cliente no puede especificarlo.
 * El límite diario se comprueba dentro de la misma transacción que concede
 * las monedas, evitando que solicitudes concurrentes superen el máximo.
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
    const userRef = db.collection('users').doc(uid);
    const historyRef = userRef.collection('coinHistory');

    const now = new Date();
    // Use UTC consistently so the serverless function cannot change the
    // accounting window depending on its deployment region.
    const startOfDay = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ));

    const result = await db.runTransaction(async (tx) => {
      const historyQuery = historyRef
        .where('reason', '==', 'video')
        .where('createdAt', '>=', startOfDay)
        .limit(MAX_VIDEOS_PER_DAY);
      const historySnap = await tx.get(historyQuery);

      if (historySnap.size >= MAX_VIDEOS_PER_DAY) {
        return null;
      }

      const entryRef = historyRef.doc();
      tx.set(entryRef, {
        amount: COINS_PER_VIDEO,
        reason: 'video',
        createdAt: now,
      });
      tx.set(userRef, {
        coins: FieldValue.increment(COINS_PER_VIDEO),
      }, { merge: true });

      return {
        videosUsed: historySnap.size + 1,
        videosRemaining: MAX_VIDEOS_PER_DAY - historySnap.size - 1,
      };
    });

    if (!result) {
      return NextResponse.json({
        error: 'Límite diario de vídeos alcanzado',
        limitReached: true,
      }, { status: 429 });
    }

    return NextResponse.json({
      ok: true,
      coinsGranted: COINS_PER_VIDEO,
      videosRemaining: result.videosRemaining,
    });
  } catch (err) {
    console.error('[award-coins]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
