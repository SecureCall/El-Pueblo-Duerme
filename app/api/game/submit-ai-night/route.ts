import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { generateAiNightActions } from '@/lib/server/aiNightActions';
import { createNightActionSubmissions, validateNightActionSubmissions } from '@/lib/game/nightResolution';
import { canUseRoleAtRound, getRoleAuthorityRule } from '@/lib/game/roleAuthority';
import { validateNightAction } from '@/lib/game/nightActionValidation';

export async function POST(req: NextRequest) {
  const requesterUid = await verifyAuthToken(req);
  if (!requesterUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId || gameId.length > 128) {
      return NextResponse.json({ error: 'gameId inválido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'GAME_NOT_FOUND' }, { status: 404 });

    const game = gameSnap.data() ?? {};
    const players = Array.isArray(game.players)
      ? game.players.filter((player): player is { uid: string; isAlive: boolean; isAI?: boolean } =>
          !!player && typeof player === 'object' && typeof player.uid === 'string' && typeof player.isAlive === 'boolean')
      : [];
    const requester = players.find((player) => player.uid === requesterUid);
    if (!requester) return NextResponse.json({ error: 'NO_PLAYER' }, { status: 403 });
    if (game.phase !== 'night') return NextResponse.json({ error: 'WRONG_PHASE' }, { status: 409 });

    const roundNumber = Number(game.roundNumber ?? 1);
    if (!Number.isInteger(roundNumber) || roundNumber < 1) {
      return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 409 });
    }

    const roleRefs = players.map((player) => gameRef.collection('playerRoles').doc(player.uid));
    const submissionRefs = players.map((player) => gameRef.collection('nightSubmissions').doc(player.uid));
    const snapshots = await db.getAll(...roleRefs, ...submissionRefs);
    const roleSnaps = snapshots.slice(0, roleRefs.length);
    const submissionSnaps = snapshots.slice(roleRefs.length);

    const roles: Record<string, string> = {};
    for (let i = 0; i < players.length; i += 1) {
      const privateRole = roleSnaps[i].exists ? roleSnaps[i].data()?.role : undefined;
      const fallbackRole = game.roles && typeof game.roles === 'object'
        ? (game.roles as Record<string, unknown>)[players[i].uid]
        : undefined;
      if (typeof privateRole === 'string') roles[players[i].uid] = privateRole;
      else if (typeof fallbackRole === 'string') roles[players[i].uid] = fallbackRole;
    }

    const generated = generateAiNightActions({
      gameId,
      roundNumber,
      players,
      roles,
      criaLoboRage: game.criaLoboRage === true,
    });

    const aiPlayers = players.filter((player) => player.isAI && player.isAlive);
    let written = 0;
    let duplicates = 0;

    await db.runTransaction(async (tx) => {
      const currentGameSnap = await tx.get(gameRef);
      if (!currentGameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const currentGame = currentGameSnap.data() ?? {};
      if (currentGame.phase !== 'night' || Number(currentGame.roundNumber ?? 1) !== roundNumber) {
        throw new Error('NIGHT_CHANGED');
      }

      const currentRefs = aiPlayers.map((player) => gameRef.collection('nightSubmissions').doc(player.uid));
      const currentRoleRefs = aiPlayers.map((player) => gameRef.collection('playerRoles').doc(player.uid));
      const [currentSubmissions, currentRoles] = await Promise.all([
        tx.getAll(...currentRefs),
        tx.getAll(...currentRoleRefs),
      ]);

      for (let i = 0; i < aiPlayers.length; i += 1) {
        const actor = aiPlayers[i];
        const submissionRef = currentRefs[i];
        const existing = currentSubmissions[i];
        if (existing.exists && Number(existing.data()?.roundNumber ?? 0) === roundNumber) {
          duplicates += 1;
          continue;
        }

        const role = currentRoles[i].exists ? currentRoles[i].data()?.role : roles[actor.uid];
        if (typeof role !== 'string' || !role) {
          tx.set(submissionRef, {
            actorUid: actor.uid,
            role: 'Aldeano',
            roundNumber,
            actions: [{ actorUid: actor.uid, action: '_skip' }],
            submittedAt: Date.now(),
            syncedAt: Date.now(),
          });
          written += 1;
          continue;
        }

        const payload = Object.fromEntries(
          (generated[actor.uid] ?? [{ action: '_skip' }]).map((action) => {
            if (action.targetUid !== undefined) return [action.action, action.targetUid];
            if (action.targetUids !== undefined) return [action.action, action.targetUids];
            return [action.action, action.value ?? true];
          }),
        );
        const submissions = createNightActionSubmissions(actor.uid, payload);
        const isSkipOnly = submissions.every((submission) => submission.action === '_skip');
        const rule = getRoleAuthorityRule(role);

        if (!isSkipOnly && (!rule || !canUseRoleAtRound(role, roundNumber))) {
          continue;
        }

        const submissionValidation = validateNightActionSubmissions(players, actor.uid, role, submissions);
        if (!submissionValidation.valid) continue;

        if (!isSkipOnly) {
          const targetIds = submissions.flatMap((submission) => [
            ...(submission.targetUid ? [submission.targetUid] : []),
            ...(submission.targetUids ?? []),
          ]);
          const targetValidation = validateNightAction({
            phase: 'night',
            round: roundNumber,
            actor,
            targetIds,
            players,
            allowSelfTarget: rule!.allowSelfTarget,
            maxTargets: rule!.maxTargets,
          });
          if (!targetValidation.ok) continue;
        }

        const now = Date.now();
        tx.set(submissionRef, {
          actorUid: actor.uid,
          role,
          roundNumber,
          actions: submissions,
          submittedAt: now,
          syncedAt: now,
          serverGenerated: true,
        });
        written += 1;
      }
    });

    return NextResponse.json({ ok: true, roundNumber, written, duplicates });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status: Record<string, number> = {
      GAME_NOT_FOUND: 404,
      NO_PLAYER: 403,
      WRONG_PHASE: 409,
      INVALID_ROUND: 409,
      NIGHT_CHANGED: 409,
    };
    if (status[code]) return NextResponse.json({ error: code }, { status: status[code] });
    console.error('[submit-ai-night]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
