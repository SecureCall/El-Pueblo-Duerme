import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { ROLES } from '@/components/game/play/roles';

const XP_PER_GAME = 50;
const XP_PER_WIN = 100;
const XP_SPECIAL_ROLE = 25;
const XP_STREAK_BONUS = 30;
const MAX_LEVEL = 50;
const XP_PER_LEVEL = 200;

function xpToLevel(xp: number): number {
  return Math.min(MAX_LEVEL, Math.floor((xp ?? 0) / XP_PER_LEVEL) + 1);
}

function getGameId(req: NextRequest, body: unknown): string | null {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const candidate = (body as Record<string, unknown>).gameId;
    if (typeof candidate === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(candidate)) return candidate;
  }

  const referer = req.headers.get('referer');
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const match = url.pathname.match(/^\/game\/([A-Za-z0-9_-]{1,128})\/play\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function didPlayerWin(winner: unknown, role: string, uid: string, game: Record<string, unknown>): boolean {
  if (typeof winner !== 'string') return false;
  const roleInfo = ROLES[role];
  if (!roleInfo) return false;

  if (winner === 'village') return roleInfo.team === 'village';
  if (winner === 'wolves') return roleInfo.team === 'wolves';
  if (winner === 'flautista') return role === 'Flautista';
  if (winner === 'angel') return role === 'Ángel';
  if (winner === 'picaro') return role === 'Pícaro';
  if (winner === 'vampiro') return role === 'Vampiro';
  if (winner === 'ebrio') return role === 'Hombre Ebrio';
  if (winner === 'verdugo') return role === 'Verdugo';
  if (winner === 'culto' || winner === 'lider_culto') return role === 'Líder del Culto';
  if (winner === 'pescador') return role === 'Pescador';
  if (winner === 'lobo_blanco') return role === 'Lobo Blanco';
  if (winner === 'banshee') return role === 'Banshee';
  if (winner === 'hadas') return role === 'Hada Buscadora' || role === 'Hada Durmiente';
  if (winner === 'lovers') {
    const lovers = game.lovers;
    return Array.isArray(lovers) && lovers.length === 2 && lovers.includes(uid);
  }
  return false;
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const gameId = getGameId(req, body);
    if (!gameId) {
      return NextResponse.json({ error: 'Partida no identificada' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const userRef = db.collection('users').doc(uid);
    const awardRef = userRef.collection('xpAwards').doc(gameId);
    const roleRef = gameRef.collection('playerRoles').doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const [gameSnap, userSnap, awardSnap, roleSnap] = await Promise.all([
        tx.get(gameRef),
        tx.get(userRef),
        tx.get(awardRef),
        tx.get(roleRef),
      ]);

      if (!gameSnap.exists) throw new Error('xp_game_not_found');
      if (awardSnap.exists) throw new Error('xp_already_awarded');

      const game = gameSnap.data() as Record<string, unknown>;
      if (game.phase !== 'ended' || typeof game.winners !== 'string') {
        throw new Error('xp_game_not_finished');
      }

      const players = Array.isArray(game.players) ? game.players : [];
      const player = players.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).uid === uid) as Record<string, unknown> | undefined;
      if (!player) throw new Error('xp_not_a_player');

      const role = roleSnap.exists ? roleSnap.data()?.role : undefined;
      if (typeof role !== 'string' || !ROLES[role]) throw new Error('xp_role_unavailable');

      const isWin = didPlayerWin(game.winners, role, uid, game);
      const roleInfo = ROLES[role];
      const hasSpecialRole = roleInfo.team !== 'village' || role !== 'Aldeano';

      const data = userSnap.exists ? userSnap.data()! : {};
      const current = typeof data.xp === 'number' && Number.isFinite(data.xp) ? data.xp : 0;
      const currentPlayed = typeof data.gamesPlayed === 'number' && Number.isFinite(data.gamesPlayed) ? data.gamesPlayed : 0;
      const currentWon = typeof data.gamesWon === 'number' && Number.isFinite(data.gamesWon) ? data.gamesWon : 0;
      const currentStreak = typeof data.consecutiveWins === 'number' && Number.isFinite(data.consecutiveWins) ? data.consecutiveWins : 0;

      const newStreak = isWin ? currentStreak + 1 : 0;
      const streakBonus = isWin && newStreak > 1 ? XP_STREAK_BONUS * Math.min(newStreak, 5) : 0;
      const xpGained = XP_PER_GAME + (isWin ? XP_PER_WIN : 0) + (hasSpecialRole ? XP_SPECIAL_ROLE : 0) + streakBonus;
      const newXp = current + xpGained;

      tx.set(userRef, {
        xp: newXp,
        gamesPlayed: currentPlayed + 1,
        gamesWon: isWin ? currentWon + 1 : currentWon,
        consecutiveWins: newStreak,
        lastXpAwardedAt: Date.now(),
      }, { merge: true });

      tx.create(awardRef, {
        gameId,
        uid,
        xpGained,
        isWin,
        role,
        createdAt: new Date(),
      });

      return { xpGained, newXp, newStreak };
    });

    return NextResponse.json({
      xpGained: result.xpGained,
      newTotalXp: result.newXp,
      newLevel: xpToLevel(result.newXp),
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'xp_already_awarded') {
        return NextResponse.json({ error: 'XP ya otorgada para esta partida', alreadyAwarded: true }, { status: 409 });
      }
      if (err.message === 'xp_game_not_found') return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
      if (err.message === 'xp_game_not_finished') return NextResponse.json({ error: 'La partida no ha terminado' }, { status: 409 });
      if (err.message === 'xp_not_a_player') return NextResponse.json({ error: 'Jugador no válido' }, { status: 403 });
      if (err.message === 'xp_role_unavailable') return NextResponse.json({ error: 'Rol no disponible' }, { status: 409 });
    }
    console.error('[award-xp]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}