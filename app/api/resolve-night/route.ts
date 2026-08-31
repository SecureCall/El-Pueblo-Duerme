import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';
import { readNightSubmissions } from '@/lib/server/nightSubmissions';
import { validatePersistedNightSubmissions } from '@/lib/server/nightResolveValidation';
import { createNightResolutionInput } from '@/lib/server/nightResolutionInput';
import { readNightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';
import { resolveNightActions } from '@/lib/server/nightResolutionEngine';
import { claimNightResolution, markNightResolutionResolved, releaseNightResolution, renewNightResolution } from '@/lib/server/nightResolutionLock';

export async function POST(request: Request) {
  let claimedGameId: string | null = null;
  let claimedRound: number | null = null;
  let claimedLeaseId: string | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  try {
    const user = await verifyAuthToken(request);
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    const game = gameSnap.data() as Record<string, unknown>;
    const players = Array.isArray(game.players) ? game.players : [];
    const isPlayer = players.some((player) => player && typeof player === 'object' && 'uid' in player && player.uid === user.uid);
    if (!isPlayer) return NextResponse.json({ error: 'Not a player in this game' }, { status: 403 });
    if (game.phase !== 'night') return NextResponse.json({ error: 'Night phase is not active' }, { status: 409 });
    const roundNumber = typeof game.roundNumber === 'number' ? game.roundNumber : null;
    if (roundNumber === null) return NextResponse.json({ error: 'Invalid night round' }, { status: 409 });
    const lock = await claimNightResolution(db, gameId, roundNumber);
    if (!lock.acquired || !lock.leaseId) return NextResponse.json({ error: lock.reason === 'already_resolved' ? 'Night already resolved' : 'Night resolution already in progress' }, { status: 409 });
    claimedGameId = gameId;
    claimedRound = roundNumber;
    claimedLeaseId = lock.leaseId;
    heartbeat = setInterval(() => {
      if (claimedGameId && claimedRound !== null && claimedLeaseId) void renewNightResolution(db, claimedGameId, claimedRound, claimedLeaseId).catch((error) => console.error('[resolve-night] lease renewal failed', error));
    }, 60_000);
    const submissions = await readNightSubmissions(gameId);
    const validation = validatePersistedNightSubmissions(players as Array<Record<string, unknown>>, submissions, roundNumber);
    const groupedSubmissions = validation.valid.map((submission) => ({ actorUid: submission.actorUid, role: submission.role, actions: submission.actions }));
    const input = createNightResolutionInput(gameId, roundNumber, players as Array<Record<string, unknown>>, groupedSubmissions, game);
    const roleSnapshot = await readNightRoleSnapshot(gameId, input.players.map((player) => player.uid));
    const result = resolveNightActions(input, roleSnapshot);
    if (!(await markNightResolutionResolved(db, gameId, roundNumber, claimedLeaseId))) throw new Error('Night resolution lease was lost before commit');
    claimedGameId = null;
    claimedRound = null;
    claimedLeaseId = null;
    return NextResponse.json({ ok: true, gameId, result, rejected: validation.rejected });
  } catch (error) {
    if (claimedGameId && claimedRound !== null && claimedLeaseId) {
      try {
        const { db } = getSdks();
        await releaseNightResolution(db, claimedGameId, claimedRound, claimedLeaseId);
      } catch (releaseError) { console.error('[resolve-night] failed to release resolution lease', releaseError); }
    }
    console.error('[resolve-night] request failed', error);
    return NextResponse.json({ error: 'Unauthorized or invalid request' }, { status: 401 });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}
