/**
 * POST /api/sync-night-action
 * Authoritative server boundary for night actions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { resolveAuthoritativeRole, validateNightActionPayload } from '@/lib/game/nightActionSecurity';
import { canUseRoleAtRound, getRoleAuthorityRule } from '@/lib/game/roleAuthority';
import { validateNightAction } from '@/lib/game/nightActionValidation';

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { gameId, uid, role: requestedRole, payload, requestId } = body as {
      gameId?: string; uid?: string; role?: string; payload?: Record<string, unknown>; requestId?: string;
    };
    if (!gameId || !uid || !requestedRole || !payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }
    if (tokenUid !== uid) return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    if (gameId.length > 128 || uid.length > 128 || requestedRole.length > 128) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
    }
    if (requestId !== undefined && (typeof requestId !== 'string' || requestId.length > 128)) {
      return NextResponse.json({ error: 'requestId inválido' }, { status: 400 });
    }
    if (!validateNightActionPayload(payload)) return NextResponse.json({ error: 'Payload no permitido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    const result = await db.runTransaction(async transaction => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');
      const gameData = gameSnap.data()!;
      if (gameData.phase !== 'night') throw new Error('WRONG_PHASE');

      const players: { uid: string; isAlive: boolean }[] = Array.isArray(gameData.players) ? gameData.players : [];
      const actor = players.find(player => player.uid === uid);
      if (!actor || !actor.isAlive) throw new Error('INVALID_PLAYER');

      const privateRoleSnap = await transaction.get(gameRef.collection('playerRoles').doc(uid));
      const authoritativeRole = resolveAuthoritativeRole(privateRoleSnap.exists ? privateRoleSnap.data() : null, gameData.roles, uid);
      if (!authoritativeRole || authoritativeRole !== requestedRole) throw new Error('ROLE_MISMATCH');

      const rule = getRoleAuthorityRule(authoritativeRole);
      if (!rule || !canUseRoleAtRound(authoritativeRole, Number(gameData.roundNumber ?? 1))) {
        throw new Error('ROLE_NOT_AVAILABLE');
      }

      const targets: string[] = [];
      for (const value of Object.values(payload)) {
        if (typeof value === 'string' && players.some(player => player.uid === value)) targets.push(value);
        if (Array.isArray(value)) targets.push(...value.filter((v): v is string => typeof v === 'string' && players.some(player => player.uid === v)));
      }
      const validation = validateNightAction({
        phase: gameData.phase,
        round: Number(gameData.roundNumber ?? 1),
        actor,
        targetIds: targets,
        players,
        allowSelfTarget: rule.allowSelfTarget,
        maxTargets: rule.maxTargets,
      });
      if (!validation.ok) throw new Error(validation.code);

      const round = Number(gameData.roundNumber ?? 1);
      const submissions = gameData.nightSubmissions && typeof gameData.nightSubmissions === 'object'
        ? gameData.nightSubmissions as Record<string, Record<string, unknown>>
        : {};
      const submissionKey = `${uid}:${round}`;
      const existing = submissions[submissionKey];
      if (existing && Number(existing.round ?? 0) === round) return { duplicate: true };

      transaction.set(gameRef, {
        nightSubmissions: {
          [submissionKey]: { ...payload, role: authoritativeRole, round, uid, syncedAt: FieldValue.serverTimestamp(), ...(requestId ? { requestId } : {}) },
        },
      }, { merge: true });
      return { duplicate: false };
    });

    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    const statuses: Record<string, number> = {
      GAME_NOT_FOUND: 404, WRONG_PHASE: 409, INVALID_PLAYER: 403, ROLE_MISMATCH: 403,
      ROLE_NOT_AVAILABLE: 409, INVALID_PHASE: 409, ACTOR_DEAD: 403, TARGET_NOT_FOUND: 400,
      TARGET_DEAD: 400, SELF_TARGET: 400, TOO_MANY_TARGETS: 400, DUPLICATE_TARGET: 400,
    };
    const status = statuses[code];
    if (status) return NextResponse.json({ error: code }, { status });
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}