/**
 * POST /api/sync-night-action
 * Authoritative server boundary for night actions.
 *
 * Canonical persistence: games/{gameId}/nightSubmissions/{uid}.
 * The night resolver consumes this exact collection, so the write path and
 * resolution path cannot silently diverge.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { createNightActionSubmissions, validateNightActionSubmissions } from '@/lib/game/nightResolution';
import { resolveAuthoritativeRole, validateNightActionPayload } from '@/lib/game/nightActionSecurity';
import { canUseRoleAtRound, getRoleAuthorityRule } from '@/lib/game/roleAuthority';
import { validateNightAction } from '@/lib/game/nightActionValidation';

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { gameId, uid, role: requestedRole, payload, requestId } = body as {
      gameId?: string;
      uid?: string;
      role?: string;
      payload?: Record<string, unknown>;
      requestId?: string;
    };

    if (!gameId || !uid || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }
    if (tokenUid !== uid) return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    if (gameId.length > 128 || uid.length > 128) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
    }
    if (requestedRole !== undefined && (typeof requestedRole !== 'string' || requestedRole.length > 128)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }
    if (requestId !== undefined && (typeof requestId !== 'string' || requestId.length > 128)) {
      return NextResponse.json({ error: 'requestId inválido' }, { status: 400 });
    }
    if (!validateNightActionPayload(payload)) {
      return NextResponse.json({ error: 'Payload no permitido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const submissionRef = gameRef.collection('nightSubmissions').doc(uid);

    const result = await db.runTransaction(async transaction => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const gameData = gameSnap.data()!;
      if (gameData.phase !== 'night') throw new Error('WRONG_PHASE');

      const round = Number(gameData.roundNumber ?? 1);
      if (!Number.isInteger(round) || round < 1) throw new Error('INVALID_ROUND');

      const players: { uid: string; isAlive: boolean }[] = Array.isArray(gameData.players)
        ? gameData.players
        : [];
      const actor = players.find(player => player.uid === uid);
      if (!actor || !actor.isAlive) throw new Error('INVALID_PLAYER');

      const privateRoleSnap = await transaction.get(gameRef.collection('playerRoles').doc(uid));
      const authoritativeRole = resolveAuthoritativeRole(
        privateRoleSnap.exists ? privateRoleSnap.data() : null,
        gameData.roles,
        uid,
      );
      if (!authoritativeRole) throw new Error('ROLE_MISMATCH');
      if (requestedRole !== undefined && authoritativeRole !== requestedRole) throw new Error('ROLE_MISMATCH');

      const submissions = createNightActionSubmissions(uid, payload);
      if (submissions.length === 0) throw new Error('ACTION_NOT_RECOGNIZED');

      // A skip is a legitimate no-action submission for passive roles and for
      // active roles whose player elects to pass. It does not require a role
      // authority rule because no privileged action is being requested.
      const isSkipOnly = submissions.every(submission => submission.action === '_skip');
      const rule = getRoleAuthorityRule(authoritativeRole);
      if (!isSkipOnly && (!rule || !canUseRoleAtRound(authoritativeRole, round))) {
        throw new Error('ROLE_NOT_AVAILABLE');
      }

      // Canonical role/action validation. This uses the private server role,
      // never a client-provided role as authority.
      const submissionValidation = validateNightActionSubmissions(
        players,
        uid,
        authoritativeRole,
        submissions,
      );
      if (!submissionValidation.valid) {
        throw new Error('ACTION_NOT_ALLOWED');
      }

      if (!isSkipOnly) {
        const targets: string[] = [];
        for (const submission of submissions) {
          if (submission.targetUid) targets.push(submission.targetUid);
          if (submission.targetUids) targets.push(...submission.targetUids);
        }
        const targetValidation = validateNightAction({
          phase: gameData.phase,
          round,
          actor,
          targetIds: targets,
          players,
          allowSelfTarget: rule!.allowSelfTarget,
          maxTargets: rule!.maxTargets,
        });
        if (!targetValidation.ok) throw new Error(targetValidation.code);
      }

      const existingSnap = await transaction.get(submissionRef);
      if (existingSnap.exists) {
        const existing = existingSnap.data() ?? {};
        if (Number(existing.roundNumber ?? 0) === round) return { duplicate: true, round, role: authoritativeRole };
      }

      const now = Date.now();
      transaction.set(submissionRef, {
        actorUid: uid,
        role: authoritativeRole,
        roundNumber: round,
        actions: submissions,
        submittedAt: now,
        syncedAt: now,
        ...(requestId ? { requestId } : {}),
      });

      return { duplicate: false, round, role: authoritativeRole };
    });

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      actorUid: uid,
      roundNumber: result.round,
      role: result.role,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    const statuses: Record<string, number> = {
      GAME_NOT_FOUND: 404,
      WRONG_PHASE: 409,
      INVALID_ROUND: 409,
      INVALID_PLAYER: 403,
      ROLE_MISMATCH: 403,
      ROLE_NOT_AVAILABLE: 409,
      ACTION_NOT_RECOGNIZED: 400,
      ACTION_NOT_ALLOWED: 403,
      INVALID_PHASE: 409,
      ACTOR_DEAD: 403,
      TARGET_NOT_FOUND: 400,
      TARGET_DEAD: 400,
      SELF_TARGET: 400,
      TOO_MANY_TARGETS: 400,
      DUPLICATE_TARGET: 400,
    };
    const status = statuses[code];
    if (status) return NextResponse.json({ error: code }, { status });
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
