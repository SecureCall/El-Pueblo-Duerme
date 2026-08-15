import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from './config';
import { authFetch } from './authFetch';

export const DAILY_REWARDS = [25, 35, 50, 40, 60, 80, 150];

export interface DailyRewardStatus {
  canClaim: boolean;
  alreadyClaimed: boolean;
  streak: number;
  todayReward: number;
  nextReward: number;
}

function startOfDayMs(ts: number) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export async function getDailyRewardStatus(userId: string): Promise<DailyRewardStatus> {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const data = snap.data() ?? {};
  const daily = data.dailyStreak ?? {};
  const lastClaim: number = daily.lastClaim instanceof Timestamp
    ? daily.lastClaim.toMillis()
    : Number(daily.lastClaim ?? 0);
  const streak = Number(daily.streak ?? 0);

  const todayStart = startOfDayMs(Date.now());
  const yesterdayStart = todayStart - 86400000;
  const claimedToday = lastClaim >= todayStart;
  const claimedYesterday = lastClaim >= yesterdayStart && lastClaim < todayStart;
  const effectiveStreak = claimedToday || claimedYesterday ? streak : 0;
  const rewardIndex = effectiveStreak % DAILY_REWARDS.length;

  return {
    canClaim: !claimedToday,
    alreadyClaimed: claimedToday,
    streak: effectiveStreak,
    todayReward: DAILY_REWARDS[rewardIndex],
    nextReward: DAILY_REWARDS[(rewardIndex + 1) % DAILY_REWARDS.length],
  };
}

export async function claimDailyReward(_userId: string): Promise<{ coins: number; newStreak: number } | null> {
  const response = await authFetch('/api/claim-daily-reward', { method: 'POST' });
  if (response.status === 409) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'No se pudo reclamar la recompensa');
  return { coins: data.coins, newStreak: data.newStreak };
}
