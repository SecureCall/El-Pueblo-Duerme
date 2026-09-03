import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { assignRoles } from '@/components/game/play/roles';
import { BOT_NAMES, assignBotType } from '@/lib/bots/botSystem';

type Player = {
  uid: string;
  name: string;
  photoURL?: string;
  isHost?: boolean;
  isAlive?: boolean;
  role?: string | null;
  isAI?: boolean;
  botType?: string;
  level?: number;
  lastSeen?: number;
};

const ERRORS: Record<string, [string, number]> = {
  GAME_NOT_FOUND: ['Partida no encontrada', 404],
  NOT_HOST: ['Solo el anfitrión puede iniciar la partida', 403],
  NOT_LOBBY: ['La partida ya no está en el lobby', 409],
  NOT_ENOUGH_PLAYERS: ['No hay suficientes jugadores para iniciar', 409],
  INVALID_GAME: ['Configuración de partida inválida', 409],
};

function createBots(players: Player[], maxPlayers: number): Player[] {
  const count = Math.max(0, maxPlayers - players.length);
  if (count === 0) return [];

  const usedNames = new Set(players.map(p => p.name));
  const available = BOT_NAMES.filter(name => !usedNames.has(name));

  return Array.from({ length: count }, (_, index) => ({
    uid: `ai_${randomUUID()}`,
    name: available[index] ?? `Jugador IA ${index + 1}`,
    photoURL: '',
    isHost: false,
    isAlive: true,
    role: null,
    isAI: true,
    botType: assignBotType(),
    level: 1,
    lastSeen: Date.now(),
  }));
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    let result: { playerCount: number; wolves: number } | null = null;

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');

      const game = snap.data()!;
      if (game.hostUid !== uid) throw new Error('NOT_HOST');
      if (game.status !== 'lobby' || game.phase !== 'lobby') throw new Error('NOT_LOBBY');

      const rawPlayers = Array.isArray(game.players) ? game.players : [];
      const players: Player[] = rawPlayers.filter((p: any) => typeof p?.uid === 'string');
      const maxPlayers = Number(game.maxPlayers);
      const configuredWolves = Number(game.wolves);

      if (!Number.isInteger(maxPlayers) || maxPlayers < 3 || maxPlayers > 32) throw new Error('INVALID_GAME');
      if (!Number.isInteger(configuredWolves) || configuredWolves < 1 || configuredWolves >= maxPlayers) throw new Error('INVALID_GAME');

      const realPlayers = players.filter(p => !p.isAI);
      if (game.fillWithAI) {
        if (realPlayers.length < 1) throw new Error('NOT_ENOUGH_PLAYERS');
      } else if (players.length < 4) {
        throw new Error('NOT_ENOUGH_PLAYERS');
      }

      let allPlayers = players;
      if (game.fillWithAI && players.length < maxPlayers) {
        allPlayers = [...players, ...createBots(players, maxPlayers)];
      }

      if (allPlayers.length < 3 || allPlayers.length > maxPlayers) throw new Error('INVALID_GAME');

      const scaledWolves = Math.max(
        1,
        Math.round((configuredWolves / maxPlayers) * allPlayers.length),
      );

      const assigned = assignRoles(
        allPlayers.map(p => ({ uid: p.uid, name: p.name, isAI: p.isAI })),
        Math.min(scaledWolves, allPlayers.length - 1),
        Array.isArray(game.specialRoles) ? game.specialRoles : [],
      );

      const nextPlayers = allPlayers.map(p => ({
        ...p,
        isAlive: true,
        role: assigned[p.uid] ?? 'Aldeano',
        isHost: p.uid === uid,
      }));

      const now = new Date();
      for (const player of nextPlayers) {
        tx.set(
          gameRef.collection('playerRoles').doc(player.uid),
          { role: player.role, assignedAt: now, updatedAt: now },
          { merge: true },
        );
      }

      tx.update(gameRef, {
        status: 'playing',
        phase: 'night',
        roundNumber: 1,
        players: nextPlayers,
        playerCount: nextPlayers.length,
        startedAt: now,
        nightStartedAt: now,
      });

      result = { playerCount: nextPlayers.length, wolves: scaledWolves };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL';
    const [error, status] = ERRORS[message] ?? ['Error interno', 500];
    console.error('[game-start]', message);
    return NextResponse.json({ error }, { status });
  }
}
