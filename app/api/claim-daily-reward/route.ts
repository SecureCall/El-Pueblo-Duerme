import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const DAILY_REWARDS = [25, 35, 50, 40, 60, 80, 150];
const DAY_MS = 86_400_000;

function startOfDay(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    initAdminApp();
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const now = Date.now();
    const today = startOfDay(now);
    const yesterday = today - DAY_MS;

    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('Usuario no encontrado');

      const data = snap.data() ?? {};
      const daily = (data.dailyStreak ?? {}) as Record<string, unknown>;
      const rawLastClaim = daily.lastClaim;
      const lastClaim = rawLastClaim && typeof (rawLastClaim as any).toMillis === 'function'
        ? (rawLastClaim as any).toMillis()
        : Number(rawLastClaim ?? 0);

      if (lastClaim >= today) return null;

      const previousStreak = Number(daily.streak ?? 0);
      const newStreak = lastClaim >= yesterday && lastClaim < today ? previousStreak + 1 : 1;
      const coins = DAILY_REWARDS[(newStreak - 1) % DAILY_REWARDS.length];

      tx.update(userRef, {
        'dailyStreak.lastClaim': new Date(now),
        'dailyStreak.streak': newStreak,
        coins: (data.coins ?? 0) + coins,
      });

      const historyRef = userRef.collection('coinHistory').doc();
      tx.set(historyRef, { amount: coins, reason: 'daily_reward', createdAt: new Date(now) });
      return { coins, newStreak };
    });

    if (!result) return NextResponse.json({ error: 'Recompensa ya reclamada', alreadyClaimed: true }, { status: 409 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[claim-daily-reward]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
