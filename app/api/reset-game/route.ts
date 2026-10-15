import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';

const RESET_FIELDS = {
  roles: {},
  nightActions: {},
  nightSubmissions: {},
  dayVotes: {},
  eliminatedHistory: [],
  winners: null,
  winMessage: '',
  lastVictim: null,
  bearGrowl: false,
  profetaReveal: null,
  loversUids: null,
  twinUids: null,
  enchanted: [],
  cursed: [],
  vampirizados: [],
  liderCultoMembers: [],
  virginiawoolTarget: null,
  vigiaUsed: false,
  angelResucitadorUsed: false,
  hadaLinked: false,
  fantasmaPending: [],
  fantasmaUsed: [],
  voteBanned: [],
  noExileActive: false,
  currentEvent: null,
  nightKilledUids: [],
  espiaUsed: false,
  doubleSeerActive: false,
  doubleExecution: false,
  bansheePredictionUid: null,
  cazadorPendingShot: null,
  chivoPendingChoice: null,
  silverwolf: false,
  criaLoboRage: false,
  narratorBroadcast: null,
  phaseEndsAt: null,
  dayStartedAt: null,
  nightStartedAt: null,
};

export async function POST(request: Request) {
  try {
    const user = await verifyAuthToken(request);
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    const requestedHostName = typeof body?.hostName === 'string' ? body.hostName.trim().slice(0, 48) : '';
    if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });

    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data() as Record<string, any>;
      if (game.phase !== 'ended') throw new Error('NOT_ENDED');
      const players = Array.isArray(game.players) ? game.players : [];
      const hostStillHere = players.some((p: any) => p?.uid === game.hostUid);
      const callerIsPlayer = players.some((p: any) => p?.uid === user.uid && p?.isAI !== true);
      if (game.hostUid !== user.uid && hostStillHere) throw new Error('NOT_HOST');
      if (game.hostUid !== user.uid && !callerIsPlayer) throw new Error('NOT_PLAYER');

      const hostName = requestedHostName || 'Jugador';
      const resetPlayers = players.map((p: any) => ({
        ...p,
        isAlive: true,
        role: null,
        isHost: p?.uid === user.uid,
      }));
      tx.update(gameRef, {
        ...RESET_FIELDS,
        phase: 'lobby',
        roundNumber: 0,
        hostUid: user.uid,
        hostName,
        players: resetPlayers,
      });
    });

    // The lobby reset is committed first; remove stale private role documents
    // so a rematch cannot accidentally reuse secrets from the previous game.
    const privateRoles = await gameRef.collection('playerRoles').get();
    for (let i = 0; i < privateRoles.docs.length; i += 400) {
      const batch = db.batch();
      for (const roleDoc of privateRoles.docs.slice(i, i + 400)) batch.delete(roleDoc.ref);
      await batch.commit();
    }

    return NextResponse.json({ ok: true, gameId, phase: 'lobby' });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    const errors: Record<string, [number, string]> = {
      GAME_NOT_FOUND: [404, 'Game not found'],
      NOT_ENDED: [409, 'Only an ended game can be reset'],
      NOT_HOST: [403, 'The current host is still in the game'],
      NOT_PLAYER: [403, 'Only a player in this game may take over a rematch'],
      UNAUTHORIZED: [401, 'Unauthorized'],
    };
    const [status, message] = errors[code] ?? [500, 'Internal error'];
    if (status >= 500) console.error('[reset-game]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
