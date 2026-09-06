/**
 * POST /api/claim-daily-reward
 * Claims the authenticated user's daily reward atomically with its streak.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DAILY_REWARDS = [25, 35, 50, 40, 60, 80, 150] as const;
const DAY_MS = 86_400_000;

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    initAdminApp();
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const historyRef = userRef.collection('coinHistory');
    const now = new Date();
    const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const yesterdayStart = todayStart - DAY_MS;

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() ?? {};
      const daily = (data.dailyStreak ?? {}) as { lastClaim?: unknown; streak?: number };
      const rawLastClaim = daily.lastClaim as { toDate?: () => Date } | Date | number | undefined;
      const lastClaim = rawLastClaim && typeof rawLastClaim === 'object' && 'toDate' in rawLastClaim && typeof rawLastClaim.toDate === 'function'
        ? rawLastClaim.toDate().getTime()
        : rawLastClaim instanceof Date
          ? rawLastClaim.getTime()
          : typeof rawLastClaim === 'number' ? rawLastClaim : 0;

      if (lastClaim >= todayStart) return null;

      const prevStreak = typeof daily.streak === 'number' && daily.streak > 0 ? daily.streak : 0;
      const claimedYesterday = lastClaim >= yesterdayStart && lastClaim < todayStart;
      const newStreak = claimedYesterday ? prevStreak + 1 : 1;
      const coins = DAILY_REWARDS[(newStreak - 1) % DAILY_REWARDS.length];

      const historyEntry = historyRef.doc();
      tx.set(userRef, {
        dailyStreak: {
          lastClaim: now,
          streak: newStreak,
        },
        coins: FieldValue.increment(coins),
      }, { merge: true });
      tx.set(historyEntry, {
        amount: coins,
        reason: 'daily_reward',
        createdAt: now,
      });

      return { coins, newStreak };
    });

    if (!result) {
      return NextResponse.json({ error: 'Recompensa diaria ya reclamada', alreadyClaimed: true }, { status: 409 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[claim-daily-reward]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
