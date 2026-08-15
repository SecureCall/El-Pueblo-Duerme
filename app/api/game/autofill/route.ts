import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { z } from 'zod';

const Schema = z.object({
  gameId: z.string().trim().min(1).max(128),
});

const BOT_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jessie', 'Jamie', 'Kai', 'Rowan'];

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let input: z.infer<typeof Schema>;
  try { input = Schema.parse(await req.json()); } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }); }

  try {
    initAdminApp();
    const db = getFirestore();
    const ref = db.collection('games').doc(input.gameId);

    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data() ?? {};
      if (game.status !== 'lobby') throw new Error('GAME_STARTED');
      if (game.hostUid !== uid) throw new Error('NOT_HOST');

      const players = Array.isArray(game.players) ? game.players : [];
      const humans = players.filter((p: any) => !p?.isAI);
      if (humans.length >= 4) return;

      const maxPlayers = Number(game.maxPlayers) || 10;
      const targetTotal = Math.min(maxPlayers, Math.max(6, humans.length + 3));
      const needed = Math.max(0, targetTotal - players.length);
      if (!needed) return;

      const usedNames = new Set(players.map((p: any) => p?.name).filter(Boolean));
      const available = BOT_NAMES.filter(name => !usedNames.has(name));
      const bots = Array.from({ length: needed }, (_, i) => ({
        uid: `ai_${Date.now()}_${i}`,
        name: available[i] ?? `Jugador IA ${i + 1}`,
        photoURL: '',
        isHost: false,
        isAlive: true,
        role: null,
        isAI: true,
      }));

      const nextPlayers = [...players, ...bots];
      tx.update(ref, { players: nextPlayers, playerCount: nextPlayers.length, fillWithAI: true });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
    if (code === 'GAME_STARTED') return NextResponse.json({ error: 'La partida ya ha comenzado' }, { status: 409 });
    if (code === 'NOT_HOST') return NextResponse.json({ error: 'Solo el anfitrión puede rellenar la sala' }, { status: 403 });
    console.error('game/autofill failed', error);
    return NextResponse.json({ error: 'No se pudo rellenar la sala' }, { status: 500 });
  }
}
