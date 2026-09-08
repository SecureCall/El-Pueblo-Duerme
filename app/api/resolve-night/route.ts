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
import { ensureServerAINightSubmissions } from '@/lib/server/aiNight';

const HEARTBEAT_MS = 30_000;
function nextDayEnd(now: number, aliveCount: number): number { const base = Math.min(120, Math.max(60, aliveCount * 10)); return now + base * 1000 + 2000; }

function leaseExpiresMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const toMillis = (value as { toMillis?: unknown }).toMillis;
  return typeof toMillis === 'function' ? toMillis.call(value) : 0;
}

export async function POST(request: Request) {
  let claimedGameId: string | null = null; let claimedRound: number | null = null; let claimedLeaseId: string | null = null; let heartbeat: ReturnType<typeof setInterval> | null = null;
  try {
    const user = await verifyAuthToken(request); const body = await request.json().catch(() => null); const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    const { db } = getSdks(); const gameRef = db.collection('games').doc(gameId); const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    const game = gameSnap.data() as Record<string, unknown>; const players = Array.isArray(game.players) ? game.players : [];
    const caller = players.find((p) => p && typeof p === 'object' && 'uid' in p && p.uid === user.uid) as Record<string, unknown> | undefined;
    if (!caller) return NextResponse.json({ error: 'Not a player in this game' }, { status: 403 });
    if (game.phase !== 'night') return NextResponse.json({ error: 'Night phase is not active' }, { status: 409 });
    const roundNumber = typeof game.roundNumber === 'number' ? game.roundNumber : null; if (roundNumber === null) return NextResponse.json({ error: 'Invalid night round' }, { status: 409 });

    // Manual resolution remains available to the current host. Non-host resolution is
    // permitted only through the legitimate automatic-completion condition below.
    const isHost = game.hostUid === user.uid;
    if (!isHost && caller.isAlive !== true) return NextResponse.json({ error: 'Only the host or a complete night can resolve' }, { status: 403 });

    // Generate trusted AI submissions before checking completion. This keeps the
    // automatic path independent from the host and safe across host takeover.
    await ensureServerAINightSubmissions(db, gameId, game, players as Array<Record<string, unknown>>, roundNumber);
    if (!isHost) {
      const aliveUids = players
        .filter((player) => player && typeof player === 'object' && (player as Record<string, unknown>).isAlive === true)
        .map((player) => (player as Record<string, unknown>).uid)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
      const submissionSnap = await gameRef.collection('nightSubmissions').get();
      const submittedUids = new Set(
        submissionSnap.docs
          .map((submission) => submission.data())
          .filter((data) => data && data.roundNumber === roundNumber)
          .map((data) => data.actorUid)
          .filter((value): value is string => typeof value === 'string'),
      );
      if (aliveUids.length === 0 || !aliveUids.every((aliveUid) => submittedUids.has(aliveUid))) {
        return NextResponse.json({ error: 'Night submissions are not complete' }, { status: 409 });
      }
    }

    const lock = await claimNightResolution(db, gameId, roundNumber); if (!lock.acquired || !lock.leaseId) return NextResponse.json({ error: lock.reason === 'already_resolved' ? 'Night already resolved' : 'Night resolution already in progress' }, { status: 409 });
    claimedGameId = gameId; claimedRound = roundNumber; claimedLeaseId = lock.leaseId;
    const renew = async () => { if (!claimedGameId || claimedRound === null || !claimedLeaseId) return; if (!await renewNightResolution(db, claimedGameId, claimedRound, claimedLeaseId)) console.error('[resolve-night] lease fencing detected'); };
    heartbeat = setInterval(() => { void renew().catch((error) => console.error('[resolve-night] lease renewal failed', error)); }, HEARTBEAT_MS);

    // AI is generated here, on the trusted server, immediately before reading submissions.
    await ensureServerAINightSubmissions(db, gameId, game, players as Array<Record<string, unknown>>, roundNumber);

    const submissions = await readNightSubmissions(gameId, roundNumber);
    const validation = validatePersistedNightSubmissions(players as Array<Record<string, unknown>>, submissions, roundNumber);
    const groupedSubmissions = validation.valid.map((s) => ({ actorUid: s.actorUid, role: s.role, actions: s.actions, roundNumber: s.roundNumber, submittedAt: s.submittedAt, syncedAt: s.syncedAt }));
    const input = createNightResolutionInput(gameId, roundNumber, players as Array<Record<string, unknown>>, groupedSubmissions, game);
    const roleSnapshot = await readNightRoleSnapshot(gameId, input.players.map((player) => player.uid));

    // Persisted roles are an untrusted boundary. The private server snapshot is the
    // only canonical role authority allowed to influence the night engine.
    const roleTampering = groupedSubmissions.find((submission) => roleSnapshot.rolesByUid[submission.actorUid] !== submission.role);
    if (roleTampering) throw new Error(`night_submission_role_mismatch:${roleTampering.actorUid}`);

    const result = resolveNightActions(input, roleSnapshot);
    const acceptedAction = (action: string) => result.acceptedActions.find((item) => item.action === action) ?? null;
    const ancianaTarget = acceptedAction('ancianaTarget')?.targetUid ?? null;
    const actorTarget = (action: string): string | null => { const item = acceptedAction(action); return item?.targetUid && item.actorUid !== ancianaTarget ? item.targetUid : null; };
    const guardianLastTarget = actorTarget('guardianTarget'); const doctorLastTarget = actorTarget('doctorTarget'); const doctorAction = acceptedAction('doctorTarget');
    const doctorSelfUsed = Boolean(doctorAction?.targetUid && doctorAction.targetUid === doctorAction.actorUid);
    const primaryWolfTarget = result.wolfResolution.targetUid; const primaryWolfVictim = primaryWolfTarget ? result.statePatch.players.find((p) => p.uid === primaryWolfTarget) : null;
    const dayEliminatedUid = primaryWolfVictim && !primaryWolfVictim.isAlive ? primaryWolfTarget : null;
    const canonicalWolfTeam = canonicalizeWolfTeam(result.statePatch.roles, result.statePatch.wolfTeam);
    const committed = await db.runTransaction(async (tx) => {
      const [currentGameSnap, lockSnap] = await Promise.all([tx.get(gameRef), tx.get(db.collection('games').doc(gameId).collection('nightResolutions').doc(String(roundNumber)))]);
      if (!currentGameSnap.exists) throw new Error('night_state_changed_before_commit'); const currentGame = currentGameSnap.data() as Record<string, unknown>; const lockData = lockSnap.exists ? lockSnap.data() as Record<string, unknown> : null;
      if (!lockData) throw new Error('night_resolution_lock_missing');
      if (currentGame.phase !== 'night' || currentGame.roundNumber !== roundNumber) throw new Error('night_state_changed_before_commit');
      if (lockData.status !== 'resolving' || lockData.leaseId !== claimedLeaseId) throw new Error('night_resolution_lease_lost');
      if (leaseExpiresMillis(lockData.expiresAt) <= Date.now()) throw new Error('night_resolution_lease_expired');
      const patch = result.statePatch; const now = Date.now(); const finalWinner = result.winner; const nextPhase = finalWinner ? 'ended' : 'day'; const aliveCount = patch.players.filter((p) => p.isAlive).length;
      const previousForenseResults = currentGame.forenseResults && typeof currentGame.forenseResults === 'object' ? currentGame.forenseResults as Record<string, string> : {};
      tx.update(gameRef, { players: patch.players, roles: patch.roles, eliminatedHistory: patch.eliminatedHistory, wolfTeam: canonicalWolfTeam, antigoHit: patch.antigoHit, cambiaformasTargets: patch.cambiaformasTargets, salvajeMentors: patch.salvajeMentors, virginiawoolFate: patch.virginiawoolFate, perroLoboChoices: patch.perroLoboChoices, cultMembers: patch.cultMembers, vampiroBites: patch.vampiroBites, vampiroKills: patch.vampiroKills, pescadorBoat: patch.pescadorBoat, enchanted: patch.enchanted, hadaLinked: patch.hadaLinked, bansheePoints: patch.bansheePoints, vigiaUsed: patch.vigiaUsed, vigiaKnowsWolves: patch.vigiaKnowsWolves, angelResucitadorUsed: patch.angelResucitadorUsed, espiaUsed: patch.espiaUsed, sirenaUid: patch.sirenaUid, sirenaLinked: patch.sirenaLinked, lobosBlocked: result.deathEffects.nextNightWolfBlock, criaLoboRage: patch.criaLoboRage, hechiceraLifeUsed: patch.hechiceraLifeUsed, hechiceraPoisonUsed: patch.hechiceraPoisonUsed, brujaFoundVidente: patch.brujaFoundVidente, brujaProtectedUid: patch.brujaProtectedUid, guardianLastTarget, doctorLastTarget, doctorSelfUsed, dayEliminatedUid, cazadorPendingShot: patch.cazadorPendingShot, seerReveal: patch.seerReveal, seerReveal2: patch.seerReveal2, profetaReveal: patch.profetaReveal, silencedPlayers: patch.silencedPlayers, forenseResults: { ...previousForenseResults, ...patch.forenseResults }, saboteadorBan: patch.saboteadorBan, phase: nextPhase, winners: finalWinner, winMessage: result.winMessage, nightActions: {}, nightSubmissions: {}, dayVotes: {}, dayStartedAt: finalWinner ? null : now, phaseEndsAt: finalWinner ? null : nextDayEnd(now, aliveCount), bansheePredictionUid: null });
      for (const [uid, role] of Object.entries(patch.roles)) tx.set(gameRef.collection('playerRoles').doc(uid), { role, updatedAt: now }, { merge: true });
      tx.update(lockSnap.ref, { status: 'resolved', resolvedAt: new Date(now), expiresAt: null }); return true;
    });
    if (!committed) throw new Error('night_resolution_not_committed'); claimedGameId = null; claimedRound = null; claimedLeaseId = null;
    return NextResponse.json({ ok: true, gameId, result, rejected: validation.rejected });
  } catch (error) {
    if (claimedGameId && claimedRound !== null && claimedLeaseId) { try { const { db } = getSdks(); await releaseNightResolution(db, claimedGameId, claimedRound, claimedLeaseId); } catch (releaseError) { console.error('[resolve-night] failed to release resolution lease', releaseError); } }
    console.error('[resolve-night] request failed', error); const message = error instanceof Error ? error.message : 'unknown_error'; const status = message.startsWith('night_') ? 409 : 401; return NextResponse.json({ error: status === 409 ? message : 'Unauthorized or invalid request' }, { status });
  } finally { if (heartbeat) clearInterval(heartbeat); }
}
