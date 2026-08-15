/**
 * POST /api/sync-night-action
 * Background Sync endpoint for night actions.
 *
 * The browser is never trusted for identity or role selection: the role is
 * resolved from the authoritative game state (or private playerRoles doc).
 * Writes are transactional and a retry of the same role/round is idempotent.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const ALLOWED_PAYLOAD_KEYS = new Set([
  'wolfTarget', 'wolfTarget2', 'seerTarget', 'seerTarget2',
  'witchSave', 'witchPoison', 'cupidTargets', 'guardianTarget',
  'flautistaTargets', 'loboBlancoCide', 'perroLoboSide', 'salvajeMentor',
  'profetaTarget', 'sacerdoteTarget', 'ladronTarget', 'espiaActivate',
  'ancianaTarget', 'angelResucitarTarget', 'doctorTarget', 'silenciadoraTarget',
  'sirenaTarget', 'virginiawoolTarget', 'vigiaActivate', 'bansheePrediction',
  'cambiaformasTarget', 'liderCultoTarget', 'pescadorTarget', 'vampiroTarget',
  'hadaBuscadoraTarget', 'brujaTarget', 'forenseTarget', 'saboteadorTarget',
]);

function isSafeValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length <= 8 && value.every(item => typeof item === 'string' && item.length <= 128);
  }
  return false;
}

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { gameId, uid, role: requestedRole, payload, requestId } = body as {
      gameId?: string;
      uid?: string;
      role?: string;
      payload?: Record<string, unknown>;
      requestId?: string;
    };

    if (!gameId || !uid || !requestedRole || !payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'gameId, uid, role y payload son obligatorios' }, { status: 400 });
    }
    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    }
    if (gameId.length > 128 || uid.length > 128 || requestedRole.length > 128) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
    }
    if (requestId !== undefined && (typeof requestId !== 'string' || requestId.length > 128)) {
      return NextResponse.json({ error: 'requestId inválido' }, { status: 400 });
    }

    const invalidKeys = Object.keys(payload).filter(key => !ALLOWED_PAYLOAD_KEYS.has(key));
    if (invalidKeys.length > 0 || Object.values(payload).some(value => !isSafeValue(value))) {
      return NextResponse.json({ error: 'Payload de acción no permitido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    const result = await db.runTransaction(async transaction => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists) throw new Error('GAME_NOT_FOUND');

      const gameData = gameSnap.data()!;
      if (gameData.phase !== 'night') throw new Error('WRONG_PHASE');

      const players: { uid: string; isAlive: boolean }[] = gameData.players ?? [];
      if (!players.some(player => player.uid === uid && player.isAlive)) {
        throw new Error('INVALID_PLAYER');
      }

      // Private role document is the preferred authority. During migration,
      // accept the existing server-controlled roles map as a compatibility path.
      const privateRoleSnap = await transaction.get(
        gameRef.collection('playerRoles').doc(uid)
      );
      const authoritativeRole = privateRoleSnap.exists
        ? privateRoleSnap.data()?.role
        : gameData.roles?.[uid];

      if (typeof authoritativeRole !== 'string' || authoritativeRole !== requestedRole) {
        throw new Error('ROLE_MISMATCH');
      }

      // A role can submit at most once per round. Retries are idempotent.
      const round = Number(gameData.roundNumber ?? 1);
      const existing = gameData.nightSubmissions?.[authoritativeRole];
      if (existing && Number(existing.round ?? 0) === round) {
        return { duplicate: true };
      }

      const safePayload: Record<string, unknown> = { ...payload };
      safePayload.round = round;
      safePayload.uid = uid;
      safePayload.syncedAt = FieldValue.serverTimestamp();
      if (requestId) safePayload.requestId = requestId;

      transaction.set(
        gameRef,
        { nightSubmissions: { [authoritativeRole]: safePayload } },
        { merge: true }
      );

      return { duplicate: false };
    });

    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    if (code === 'GAME_NOT_FOUND') return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    if (code === 'WRONG_PHASE') return NextResponse.json({ error: 'No es fase de noche' }, { status: 409 });
    if (code === 'INVALID_PLAYER') return NextResponse.json({ error: 'Jugador no válido o muerto' }, { status: 403 });
    if (code === 'ROLE_MISMATCH') return NextResponse.json({ error: 'Rol no autorizado para este jugador' }, { status: 403 });
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
