/**
 * POST /api/day-vote
 * Canonical online vote submission. All validation happens server-side.
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
    if (!gameId || !uid || !target || !Number.isInteger(round)) return NextResponse.json({ error: 'gameId, uid, target y round son obligatorios' }, { status: 400 });
    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const voteRef = gameRef.collection('votes').doc(uid);
    const lockRef = gameRef.collection('locks').doc('dayResolution');
    await db.runTransaction(async tx => {
      const behaviorRef = db.collection('playerBehavior').doc(uid);
      const [gameSnap, lockSnap, previousVoteSnap, behaviorSnap] = await Promise.all([tx.get(gameRef), tx.get(lockRef), tx.get(voteRef), tx.get(behaviorRef)]);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const game = gameSnap.data()!;
      const currentRound = Number(game.roundNumber ?? 1);
      if (!ALLOWED_PHASES.has(String(game.phase))) throw new Error('VOTE_PHASE_CLOSED');
      if (!Number.isInteger(currentRound) || round !== currentRound) throw new Error('STALE_ROUND');
      if (lockSnap.exists) {
        const lock = lockSnap.data() as { expiresAt?: number };
        if (typeof lock.expiresAt === 'number' && lock.expiresAt > Date.now()) throw new Error('RESOLUTION_LOCKED');
      }
      const players = Array.isArray(game.players) ? game.players as Array<{ uid?: string; isAlive?: boolean; isAI?: boolean }> : [];
      const voter = players.find(p => p.uid === uid);
      const targetPlayer = players.find(p => p.uid === target);
      if (!voter?.isAlive) throw new Error('VOTER_INVALID');
      if (!targetPlayer?.isAlive) throw new Error('TARGET_INVALID');
      if (tokenUid !== uid) throw new Error('UID_FORBIDDEN');
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
      tx.set(voteRef, { target: actualTarget, round: currentRound, submittedAt: now });

      // Count only the first accepted vote for this round. Re-votes replace the
      // canonical vote but must not manufacture additional behavior samples.
      const previous = previousVoteSnap.exists ? previousVoteSnap.data() : null;
      if (!previous || Number(previous.round) !== currentRound) {
        const behavior = behaviorSnap.exists ? behaviorSnap.data()! : {};
        const startedAt = Number(game.dayStartedAt ?? 0);
        const voteTimeMs = startedAt > 0 ? now - startedAt : 0;
        if (voteTimeMs >= 0 && voteTimeMs <= 600000) {
          tx.set(behaviorRef, {
            uid,
            totalVoteTimeMs: (typeof behavior.totalVoteTimeMs === 'number' ? behavior.totalVoteTimeMs : 0) + voteTimeMs,
            voteCount: (typeof behavior.voteCount === 'number' ? behavior.voteCount : 0) + 1,
            lastUpdated: now,
          }, { merge: true });
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const code = err?.message;
    const statuses: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Partida no encontrada'], VOTE_PHASE_CLOSED: [409, 'No es fase de votación'],
      STALE_ROUND: [409, 'Ronda de voto no válida o desactualizada'], VOTER_INVALID: [403, 'Jugador no válido o muerto'],
      TARGET_INVALID: [403, 'Objetivo no válido'], UID_FORBIDDEN: [403, 'No autorizado para emitir este voto'],
      VOTER_BANNED: [403, 'Este jugador no puede votar'], RESOLUTION_LOCKED: [409, 'La resolución del día ya está en curso'],
    };
    const [status, message] = statuses[code] ?? [500, 'Error interno'];
    if (status >= 500) console.error('[day-vote]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
