/**
 * POST /api/award-coins
 * Otorga 50 monedas por ver un vídeo publicitario.
 *
 * Requiere Authorization: Bearer <firebase_id_token>.
 * El uid se extrae del token — el cliente no puede especificarlo.
 * El límite diario y la concesión de monedas se resuelven en UNA transacción,
 * evitando que peticiones concurrentes puedan saltarse el límite.
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

    const result = await db.runTransaction(async (tx) => {
      // The limit is checked inside the same transaction as the balance update.
      // A separate pre-check would allow concurrent requests to race past 5.
      const now = new Date();
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const historyQuery = historyRef
        .where('reason', '==', 'video')
        .where('createdAt', '>=', startOfDay)
        .limit(MAX_VIDEOS_PER_DAY);

      const historySnap = await tx.get(historyQuery);

      if (historySnap.size >= MAX_VIDEOS_PER_DAY) {
        return { limitReached: true, videosRemaining: 0 };
      }

      const historyDoc = historyRef.doc();
      tx.update(userRef, { coins: FieldValue.increment(COINS_PER_VIDEO) });
      tx.set(historyDoc, {
        amount: COINS_PER_VIDEO,
        reason: 'video',
        createdAt: now,
      });

      return {
        limitReached: false,
        videosRemaining: MAX_VIDEOS_PER_DAY - historySnap.size - 1,
      };
    });

    if (result.limitReached) {
      return NextResponse.json(
        { error: 'Límite diario de vídeos alcanzado', limitReached: true },
        { status: 429 },
      );
    }

    return NextResponse.json({
      ok: true,
      coinsGranted: COINS_PER_VIDEO,
      videosRemaining: result.videosRemaining,
    });
  } catch (err: unknown) {
    console.error('[award-coins]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
