import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './config';

export const XP_PER_GAME = 50;
export const XP_PER_WIN = 100;
export const XP_SPECIAL_ROLE = 25;
export const XP_PER_LEVEL = 200;
export const MAX_LEVEL = 50;

export function xpToLevel(xp: number): number {
  return Math.min(MAX_LEVEL, Math.floor((xp ?? 0) / XP_PER_LEVEL) + 1);
}

export function xpProgress(xp: number): { current: number; needed: number; pct: number; level: number } {
  const level = xpToLevel(xp ?? 0);
  const current = (xp ?? 0) % XP_PER_LEVEL;
  return { current, needed: XP_PER_LEVEL, pct: current / XP_PER_LEVEL, level };
}

export function levelLabel(level: number): string {
  if (level >= 45) return '👑 Leyenda';
  if (level >= 35) return '💎 Maestro';
  if (level >= 25) return '🥇 Experto';
  if (level >= 15) return '🥈 Veterano';
  if (level >= 8)  return '🥉 Aprendiz';
  return '🌱 Novato';
}

export function levelEmoji(level: number): string {
  if (level >= 45) return '👑';
  if (level >= 35) return '💎';
  if (level >= 25) return '🥇';
  if (level >= 15) return '🥈';
  if (level >= 8)  return '🥉';
  return '🌱';
}

export async function awardXP(
  uid: string,
  { isWin, hasSpecialRole }: { isWin: boolean; hasSpecialRole: boolean }
): Promise<number> {
  const total = XP_PER_GAME + (isWin ? XP_PER_WIN : 0) + (hasSpecialRole ? XP_SPECIAL_ROLE : 0);
  await updateDoc(doc(db, 'users', uid), {
    xp: increment(total),
    gamesPlayed: increment(1),
    ...(isWin ? { gamesWon: increment(1) } : {}),
  });
  return total;
}
