import { getAuth } from 'firebase/auth';

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
  winsAsWolf?: number;
  winsAsVillage?: number;
  survivedGames?: number;
  rolePlayCount?: Record<string, number>;
}): TitleConfig | null {
  const { gamesPlayed, winRate, consecutiveWins, lastRole, level,
          winsAsWolf = 0, survivedGames = 0, rolePlayCount = {} } = stats;
  if (gamesPlayed === 0) return null;

  // ── Racha — más urgente/viral ─────────────────────────────────────────
  if (consecutiveWins >= 7) return { title: 'Sin Derrota',  emoji: '🔥', color: 'text-orange-400', description: `${consecutiveWins} victorias seguidas` };
  if (consecutiveWins >= 5) return { title: 'Invencible',   emoji: '⚡', color: 'text-yellow-400', description: `Racha de ${consecutiveWins}` };
  if (consecutiveWins >= 3) return { title: 'En Racha',     emoji: '🎯', color: 'text-green-400',  description: `${consecutiveWins} seguidas` };

  // ── Maestría por nivel ────────────────────────────────────────────────
  if (level >= 45) return { title: 'El Inmortal', emoji: '👑', color: 'text-amber-300', description: 'Leyenda del pueblo' };
  if (level >= 35) return { title: 'El Maestro',  emoji: '💎', color: 'text-cyan-300',  description: 'Domina el tablero' };

  // ── Especialista en engaño (lobo) ─────────────────────────────────────
  if (winsAsWolf >= 8)  return { title: 'Depredador Nato',       emoji: '🐺', color: 'text-red-400',    description: `${winsAsWolf} victorias como lobo` };
  if (winsAsWolf >= 4)  return { title: 'Especialista en Engaño',emoji: '🎭', color: 'text-rose-400',   description: 'El pueblo nunca lo ve venir' };

  // ── Superviviente nato ─────────────────────────────────────────────────
  const survRate = gamesPlayed > 0 ? survivedGames / gamesPlayed : 0;
  if (survRate >= 0.75 && gamesPlayed >= 8)
    return { title: 'Nunca Muere',   emoji: '🛡️', color: 'text-teal-300',  description: 'Sobrevive hasta el final' };

  // ── El más sospechado (winRate baja jugando mucho) ────────────────────
  if (winRate < 0.30 && gamesPlayed >= 8)
    return { title: 'El Chivo Expiatorio', emoji: '🐐', color: 'text-gray-300', description: 'Siempre sospechoso' };
  if (winRate < 0.40 && gamesPlayed >= 12)
    return { title: 'El Más Sospechado',   emoji: '👁️', color: 'text-gray-400', description: 'Nunca lo creen inocente' };

  // ── Fanático de un rol ─────────────────────────────────────────────────
  const favRole = Object.entries(rolePlayCount).sort((a, b) => b[1] - a[1])[0];
  if (favRole && favRole[1] >= 6) {
    const roleFav = favRole[0];
    if (roleFav === 'Vidente')  return { title: 'El Omnisciente',  emoji: '🔮', color: 'text-violet-300', description: `${favRole[1]}× como ${roleFav}` };
    if (roleFav === 'Lobo')     return { title: 'El Lobo Eterno',  emoji: '🐺', color: 'text-red-400',   description: `${favRole[1]}× como ${roleFav}` };
    if (roleFav === 'Cazador')  return { title: 'El Cazador',      emoji: '🏹', color: 'text-amber-400', description: `${favRole[1]}× como ${roleFav}` };
    if (roleFav === 'Hechicera')return { title: 'La Hechicera',    emoji: '🧪', color: 'text-green-400', description: `${favRole[1]}× como ${roleFav}` };
    if (roleFav === 'Doctor')   return { title: 'El Doctor',       emoji: '💉', color: 'text-blue-400',  description: `${favRole[1]}× como ${roleFav}` };
    return { title: `Fan del ${roleFav}`, emoji: '⭐', color: 'text-white/70', description: `${favRole[1]}× el mismo rol` };
  }

  // ── Dominio por winRate ───────────────────────────────────────────────
  if (winRate >= 0.85 && gamesPlayed >= 10) return { title: 'El Oráculo',  emoji: '🧠', color: 'text-purple-400', description: 'Raramente se equivoca' };
  if (winRate >= 0.70 && gamesPlayed >= 8)  return { title: 'Estratega',   emoji: '🎖️', color: 'text-indigo-300', description: 'Mente táctica' };

  // ── Especialización por último rol ────────────────────────────────────
  if (lastRole === 'Vidente' && gamesPlayed >= 5)
    return { title: 'Profeta', emoji: '🔮', color: 'text-violet-300', description: 'Ve lo que los demás no' };
  if (lastRole === 'Médium' && gamesPlayed >= 5)
    return { title: 'Entre Mundos', emoji: '👻', color: 'text-slate-300', description: 'Habla con los muertos' };

  // ── Carne de cañón ────────────────────────────────────────────────────
  if (winRate < 0.25 && gamesPlayed >= 8)
    return { title: 'Carne de Cañón', emoji: '💀', color: 'text-gray-400', description: 'Muere primero, siempre' };

  // ── Veteranía ─────────────────────────────────────────────────────────
  if (gamesPlayed >= 50) return { title: 'Veterano de Guerra', emoji: '⚔️', color: 'text-amber-400', description: `${gamesPlayed} partidas` };
  if (gamesPlayed >= 20) return { title: 'Habitué',            emoji: '🏠', color: 'text-sky-300',   description: 'El pueblo es su hogar' };
  if (gamesPlayed >= 5)  return { title: 'Aldeano Conocido',   emoji: '🌙', color: 'text-white/50',  description: 'Conoce las reglas del juego' };

  return null;
}

export interface XPResult {
  xpGained: number;
  newTotalXp: number;
  newLevel: number;
}

export async function awardXP(
  uid: string,
  _result: { isWin: boolean; hasSpecialRole: boolean; consecutiveWins?: number },
): Promise<XPResult> {
  const currentUser = getAuth().currentUser;
  if (!currentUser || currentUser.uid !== uid) throw new Error('No autenticado');

  const token = await currentUser.getIdToken();
  const response = await fetch('/api/award-xp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? 'No se pudo otorgar XP');
  return data as XPResult;
}
