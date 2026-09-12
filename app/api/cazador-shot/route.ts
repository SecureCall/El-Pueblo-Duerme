import { NextResponse } from 'next/server';
import { isAuthorizedServerRequest, verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';
import { checkWinCondition } from '@/lib/server/gameRules';

type Player = { uid: string; name?: string; isAlive: boolean; [key: string]: unknown };

export async function POST(request: Request) {
  try {
    const serverAuthorized = isAuthorizedServerRequest(request);
    const user = serverAuthorized ? null : await verifyAuthToken(request);
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    if (!gameId || !targetUid) return NextResponse.json({ error: 'gameId and targetUid are required' }, { status: 400 });

    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    let response: Record<string, unknown> = { ok: true, gameId, targetUid };

    await db.runTransaction(async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const game = gameSnap.data() as Record<string, unknown>;
      const players = Array.isArray(game.players) ? game.players as Player[] : [];
      const round = Number(game.roundNumber ?? 1);
      const pendingUid = typeof game.cazadorPendingShot === 'string' ? game.cazadorPendingShot : null;
      if (!pendingUid) throw new Error('NO_PENDING_SHOT');
      if (!Number.isInteger(round)) throw new Error('INVALID_ROUND');

      const hunter = players.find(p => p.uid === pendingUid);
      const target = players.find(p => p.uid === targetUid);
      if (!hunter || hunter.isAlive) throw new Error('HUNTER_INVALID');
      if (!target || !target.isAlive || target.uid === pendingUid) throw new Error('TARGET_INVALID');

      const hunterRoleSnap = await tx.get(gameRef.collection('playerRoles').doc(pendingUid));
      const hunterRole = hunterRoleSnap.exists ? hunterRoleSnap.data()?.role : null;
      if (hunterRole !== 'Cazador') throw new Error('ROLE_INVALID');

      const authorizedPlayer = user?.uid === pendingUid;
      const authorizedAI = hunter.isAI === true && user?.uid === game.hostUid;
      if (!serverAuthorized && !authorizedPlayer && !authorizedAI) throw new Error('FORBIDDEN');

      const roleEntries = await Promise.all(players.map(async (p) => {
        const roleSnap = await tx.get(gameRef.collection('playerRoles').doc(p.uid));
        return [p.uid, roleSnap.exists && typeof roleSnap.data()?.role === 'string' ? roleSnap.data()!.role : 'Aldeano'] as const;
      }));
      const roles = Object.fromEntries(roleEntries) as Record<string, string>;
      const nextPlayers = players.map(p => ({ ...p }));
      const nextTarget = nextPlayers.find(p => p.uid === targetUid)!;
      nextTarget.isAlive = false;

      const history = Array.isArray(game.eliminatedHistory) ? [...game.eliminatedHistory as Array<Record<string, unknown>>] : [];
      if (!history.some(h => h.uid === targetUid && h.round === round)) {
        history.push({ uid: targetUid, name: nextTarget.name ?? targetUid, role: roles[targetUid] ?? 'Aldeano', round });
      }

      const lovers = Array.isArray(game.lovers) && game.lovers.length === 2 ? game.lovers as [string, string] : null;
      const virginiaFate = game.virginiawoolFate && typeof game.virginiawoolFate === 'object' ? game.virginiawoolFate as Record<string, string> : {};
      const cascade = new Set<string>();
      if (lovers) {
        const partner = targetUid === lovers[0] ? lovers[1] : targetUid === lovers[1] ? lovers[0] : null;
        if (partner) cascade.add(partner);
      }
      const twins = nextPlayers.filter(p => roles[p.uid] === 'Gemela' || roles[p.uid] === 'Gemelas');
      if (twins.length === 2 && (targetUid === twins[0].uid || targetUid === twins[1].uid)) cascade.add(targetUid === twins[0].uid ? twins[1].uid : twins[0].uid);
      if (virginiaFate[targetUid]) cascade.add(virginiaFate[targetUid]);
      for (const uid of cascade) {
        const p = nextPlayers.find(x => x.uid === uid);
        if (!p || !p.isAlive) continue;
        p.isAlive = false;
        if (!history.some(h => h.uid === uid && h.round === round)) history.push({ uid, name: p.name ?? uid, role: roles[uid] ?? 'Aldeano', round });
      }

      const enchanted = Array.isArray(game.enchanted) ? game.enchanted as string[] : [];
      const winResult = checkWinCondition(nextPlayers, roles, {
        enchanted,
        round,
        dayEliminatedUid: targetUid,
        eliminatedByVote: false,
        perroLoboChoices: (game.perroLoboChoices ?? {}) as Record<string, 'wolves' | 'village'>,
        cultMembers: Array.isArray(game.cultMembers) ? game.cultMembers as string[] : [],
        vampiroKills: Number(game.vampiroKills ?? 0),
        pescadorBoat: Array.isArray(game.pescadorBoat) ? game.pescadorBoat as string[] : [],
        hadaLinked: game.hadaLinked === true,
        lovers: lovers ?? [],
      });
      const winner = winResult.winner ?? null;
      const message = winResult.message ?? null;

      tx.update(gameRef, {
        players: nextPlayers,
        eliminatedHistory: history,
        cazadorPendingShot: null,
        winners: winner,
        winMessage: message,
        phase: winner ? 'ended' : game.phase,
      });
      response = { ok: true, gameId, hunterUid: pendingUid, targetUid, targetRole: roles[targetUid] ?? 'Aldeano', winner, winMessage: message };
    });

    return NextResponse.json(response);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const statuses: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Game not found'],
      NO_PENDING_SHOT: [409, 'No hunter shot is pending'],
      INVALID_ROUND: [409, 'Invalid game round'],
      HUNTER_INVALID: [409, 'Hunter state is invalid'],
      TARGET_INVALID: [403, 'Target is invalid or already dead'],
      ROLE_INVALID: [409, 'Hunter role could not be verified'],
      FORBIDDEN: [403, 'Not authorized to perform this hunter shot'],
    };
    const [status, message] = statuses[code] ?? [500, 'Internal error'];
    if (status >= 500) console.error('[cazador-shot]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
