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
// Mínimo tiempo entre premios de XP (10 minutos = duración mínima de una partida)
const MIN_AWARD_INTERVAL_MS = 10 * 60 * 1000;

function xpToLevel(xp: number): number {
  return Math.min(MAX_LEVEL, Math.floor((xp ?? 0) / XP_PER_LEVEL) + 1);
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { isWin, hasSpecialRole } = await req.json();

    initAdminApp();
    const adminDb = getFirestore();
    const ref = adminDb.collection('users').doc(uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data()! : {};
      const current = (data.xp ?? 0) as number;
      const currentPlayed = (data.gamesPlayed ?? 0) as number;
      const currentWon = (data.gamesWon ?? 0) as number;
      const currentStreak = (data.consecutiveWins ?? 0) as number;
      const lastAwardedAt = (data.lastXpAwardedAt ?? 0) as number;

      // Anti-abuso: rate limit (min 10 min entre premios)
      if (Date.now() - lastAwardedAt < MIN_AWARD_INTERVAL_MS) {
        return null; // demasiado pronto, ignorar
      }

      // Calcular streak y bonus usando SIEMPRE valores del servidor
      const newStreak = isWin ? currentStreak + 1 : 0;
      const streakBonus = isWin && newStreak > 1 ? XP_STREAK_BONUS * Math.min(newStreak, 5) : 0;
      const xpGained = XP_PER_GAME + (isWin ? XP_PER_WIN : 0) + (hasSpecialRole ? XP_SPECIAL_ROLE : 0) + streakBonus;
      const newXp = current + xpGained;

      tx.set(ref, {
        xp: newXp,
        gamesPlayed: currentPlayed + 1,
        gamesWon: isWin ? currentWon + 1 : currentWon,
        consecutiveWins: newStreak,
        lastXpAwardedAt: Date.now(),
      }, { merge: true });

      return { xpGained, newXp, newStreak };
    });

    if (!result) {
      return NextResponse.json({ error: 'Demasiados premios seguidos' }, { status: 429 });
    }

    return NextResponse.json({
      xpGained: result.xpGained,
      newTotalXp: result.newXp,
      newLevel: xpToLevel(result.newXp),
    });

  } catch (err) {
    console.error('[award-xp]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
