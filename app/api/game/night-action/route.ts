import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { z } from 'zod';

const Schema = z.object({
  gameId: z.string().trim().min(1).max(128),
  action: z.string().trim().min(1).max(64),
  targetUid: z.string().trim().max(128).optional().nullable(),
});

const ACTIONS: Record<string, string[]> = {
  wolfKill: ['wolf', 'alpha_wolf', 'white_wolf', 'wolf_cub'],
  protect: ['guardian', 'doctor'],
  investigate: ['seer', 'detective', 'forensic'],
  silence: ['silencer'],
  cupid: ['cupid'],
  resurrect: ['resurrector', 'angel'],
  poison: ['witch'],
  save: ['witch'],
  recruit: ['cult_leader'],
  vampireKill: ['vampire'],
  fairyProtect: ['fairy'],
};

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
      if (game.phase !== 'night') throw new Error('NOT_NIGHT');
      const players = Array.isArray(game.players) ? game.players : [];
      const player = players.find((p: any) => p?.uid === uid);
      if (!player) throw new Error('NOT_PLAYER');
      if (player.isAlive === false) throw new Error('DEAD');
      const allowedRoles = ACTIONS[input.action];
      if (!allowedRoles || !allowedRoles.includes(String(player.role))) throw new Error('ACTION_FORBIDDEN');
      if (input.targetUid) {
        const target = players.find((p: any) => p?.uid === input.targetUid);
        if (!target) throw new Error('TARGET_NOT_FOUND');
        if (target.isAlive === false) throw new Error('TARGET_DEAD');
        if (input.targetUid === uid && input.action === 'wolfKill') throw new Error('INVALID_TARGET');
      }
      const actions = { ...(game.nightActions ?? {}) };
      actions[uid] = { action: input.action, targetUid: input.targetUid ?? null, submittedAt: Timestamp.now() };
      tx.update(ref, { nightActions: actions });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const map: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Sala no encontrada', 404], NOT_NIGHT: ['No es la fase nocturna', 409], NOT_PLAYER: ['No eres jugador de esta partida', 403], DEAD: ['Un jugador muerto no puede actuar', 403], ACTION_FORBIDDEN: ['Acción no permitida para tu rol', 403], TARGET_NOT_FOUND: ['Objetivo no encontrado', 400], TARGET_DEAD: ['El objetivo ya está muerto', 409], INVALID_TARGET: ['Objetivo inválido', 400],
    };
    if (map[code]) return NextResponse.json({ error: map[code][0] }, { status: map[code][1] });
    console.error('game/night-action failed', error);
    return NextResponse.json({ error: 'No se pudo registrar la acción' }, { status: 500 });
  }
}
