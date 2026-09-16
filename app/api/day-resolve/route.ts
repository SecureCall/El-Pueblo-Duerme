import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { isAuthorizedServerRequest } from '@/lib/server/auth';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { readNightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';
import { createDayResolutionInput } from '@/lib/server/dayResolutionInput';
import { resolveDay } from '@/lib/server/dayResolutionEngine';
import { ensureServerAiDayVotes } from '@/lib/server/dayAi';
import { applyChaosRevive } from '@/lib/server/chaosReviveApply';
import { checkWinCondition } from '@/lib/server/gameRules';
import { chaosEventAppliesToPhase, type ChaosEvent } from '@/lib/server/chaosEvents';

const LEASE_MS = 30_000;
const SCHEDULER_OWNER = '__scheduler__';
type Lock = { ownerUid: string; leaseId: string; round: number; expiresAt: number };
const E: Record<string, [string, number]> = {
  GAME_NOT_FOUND: ['Partida no encontrada', 404], NOT_HOST: ['Solo un jugador vivo puede resolver el día', 403],
  NOT_DAY: ['No es fase de día', 409], INCOMPLETE_DAY: ['La votación del día todavía no está completa', 409], LOCKED: ['La resolución del día ya está en curso', 409],
  LEASE_LOST: ['La resolución perdió su lease', 409], LEASE_EXPIRED: ['El lease expiró', 409],
  ROUND_CHANGED: ['La ronda cambió durante la resolución', 409], PHASE_CHANGED: ['La fase cambió durante la resolución', 409],
  PLAYER_SET_CHANGED: ['La lista de jugadores cambió', 409], INVALID_ROUND: ['Ronda inválida', 400],
};
const lease = (uid: string) => `${uid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

async function votes(ref: DocumentReference, round: number, ps: Array<Record<string, unknown>>) {
  const alive = new Set(ps.filter(p => p.isAlive === true && typeof p.uid === 'string').map(p => p.uid as string));
  const s = await ref.collection('votes').get();
  const out: Record<string, string> = {};
  s.forEach(d => {
    const x = d.data();
    if (Number(x.round) === round && alive.has(d.id) && typeof x.target === 'string' && alive.has(x.target)) out[d.id] = x.target;
  });
  return out;
}

function isVoteBanned(game: Record<string, unknown>, uid: string): boolean {
  if (Array.isArray(game.voteBanned) && game.voteBanned.includes(uid)) return true;
  return typeof game.saboteadorBan === 'string' && game.saboteadorBan === uid;
}

function buildAuthoritativeAiPlayers(ps: Array<Record<string, unknown>>) {
  return ps.filter(p => p.isAlive === true).map(p => ({
    uid: String(p.uid ?? ''),
    botType: typeof p.botType === 'string' ? p.botType : null,
    isAI: p.isAI === true,
    isAlive: p.isAlive === true,
    voteBanned: isVoteBanned({ voteBanned: p.voteBanned === true ? [String(p.uid ?? '')] : [] }, String(p.uid ?? '')),
    saboteadorBan: false,
  }));
}

export async function POST(req: NextRequest) {
  const trustedServer = isAuthorizedServerRequest(req);
  let actorUid = '';
  if (trustedServer) {
    actorUid = SCHEDULER_OWNER;
  } else {
    const tokenUid = await verifyAuthToken(req);
    if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    actorUid = tokenUid;
  }

  try {
    const b = await req.json().catch(() => ({}));
    const gameId = typeof b.gameId === 'string' ? b.gameId : '';
    const action = b.action === 'release' || b.action === 'commit' ? b.action : 'claim';
    const leaseId = typeof b.leaseId === 'string' ? b.leaseId : '';
    const submitted = Number(b.round);
    if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 });
    initAdminApp();
    const db = getFirestore(), gr = db.collection('games').doc(gameId), lr = gr.collection('locks').doc('dayResolution');

    if (action === 'release') {
      if (!leaseId) return NextResponse.json({ error: 'leaseId required' }, { status: 400 });
      const released = await db.runTransaction(async tx => {
        const s = await tx.get(lr);
        if (!s.exists) return false;
        const l = s.data() as Lock;
        if (l.ownerUid !== actorUid || l.leaseId !== leaseId) return false;
        tx.delete(lr);
        return true;
      });
      return NextResponse.json({ ok: true, released });
    }

    if (action === 'claim') {
      const gameSnap = await gr.get();
      if (!gameSnap.exists) throw Error('GAME_NOT_FOUND');
      const x = gameSnap.data()!, ps = Array.isArray(x.players) ? x.players as Array<Record<string, unknown>> : [];
      const actor = ps.find(p => p.uid === actorUid);
      if (!trustedServer && actor?.isAlive !== true) throw Error('NOT_HOST');

      if (!trustedServer && x.hostUid !== actorUid) {
        const round = Number(x.roundNumber ?? 1);
        if (!Number.isInteger(round)) throw Error('INVALID_ROUND');
        const now = Date.now();
        const phaseEndsAt = typeof x.phaseEndsAt === 'number' ? x.phaseEndsAt : null;
        const deadlineReached = phaseEndsAt !== null && now >= phaseEndsAt;
        const currentVotes = await votes(gr, round, ps);
        const alivePlayers = buildAuthoritativeAiPlayers(ps);
        const authoritativeVotes = ensureServerAiDayVotes({
          gameId,
          round,
          bots: alivePlayers.filter(p => p.isAI),
          alivePlayers,
          currentVotes,
          dayStartedAt: typeof x.dayStartedAt === 'number' ? x.dayStartedAt : null,
          now,
        });
        const eligible = ps.filter(p => p.isAlive === true && typeof p.uid === 'string' && !isVoteBanned(x, p.uid as string));
        const complete = eligible.length > 0 && eligible.every(p => typeof p.uid === 'string' && !!authoritativeVotes[p.uid as string]);
        if (!complete && !deadlineReached) throw Error('INCOMPLETE_DAY');
      }

      const id = lease(actorUid);
      const r = await db.runTransaction(async tx => {
        const [g, l] = await Promise.all([tx.get(gr), tx.get(lr)]);
        if (!g.exists) throw Error('GAME_NOT_FOUND');
        const current = g.data()!;
        const players = Array.isArray(current.players) ? current.players as Array<Record<string, unknown>> : [];
        if (!trustedServer && !players.some(p => p.uid === actorUid && p.isAlive === true)) throw Error('NOT_HOST');
        if (current.phase !== 'day' && current.phase !== 'voting') throw Error('NOT_DAY');
        const round = Number(current.roundNumber ?? 1);
        if (!Number.isInteger(round)) throw Error('INVALID_ROUND');
        const now = Date.now();
        if (l.exists && (l.data() as Lock).expiresAt > now) throw Error('LOCKED');
        tx.set(lr, { ownerUid: actorUid, leaseId: id, round, expiresAt: now + LEASE_MS });
        return { round, leaseId: id };
      });
      return NextResponse.json({ ok: true, leaseId: r.leaseId, round: r.round });
    }

    if (!leaseId || !Number.isInteger(submitted)) return NextResponse.json({ error: 'leaseId and round required' }, { status: 400 });
    const gs = await gr.get();
    if (!gs.exists) throw Error('GAME_NOT_FOUND');
    const g = gs.data()!, ps = Array.isArray(g.players) ? g.players as Array<Record<string, unknown>> : [];
    const round = Number(g.roundNumber ?? 1);
    if (round !== submitted) throw Error('ROUND_CHANGED');
    if (!trustedServer && !ps.some(p => p.uid === actorUid && p.isAlive === true)) throw Error('NOT_HOST');
    if (g.phase !== 'day' && g.phase !== 'voting') throw Error('PHASE_CHANGED');

    const uids = ps.flatMap(p => typeof p.uid === 'string' ? [p.uid] : []);
    const snapshot = await readNightRoleSnapshot(gameId, uids);
    const currentVotes = await votes(gr, round, ps);
    const alivePlayers = buildAuthoritativeAiPlayers(ps);
    const authoritativeVotes = ensureServerAiDayVotes({
      gameId,
      round,
      bots: alivePlayers.filter(p => p.isAI),
      alivePlayers,
      currentVotes,
      dayStartedAt: typeof g.dayStartedAt === 'number' ? g.dayStartedAt : null,
      now: Date.now(),
    });
    let result = resolveDay(createDayResolutionInput(gameId, g, snapshot.rolesByUid, authoritativeVotes, Date.now()));

    await db.runTransaction(async tx => {
      const [cg, ls] = await Promise.all([tx.get(gr), tx.get(lr)]);
      if (!cg.exists) throw Error('GAME_NOT_FOUND');
      if (!ls.exists) throw Error('LEASE_LOST');
      const current = cg.data()!, l = ls.data() as Lock, now = Date.now();
      if (l.ownerUid !== actorUid || l.leaseId !== leaseId) throw Error('LEASE_LOST');
      if (l.round !== submitted || Number(current.roundNumber ?? 1) !== submitted) throw Error('ROUND_CHANGED');
      if (l.expiresAt <= now) throw Error('LEASE_EXPIRED');
      if (!trustedServer && !Array.isArray(current.players) || (!trustedServer && !(current.players as Array<Record<string, unknown>>).some(p => p.uid === actorUid && p.isAlive === true))) throw Error('PHASE_CHANGED');
      if (current.phase !== 'day' && current.phase !== 'voting') throw Error('PHASE_CHANGED');
      const cp = Array.isArray(current.players) ? current.players as Array<Record<string, unknown>> : [];
      const cu = cp.flatMap(p => typeof p.uid === 'string' ? [p.uid] : []);
      if (cu.length !== uids.length || cu.some(uid => !uids.includes(uid))) throw Error('PLAYER_SET_CHANGED');

      let princeUsed = current.principeUsed === true;
      const prince = uids.find(uid => snapshot.rolesByUid[uid] === 'Príncipe' && ps.some(p => p.uid === uid && p.isAlive === true));
      const max = Math.max(0, ...Object.values(result.tally));
      if (!princeUsed && prince) {
        if (Array.isArray(g.alborotadoraFight) && g.alborotadoraFight.includes(prince)) princeUsed = true;
        else if (!g.noExileActive && result.eliminated === null && max > 0 && result.tally[prince] === max) princeUsed = true;
      }

      const {
        roles: _privateRoles,
        wolfTeam: _privateWolfTeam,
        players: resolvedPlayers,
        nightActions: _legacyNightActions,
        nightSubmissions: _legacyNightSubmissions,
        ...publicPatch
      } = result.statePatch;
      let sanitizedPlayers = resolvedPlayers.map(({ role: _privateRole, ...player }) => player);
      let resolvedHistory = result.statePatch.eliminatedHistory;
      let resolvedWolfTeam = result.statePatch.wolfTeam;
      let cazadorPendingShot = result.statePatch.cazadorPendingShot;
      let chivoPendingChoice = result.statePatch.chivoPendingChoice;
      let finalWinner = result.winner;
      let finalMsg = result.winMessage;

      const currentEvent = current.currentEvent && typeof current.currentEvent === 'object' ? current.currentEvent as ChaosEvent : null;
      if (currentEvent?.mechanical === 'revive') {
        const revived = applyChaosRevive(gameId, round, resolvedPlayers, resolvedHistory, result.statePatch.roles, resolvedWolfTeam);
        if (revived.targetUid) {
          sanitizedPlayers = revived.players.map(({ role: _privateRole, ...player }) => player);
          resolvedHistory = revived.eliminatedHistory;
          resolvedWolfTeam = revived.wolfTeam;
          const revivedTarget = revived.targetUid;
          cazadorPendingShot = cazadorPendingShot === revivedTarget ? null : cazadorPendingShot;
          chivoPendingChoice = chivoPendingChoice === revivedTarget ? null : chivoPendingChoice;
          const revivedElimination = result.eliminated === revivedTarget ? null : result.eliminated;
          const revivedSecondElimination = result.secondEliminated === revivedTarget ? null : result.secondEliminated;
          const winResult = checkWinCondition(revived.players, result.statePatch.roles, {
            enchanted: result.statePatch.enchanted,
            round,
            dayEliminatedUid: revivedElimination,
            secondEliminatedUid: revivedSecondElimination,
            eliminatedByVote: true,
            perroLoboChoices: createDayResolutionInput(gameId, current, snapshot.rolesByUid, {}, now).perroLoboChoices,
            cultMembers: createDayResolutionInput(gameId, current, snapshot.rolesByUid, {}, now).cultMembers,
            vampiroKills: createDayResolutionInput(gameId, current, snapshot.rolesByUid, {}, now).vampiroKills,
            pescadorBoat: createDayResolutionInput(gameId, current, snapshot.rolesByUid, {}, now).pescadorBoat,
            hadaLinked: createDayResolutionInput(gameId, current, snapshot.rolesByUid, {}, now).hadaLinked,
            lovers: createDayResolutionInput(gameId, current, snapshot.rolesByUid, {}, now).lovers ?? [],
          });
          finalWinner = winResult.winner;
          finalMsg = winResult.message;
          result = { ...result, winner: finalWinner, winMessage: finalMsg };
        }
      }

      const nextNightEvent = chaosEventAppliesToPhase(currentEvent, 'night') ? currentEvent : null;
      const patch = {
        ...publicPatch,
        principeUsed,
        players: sanitizedPlayers,
        eliminatedHistory: resolvedHistory,
        wolfTeam: resolvedWolfTeam,
        cazadorPendingShot: cazadorPendingShot && !finalWinner ? cazadorPendingShot : null,
        chivoPendingChoice: chivoPendingChoice && !finalWinner ? chivoPendingChoice : null,
        winners: finalWinner,
        winMessage: finalMsg,
        phase: finalWinner ? 'ended' : 'night',
        nightStartedAt: finalWinner ? null : now,
        phaseEndsAt: finalWinner ? null : now + 60_000,
        currentEvent: nextNightEvent,
        eventRound: nextNightEvent ? Number(result.roundNumber) + 1 : null,
        confessionUid: null,
        confessionEndsAt: null,
      } as Record<string, unknown>;

      tx.update(gr, patch);
      for (const [uid, role] of Object.entries(result.statePatch.roles)) {
        tx.set(gr.collection('playerRoles').doc(uid), { role, updatedAt: now }, { merge: true });
      }
      tx.delete(lr);
    });
    return NextResponse.json({ ok: true, committed: true, result: { ...result, statePatch: undefined } });
  } catch (err) {
    const m = err instanceof Error ? err.message : 'INTERNAL';
    const [e, s] = E[m] ?? ['Error interno', 500];
    console.error('[day-resolve]', m);
    return NextResponse.json({ error: e }, { status: s });
  }
}
