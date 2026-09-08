/**
 * POST /api/award-coins
 * Starts or claims a server-timed ad reward session.
 *
 * The authenticated UID comes only from the Firebase ID token. The server
 * owns the reward session, minimum watch time and daily counter.
 *
 * IMPORTANT: this is still not an ad-network verification. A production
 * rewarded-video provider should replace the timer proof with its signed
 * server-side reward callback when available.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';

const COINS_PER_VIDEO = 50;
const MAX_VIDEOS_PER_DAY = 5;
const WATCH_SECONDS = 15;
const SESSION_TTL_SECONDS = 120;

type StartResponse = {
  ok: true;
  action: 'start';
  rewardId: string;
  waitSeconds: number;
};

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const action = body?.action === 'claim' ? 'claim' : body?.action === 'start' ? 'start' : null;
    if (!action) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    if (action === 'start') {
      const nowMs = Date.now();
      const rewardRef = userRef.collection('rewardSessions').doc();
      const activeUntilMs = nowMs + SESSION_TTL_SECONDS * 1000;

      await rewardRef.create({
        type: 'video',
        status: 'pending',
        createdAt: new Date(nowMs),
        expiresAt: new Date(activeUntilMs),
        minWatchUntil: new Date(nowMs + WATCH_SECONDS * 1000),
      });

      const response: StartResponse = {
        ok: true,
        action: 'start',
        rewardId: rewardRef.id,
        waitSeconds: WATCH_SECONDS,
      };
      return NextResponse.json(response);
    }

    const rewardId = typeof body?.rewardId === 'string' ? body.rewardId.trim() : '';
    if (!rewardId) return NextResponse.json({ error: 'rewardId es requerido' }, { status: 400 });

    const rewardRef = userRef.collection('rewardSessions').doc(rewardId);
    const result = await db.runTransaction(async (tx) => {
      const [rewardSnap, userSnap] = await Promise.all([tx.get(rewardRef), tx.get(userRef)]);
      if (!rewardSnap.exists) throw new Error('REWARD_NOT_FOUND');

      const reward = rewardSnap.data() ?? {};
      if (reward.type !== 'video' || reward.status !== 'pending') {
        throw new Error('REWARD_ALREADY_USED');
      }

      const nowMs = Date.now();
      const minWatchUntil = reward.minWatchUntil?.toDate?.()?.getTime?.();
      const expiresAt = reward.expiresAt?.toDate?.()?.getTime?.();
      if (!Number.isFinite(minWatchUntil) || !Number.isFinite(expiresAt)) {
        throw new Error('REWARD_INVALID');
      }
      if (nowMs < minWatchUntil) throw new Error('REWARD_TOO_EARLY');
      if (nowMs >= expiresAt) throw new Error('REWARD_EXPIRED');

      const user = userSnap.data() ?? {};
      const today = new Date(nowMs);
      const utcDay = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
      const storedDay = typeof user.videoRewardDay === 'string' ? user.videoRewardDay : '';
      const usedToday = storedDay === utcDay && Number.isInteger(user.videoRewardsUsed) ? user.videoRewardsUsed : 0;

      if (usedToday >= MAX_VIDEOS_PER_DAY) throw new Error('DAILY_LIMIT');

      const nextUsed = usedToday + 1;
      const historyRef = userRef.collection('coinHistory').doc();
      tx.set(historyRef, {
        amount: COINS_PER_VIDEO,
        reason: 'video',
        rewardId,
        createdAt: new Date(nowMs),
      });
      tx.set(userRef, {
        coins: (user.coins ?? 0) + COINS_PER_VIDEO,
        videoRewardDay: utcDay,
        videoRewardsUsed: nextUsed,
      }, { merge: true });
      tx.update(rewardRef, {
        status: 'claimed',
        claimedAt: new Date(nowMs),
      });

      return {
        videosRemaining: MAX_VIDEOS_PER_DAY - nextUsed,
      };
    });

    return NextResponse.json({
      ok: true,
      coinsGranted: COINS_PER_VIDEO,
      videosRemaining: result.videosRemaining,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'REWARD_NOT_FOUND') return NextResponse.json({ error: 'Recompensa no encontrada' }, { status: 404 });
    if (code === 'REWARD_ALREADY_USED') return NextResponse.json({ error: 'Esta recompensa ya fue utilizada' }, { status: 409 });
    if (code === 'REWARD_TOO_EARLY') return NextResponse.json({ error: 'El anuncio todavía no ha terminado' }, { status: 409 });
    if (code === 'REWARD_EXPIRED') return NextResponse.json({ error: 'La sesión de anuncio ha caducado' }, { status: 409 });
    if (code === 'REWARD_INVALID') return NextResponse.json({ error: 'Sesión de recompensa inválida' }, { status: 409 });
    if (code === 'DAILY_LIMIT') return NextResponse.json({ error: 'Límite diario de vídeos alcanzado', limitReached: true }, { status: 429 });
    console.error('[award-coins]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
