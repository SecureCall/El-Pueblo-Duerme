import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';
import { readNightSubmissions } from '@/lib/server/nightSubmissions';
import { validatePersistedNightSubmissions } from '@/lib/server/nightResolveValidation';
import { createNightResolutionInput } from '@/lib/server/nightResolutionInput';
import { readNightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';
import { resolveNightActions } from '@/lib/server/nightResolutionEngine';
import { claimNightResolution, releaseNightResolution, renewNightResolution } from '@/lib/server/nightResolutionLock';
import { canonicalizeWolfTeam } from '@/lib/server/wolfTeam';

const RESOLUTION_HEARTBEAT_MS = 30_000;

function nextDayEnd(now: number, aliveCount: number): number {
  const base = Math.min(120, Math.max(60, aliveCount * 10));
  return now + base * 1000 + 2000;
}

/** Server-side, deterministic night-resolution boundary. */
export async function POST(request: Request) {
  let claimedGameId: string | null = null;
  let claimedRound: number | null = null;
  let claimedLeaseId: string | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let leaseLost = false;

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
    const isPlayer = players.some(
      (player) => player && typeof player === 'object' && 'uid' in player && player.uid === user.uid,
    );
    if (!isPlayer) return NextResponse.json({ error: 'Not a player in this game' }, { status: 403 });
    if (game.phase !== 'night') return NextResponse.json({ error: 'Night phase is not active' }, { status: 409 });

    const roundNumber = typeof game.roundNumber === 'number' ? game.roundNumber : null;
    if (roundNumber === null) return NextResponse.json({ error: 'Invalid night round' }, { status: 409 });

    const lock = await claimNightResolution(db, gameId, roundNumber);
    if (!lock.acquired || !lock.leaseId) {
      return NextResponse.json(
        { error: lock.reason === 'already_resolved' ? 'Night already resolved' : 'Night resolution already in progress' },
        { status: 409 },
      );
    }

    claimedGameId = gameId;
    claimedRound = roundNumber;
    claimedLeaseId = lock.leaseId;

    heartbeat = setInterval(() => {
      if (!claimedGameId || claimedRound === null || !claimedLeaseId) return;
      void renewNightResolution(db, claimedGameId, claimedRound, claimedLeaseId)
        .then((renewed) => {
          if (!renewed) leaseLost = true;
        })
        .catch(() => {
          leaseLost = true;
        });
    }, RESOLUTION_HEARTBEAT_MS);

    const submissions = await readNightSubmissions(gameId, roundNumber);
    const validation = validatePersistedNightSubmissions(
      players as Array<Record<string, unknown>>,
      submissions,
      roundNumber,
    );
    const groupedSubmissions = validation.valid.map((submission) => ({
      actorUid: submission.actorUid,
      role: submission.role,
      actions: submission.actions,
      roundNumber: submission.roundNumber,
      submittedAt: submission.submittedAt,
      syncedAt: submission.syncedAt,
    }));

    const input = createNightResolutionInput(
      gameId,
      roundNumber,
      players as Array<Record<string, unknown>>,
      groupedSubmissions,
      game,
    );
    const roleSnapshot = await readNightRoleSnapshot(
      gameId,
      input.players.map((player) => player.uid),
    );
    const result = resolveNightActions(input, roleSnapshot);

    if (leaseLost) throw new Error('night_resolution_lease_lost');

    const acceptedAction = (action: string) =>
      result.acceptedActions.find((item) => item.action === action) ?? null;
    const ancianaTarget = acceptedAction('ancianaTarget')?.targetUid ?? null;
    const actorTarget = (action: string): string | null => {
      const item = acceptedAction(action);
      return item?.targetUid && item.actorUid !== ancianaTarget ? item.targetUid : null;
    };
    const guardianLastTarget = actorTarget('guardianTarget');
    const doctorLastTarget = actorTarget('doctorTarget');
    const doctorAction = acceptedAction('doctorTarget');
    const doctorSelfUsed = Boolean(
      doctorAction?.targetUid && doctorAction.targetUid === doctorAction.actorUid,
    );
    const primaryWolfTarget = result.wolfResolution.targetUid;
    const primaryWolfVictim = primaryWolfTarget
      ? result.statePatch.players.find((player) => player.uid === primaryWolfTarget)
      : null;
    const dayEliminatedUid = primaryWolfVictim && !primaryWolfVictim.isAlive
      ? primaryWolfTarget
      : null;
    const canonicalWolfTeam = canonicalizeWolfTeam(
      result.statePatch.roles,
      result.statePatch.wolfTeam,
    );

    // The game state and the resolution lease are committed in one transaction.
    // This is the fencing boundary: an expired/reclaimed resolver can calculate
    // a result, but it cannot mutate the game after another resolver owns the lease.
    await db.runTransaction(async (tx) => {
      const lockRef = gameRef.collection('nightResolutions').doc(String(roundNumber));
      const [currentGameSnap, lockSnap] = await Promise.all([
        tx.get(gameRef),
        tx.get(lockRef),
      ]);

      if (!currentGameSnap.exists) throw new Error('night_state_changed_before_commit');
      if (!lockSnap.exists) throw new Error('night_resolution_lock_missing');

      const currentGame = currentGameSnap.data() as Record<string, unknown>;
      const lockData = lockSnap.data() as Record<string, unknown>;

      if (currentGame.phase !== 'night' || currentGame.roundNumber !== roundNumber) {
        throw new Error('night_state_changed_before_commit');
      }
      if (lockData.status !== 'resolving' || lockData.leaseId !== claimedLeaseId) {
        throw new Error('night_resolution_lease_lost');
      }

      const patch = result.statePatch;
      const now = Date.now();
      const finalWinner = result.winner;
      const nextPhase = finalWinner ? 'ended' : 'day';
      const aliveCount = patch.players.filter((player) => player.isAlive).length;
      const previousForenseResults = currentGame.forenseResults && typeof currentGame.forenseResults === 'object'
        ? currentGame.forenseResults as Record<string, string>
        : {};

      tx.update(gameRef, {
        players: patch.players,
        roles: patch.roles,
        eliminatedHistory: patch.eliminatedHistory,
        wolfTeam: canonicalWolfTeam,
        antigoHit: patch.antigoHit,
        cambiaformasTargets: patch.cambiaformasTargets,
        salvajeMentors: patch.salvajeMentors,
        virginiawoolFate: patch.virginiawoolFate,
        perroLoboChoices: patch.perroLoboChoices,
        cultMembers: patch.cultMembers,
        vampiroBites: patch.vampiroBites,
        vampiroKills: patch.vampiroKills,
        pescadorBoat: patch.pescadorBoat,
        enchanted: patch.enchanted,
        hadaLinked: patch.hadaLinked,
        bansheePoints: patch.bansheePoints,
        vigiaUsed: patch.vigiaUsed,
        vigiaKnowsWolves: patch.vigiaKnowsWolves,
        angelResucitadorUsed: patch.angelResucitadorUsed,
        espiaUsed: patch.espiaUsed,
        sirenaUid: patch.sirenaUid,
        sirenaLinked: patch.sirenaLinked,
        lobosBlocked: result.deathEffects.nextNightWolfBlock,
        criaLoboRage: patch.criaLoboRage,
        hechiceraLifeUsed: patch.hechiceraLifeUsed,
        hechiceraPoisonUsed: patch.hechiceraPoisonUsed,
        brujaFoundVidente: patch.brujaFoundVidente,
        brujaProtectedUid: patch.brujaProtectedUid,
        guardianLastTarget,
        doctorLastTarget,
        doctorSelfUsed,
        dayEliminatedUid,
        cazadorPendingShot: patch.cazadorPendingShot,
        seerReveal: patch.seerReveal,
        seerReveal2: patch.seerReveal2,
        profetaReveal: patch.profetaReveal,
        silencedPlayers: patch.silencedPlayers,
        forenseResults: { ...previousForenseResults, ...patch.forenseResults },
        saboteadorBan: patch.saboteadorBan,
        phase: nextPhase,
        winners: finalWinner,
        winMessage: result.winMessage,
        nightActions: {},
        nightSubmissions: {},
        dayVotes: {},
        dayStartedAt: finalWinner ? null : now,
        phaseEndsAt: finalWinner ? null : nextDayEnd(now, aliveCount),
        bansheePredictionUid: null,
      });

      // Keep the private role source synchronized with authoritative transformations.
      for (const [uid, role] of Object.entries(patch.roles)) {
        tx.set(
          gameRef.collection('playerRoles').doc(uid),
          { role, updatedAt: now },
          { merge: true },
        );
      }

      tx.update(lockRef, {
        status: 'resolved',
        resolvedAt: new Date(now),
        expiresAt: null,
      });
    });

    claimedGameId = null;
    claimedRound = null;
    claimedLeaseId = null;

    return NextResponse.json({
      ok: true,
      gameId,
      result,
      rejected: validation.rejected,
    });
  } catch (error) {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;

    if (claimedGameId && claimedRound !== null && claimedLeaseId) {
      try {
        const { db } = getSdks();
        await releaseNightResolution(db, claimedGameId, claimedRound, claimedLeaseId);
      } catch (releaseError) {
        console.error('[resolve-night] failed to release resolution lease', releaseError);
      }
    }

    console.error('[resolve-night] request failed', error);
    const message = error instanceof Error ? error.message : 'unknown_error';
    const status = message.startsWith('night_') ? 409 : 401;
    return NextResponse.json(
      { error: status === 409 ? message : 'Unauthorized or invalid request' },
      { status },
    );
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}
