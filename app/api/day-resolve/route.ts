import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const LEASE_MS = 30_000;

type LockDoc = {
  ownerUid: string;
  leaseId: string;
  round: number;
  expiresAt: number;
};

function makeLeaseId(uid: string) {
  return `${uid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId : '';
    const action = body.action === 'release' ? 'release' : 'claim';
    const leaseId = typeof body.leaseId === 'string' ? body.leaseId : '';
    if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const lockRef = gameRef.collection('locks').doc('dayResolution');

    if (action === 'release') {
      if (!leaseId) return NextResponse.json({ error: 'leaseId required' }, { status: 400 });
      const released = await db.runTransaction(async tx => {
        const snap = await tx.get(lockRef);
        if (!snap.exists) return false;
        const lock = snap.data() as LockDoc;
        if (lock.ownerUid !== tokenUid || lock.leaseId !== leaseId) return false;
        tx.delete(lockRef);
        return true;
      });
      return NextResponse.json({ ok: true, released });
    }

    const lease = makeLeaseId(tokenUid);
    const result = await db.runTransaction(async tx => {
      const [gameSnap, lockSnap] = await Promise.all([tx.get(gameRef), tx.get(lockRef)]);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const game = gameSnap.data()!;
      const players = Array.isArray(game.players) ? game.players as { uid: string; isAlive: boolean }[] : [];
      const host = players.find(p => p.uid === tokenUid);
      if (game.hostUid !== tokenUid || !host) throw new Error('NOT_HOST');
      if (game.phase !== 'day') throw new Error('NOT_DAY');

      const round = Number(game.roundNumber ?? 1);
      const now = Date.now();
      if (lockSnap.exists) {
        const lock = lockSnap.data() as LockDoc;
        if (lock.expiresAt > now) throw new Error('LOCKED');
      }

      tx.set(lockRef, { ownerUid: tokenUid, leaseId: lease, round, expiresAt: now + LEASE_MS });
      return { round, leaseId: lease };
    });

    const gameSnap = await gameRef.get();
    const game = gameSnap.data()!;
    const players = Array.isArray(game.players) ? game.players as { uid: string; isAlive: boolean }[] : [];
    const alive = new Set(players.filter(p => p.isAlive).map(p => p.uid));
    const votesSnap = await gameRef.collection('votes').get();
    const votes: Record<string, string> = {};
    votesSnap.forEach(snap => {
      const data = snap.data();
      const voter = snap.id;
      const target = typeof data.target === 'string' ? data.target : '';
      const voteRound = Number(data.round);
      if (Number.isInteger(voteRound) && voteRound === result.round && alive.has(voter) && alive.has(target)) {
        votes[voter] = target;
      }
    });

    return NextResponse.json({ ok: true, leaseId: result.leaseId, round: result.round, votes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL';
    const map: Record<string, [string, number]> = {
      GAME_NOT_FOUND: ['Partida no encontrada', 404],
      NOT_HOST: ['Solo el host puede resolver el día', 403],
      NOT_DAY: ['No es fase de día', 409],
      LOCKED: ['La resolución del día ya está en curso', 409],
    };
    const [error, status] = map[message] ?? ['Error interno', 500];
    console.error('[day-resolve]', message);
    return NextResponse.json({ error }, { status });
  }
}
