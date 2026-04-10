import { doc, getDoc, setDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from './config';

export const XP_PER_GAME = 50;
export const XP_PER_WIN = 100;
export const XP_SPECIAL_ROLE = 25;
export const XP_STREAK_BONUS = 30;   // +30 XP por cada victoria en racha (×nRacha)
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

// ── Títulos únicos basados en historial ───────────────────────────────────────
export interface TitleConfig {
  title: string;
  emoji: string;
  color: string;   // clase Tailwind de color de texto
  description: string;
}

export function getPlayerTitle(stats: {
  gamesPlayed: number;
  winRate: number;
  consecutiveWins: number;
  lastRole: string;
  level: number;
}): TitleConfig | null {
  const { gamesPlayed, winRate, consecutiveWins, lastRole, level } = stats;
  if (gamesPlayed === 0) return null;

  // Racha primero — más urgente/viral
  if (consecutiveWins >= 7) return { title: 'Sin Derrota', emoji: '🔥', color: 'text-orange-400', description: `${consecutiveWins} victorias consecutivas` };
  if (consecutiveWins >= 5) return { title: 'Invencible', emoji: '⚡', color: 'text-yellow-400', description: `Racha de ${consecutiveWins}` };
  if (consecutiveWins >= 3) return { title: 'En Racha', emoji: '🎯', color: 'text-green-400', description: `${consecutiveWins} seguidas` };

  // Dominio por nivel
  if (level >= 45) return { title: 'El Inmortal', emoji: '👑', color: 'text-amber-300', description: 'Leyenda del pueblo' };
  if (level >= 35) return { title: 'El Maestro', emoji: '💎', color: 'text-cyan-300', description: 'Domina el tablero' };

  // Dominio por winRate
  if (winRate >= 0.85 && gamesPlayed >= 10) return { title: 'El Oráculo', emoji: '🧠', color: 'text-purple-400', description: 'Raramente se equivoca' };
  if (winRate >= 0.70 && gamesPlayed >= 8) return { title: 'Estratega', emoji: '🎖️', color: 'text-indigo-300', description: 'Mente táctica' };

  // Especialización por rol
  if (lastRole === 'Lobo' && winRate >= 0.65 && gamesPlayed >= 5)
    return { title: 'Alpha', emoji: '🐺', color: 'text-red-400', description: 'El lobo nunca pierde' };
  if (lastRole === 'Vidente' && gamesPlayed >= 5)
    return { title: 'Profeta', emoji: '🔮', color: 'text-violet-300', description: 'Ve lo que los demás no' };
  if (lastRole === 'Médium' && gamesPlayed >= 5)
    return { title: 'Entre Mundos', emoji: '👻', color: 'text-slate-300', description: 'Habla con los muertos' };

  // Supervivencia extrema
  if (winRate < 0.25 && gamesPlayed >= 8) return { title: 'Carne de Cañón', emoji: '💀', color: 'text-gray-400', description: 'Muere primero, siempre' };

  // Veteranía sin titularlos "grandes"
  if (gamesPlayed >= 50) return { title: 'Veterano de Guerra', emoji: '⚔️', color: 'text-amber-400', description: `${gamesPlayed} partidas` };
  if (gamesPlayed >= 20) return { title: 'Habitué', emoji: '🏠', color: 'text-sky-300', description: 'El pueblo es su hogar' };

  return null;
}

export interface XPResult {
  xpGained: number;
  newTotalXp: number;
  newLevel: number;
}

export async function awardXP(
  uid: string,
  { isWin, hasSpecialRole, consecutiveWins }: { isWin: boolean; hasSpecialRole: boolean; consecutiveWins?: number }
): Promise<XPResult> {
  const streak = consecutiveWins ?? 0;
  const streakBonus = isWin && streak > 1 ? XP_STREAK_BONUS * Math.min(streak, 5) : 0;
  const xpGained = XP_PER_GAME + (isWin ? XP_PER_WIN : 0) + (hasSpecialRole ? XP_SPECIAL_ROLE : 0) + streakBonus;

  const ref = doc(db, 'users', uid);

  // Transacción: lee el XP actual, suma y escribe. Funciona aunque el doc no exista.
  const newTotalXp = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().xp ?? 0) : 0;
    const currentPlayed = snap.exists() ? (snap.data().gamesPlayed ?? 0) : 0;
    const currentWon = snap.exists() ? (snap.data().gamesWon ?? 0) : 0;
    const newXp = current + xpGained;

    if (!snap.exists()) {
      // Primer documento del usuario — crear con todos los campos
      tx.set(ref, {
        xp: newXp,
        gamesPlayed: 1,
        gamesWon: isWin ? 1 : 0,
        consecutiveWins: isWin ? 1 : 0,
      }, { merge: true });
    } else {
      tx.set(ref, {
        xp: newXp,
        gamesPlayed: currentPlayed + 1,
        gamesWon: isWin ? currentWon + 1 : currentWon,
        consecutiveWins: isWin ? (snap.data().consecutiveWins ?? 0) + 1 : 0,
      }, { merge: true });
    }
    return newXp;
  });

  return { xpGained, newTotalXp, newLevel: xpToLevel(newTotalXp) };
}
