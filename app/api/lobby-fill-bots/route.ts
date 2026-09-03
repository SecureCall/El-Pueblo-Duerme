import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
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
  NOT_HOST: ['Solo el anfitrión puede rellenar la sala', 403],
  NOT_LOBBY: ['La partida ya no está en el lobby', 409],
  INVALID_GAME: ['Configuración de partida inválida', 409],
};

function createBots(players: Player[], targetTotal: number): Player[] {
  const count = Math.max(0, targetTotal - players.length);
  if (count === 0) return [];
  const usedNames = new Set(players.map(p => p.name));
  const available = BOT_NAMES.filter(name => !usedNames.has(name));
  return Array.from({ length: count }, (_, index) => ({
    uid: `ai_${randomUUID()}`,
    name: available[index] ?? `Jugador IA ${index + 1}`,
    photoURL: '', isHost: false, isAlive: true, role: null, isAI: true,
    botType: assignBotType(), level: 1, lastSeen: Date.now(),
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
    let result: { playerCount: number; added: number } | null = null;

    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data()!;
      if (game.hostUid !== uid) throw new Error('NOT_HOST');
      if (game.status !== 'lobby' || game.phase !== 'lobby') throw new Error('NOT_LOBBY');

      const maxPlayers = Number(game.maxPlayers);
      if (!Number.isInteger(maxPlayers) || maxPlayers < 3 || maxPlayers > 32) throw new Error('INVALID_GAME');

      const rawPlayers = Array.isArray(game.players) ? game.players : [];
      const players: Player[] = rawPlayers.filter((p: any) => typeof p?.uid === 'string');
      const humans = players.filter(p => !p.isAI);
      if (humans.length >= 4 || players.length >= maxPlayers) {
        result = { playerCount: players.length, added: 0 };
        return;
      }

      const targetTotal = Math.min(maxPlayers, Math.max(6, humans.length + 3));
      const bots = createBots(players, targetTotal);
      const nextPlayers = [...players, ...bots];
      if (nextPlayers.length > maxPlayers) throw new Error('INVALID_GAME');

      tx.update(gameRef, {
        players: nextPlayers,
        playerCount: nextPlayers.length,
        fillWithAI: true,
      });
      result = { playerCount: nextPlayers.length, added: bots.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL';
    const [error, status] = ERRORS[message] ?? ['Error interno', 500];
    console.error('[lobby-fill-bots]', message);
    return NextResponse.json({ error }, { status });
  }
}
