import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const XP_PER_GAME = 50;
const XP_PER_WIN = 100;
const XP_SPECIAL_ROLE = 25;
const XP_STREAK_BONUS = 30;
const MAX_LEVEL = 50;
const XP_PER_LEVEL = 200;

function xpToLevel(xp: number): number {
  return Math.min(MAX_LEVEL, Math.floor((xp ?? 0) / XP_PER_LEVEL) + 1);
}

export async function POST(req: NextRequest) {
  // Verificar token — el uid se obtiene del token, no del body
  const uid = await verifyAuthToken(req);
  if (!uid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { isWin, hasSpecialRole, consecutiveWins: prevStreak } = await req.json();

    const streak = prevStreak ?? 0;
    const streakBonus = isWin && streak > 1 ? XP_STREAK_BONUS * Math.min(streak, 5) : 0;
    const xpGained = XP_PER_GAME + (isWin ? XP_PER_WIN : 0) + (hasSpecialRole ? XP_SPECIAL_ROLE : 0) + streakBonus;

    initAdminApp();
    const adminDb = getFirestore();
    const ref = adminDb.collection('users').doc(uid);

    const newTotalXp = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data()! : {};
      const current = (data.xp ?? 0) as number;
      const currentPlayed = (data.gamesPlayed ?? 0) as number;
      const currentWon = (data.gamesWon ?? 0) as number;
      const currentStreak = (data.consecutiveWins ?? 0) as number;
      const newXp = current + xpGained;
      const newStreak = isWin ? currentStreak + 1 : 0;

      tx.set(ref, {
        xp: newXp,
        gamesPlayed: currentPlayed + 1,
        gamesWon: isWin ? currentWon + 1 : currentWon,
        consecutiveWins: newStreak,
      }, { merge: true });

      return newXp;
    });

    return NextResponse.json({
      xpGained,
      newTotalXp,
      newLevel: xpToLevel(newTotalXp),
    });

  } catch (err) {
    console.error('[award-xp]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
