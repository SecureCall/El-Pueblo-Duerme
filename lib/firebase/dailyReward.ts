import { doc, getDoc, updateDoc, serverTimestamp, Timestamp, increment, collection, addDoc } from 'firebase/firestore';
import { db } from './config';

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
    : (daily.lastClaim ?? 0);
  const streak: number = daily.streak ?? 0;

  const now = Date.now();
  const todayStart = startOfDayMs(now);
  const yesterdayStart = todayStart - 86400000;

  const claimedToday = lastClaim >= todayStart;
  const claimedYesterday = lastClaim >= yesterdayStart && lastClaim < todayStart;
  const streakLost = lastClaim > 0 && lastClaim < yesterdayStart;

  const effectiveStreak = claimedToday
    ? streak
    : claimedYesterday
    ? streak
    : streakLost
    ? 0
    : 0;

  const rewardIndex = effectiveStreak % DAILY_REWARDS.length;
  const todayReward = DAILY_REWARDS[rewardIndex];
  const nextReward = DAILY_REWARDS[(rewardIndex + 1) % DAILY_REWARDS.length];

  return {
    canClaim: !claimedToday,
    alreadyClaimed: claimedToday,
    streak: effectiveStreak,
    todayReward,
    nextReward,
  };
}

export async function claimDailyReward(userId: string): Promise<{ coins: number; newStreak: number } | null> {
  const status = await getDailyRewardStatus(userId);
  if (!status.canClaim) return null;

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const data = snap.data() ?? {};
  const daily = data.dailyStreak ?? {};

  const lastClaim: number = daily.lastClaim instanceof Timestamp
    ? daily.lastClaim.toMillis()
    : (daily.lastClaim ?? 0);
  const prevStreak: number = daily.streak ?? 0;

  const now = Date.now();
  const todayStart = startOfDayMs(now);
  const yesterdayStart = todayStart - 86400000;

  const claimedYesterday = lastClaim >= yesterdayStart && lastClaim < todayStart;
  const newStreak = claimedYesterday ? prevStreak + 1 : 1;
  const rewardIndex = (newStreak - 1) % DAILY_REWARDS.length;
  const coins = DAILY_REWARDS[rewardIndex];

  // Single write: both dailyStreak + coins together (required by Firestore rules)
  await updateDoc(userRef, {
    'dailyStreak.lastClaim': serverTimestamp(),
    'dailyStreak.streak': newStreak,
    coins: increment(coins),
  });

  // Separate history entry
  await addDoc(collection(db, 'users', userId, 'coinHistory'), {
    amount: coins,
    reason: 'daily_reward',
    createdAt: serverTimestamp(),
  });

  return { coins, newStreak };
}
