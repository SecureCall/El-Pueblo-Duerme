/**
 * POST /api/sync-vote
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Security: verifies Firebase Auth token and that uid matches the authenticated user.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const ALLOWED_PHASES = new Set(['day', 'voting']);

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const gameId = typeof body?.gameId === 'string' ? body.gameId : '';
    const uid = typeof body?.uid === 'string' ? body.uid : '';
    const target = typeof body?.target === 'string' ? body.target : '';
    const round = Number(body?.round);
    if (!gameId || !uid || !target || !Number.isInteger(round)) {
      return NextResponse.json({ error: 'gameId, uid, target y round son obligatorios' }, { status: 400 });
    }
    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const voteRef = gameRef.collection('votes').doc(uid);
    const lockRef = gameRef.collection('locks').doc('dayResolution');

    await db.runTransaction(async tx => {
      const [gameSnap, lockSnap] = await Promise.all([tx.get(gameRef), tx.get(lockRef)]);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const game = gameSnap.data()!;
      const currentRound = Number(game.roundNumber ?? 1);
      if (!ALLOWED_PHASES.has(String(game.phase))) throw new Error('VOTE_PHASE_CLOSED');
      if (!Number.isInteger(currentRound) || round !== currentRound) throw new Error('STALE_ROUND');

      if (lockSnap.exists) {
        const lock = lockSnap.data() as { expiresAt?: number; status?: string };
        if (lock.status === 'resolving' || (typeof lock.expiresAt === 'number' && lock.expiresAt > Date.now())) {
          throw new Error('RESOLUTION_LOCKED');
        }
      }

      const phaseEndsAt = typeof game.phaseEndsAt === 'number' ? game.phaseEndsAt : null;
      if (phaseEndsAt !== null && Date.now() >= phaseEndsAt) throw new Error('VOTE_DEADLINE_PASSED');

      const players = Array.isArray(game.players)
        ? game.players as Array<{ uid?: string; isAlive?: boolean }>
        : [];
      const voter = players.find(p => p.uid === uid);
      const targetPlayer = players.find(p => p.uid === target);
      if (!voter?.isAlive) throw new Error('VOTER_INVALID');
      if (!targetPlayer?.isAlive) throw new Error('TARGET_INVALID');

      const banned = new Set<string>([
        ...(Array.isArray(game.voteBanned) ? game.voteBanned : []),
        ...(typeof game.saboteadorBan === 'string' && game.saboteadorBan ? [game.saboteadorBan] : []),
      ]);
      if (banned.has(uid)) throw new Error('VOTER_BANNED');

      let actualTarget = target;
      if (game.sirenaLinked === uid && typeof game.sirenaUid === 'string' && game.sirenaUid) {
        const sirenaVoteSnap = await tx.get(gameRef.collection('votes').doc(game.sirenaUid));
        const sirenaVote = sirenaVoteSnap.exists ? sirenaVoteSnap.data() : null;
        if (sirenaVote?.round === currentRound && typeof sirenaVote.target === 'string') {
          const sirenaTarget = players.find(p => p.uid === sirenaVote.target && p.isAlive);
          if (sirenaTarget) actualTarget = sirenaTarget.uid;
        }
      }

      const now = Date.now();
      tx.set(voteRef, {
        target: actualTarget,
        round: currentRound,
        submittedAt: now,
        syncedAt: now,
      }, { merge: true });
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const code = err?.message;
    const statuses: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Partida no encontrada'],
      VOTE_PHASE_CLOSED: [409, 'No es fase de votación'],
      STALE_ROUND: [409, 'Ronda de voto no válida o desactualizada'],
      VOTE_DEADLINE_PASSED: [409, 'El tiempo de votación ha terminado'],
      RESOLUTION_LOCKED: [409, 'La resolución del día ya está en curso'],
      VOTER_INVALID: [403, 'Jugador no válido o muerto'],
      TARGET_INVALID: [403, 'Objetivo no válido'],
      VOTER_BANNED: [403, 'Este jugador no puede votar'],
    };
    const [status, message] = statuses[code] ?? [500, 'Error interno'];
    if (status >= 500) console.error('[sync-vote]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
