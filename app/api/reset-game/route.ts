import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/server/auth';
import { getSdks } from '@/lib/server/firebase-admin';

const RESET_FIELDS = {
  roles: {},
  wolfTeam: {},
  nightActions: {},
  nightSubmissions: {},
  dayVotes: {},
  votes: {},
  eliminatedHistory: [],
  antigoHit: [],
  cambiaformasTargets: {},
  salvajeMentors: {},
  virginiawoolFate: {},
  perroLoboChoices: {},
  cultMembers: [],
  vampiroBites: {},
  vampiroKills: 0,
  pescadorBoat: [],
  bansheePoints: 0,
  vigiaKnowsWolves: false,
  hechiceraLifeUsed: false,
  hechiceraPoisonUsed: false,
  brujaFoundVidente: false,
  brujaProtectedUid: null,
  sirenaUid: null,
  sirenaLinked: null,
  guardianLastTarget: null,
  doctorLastTarget: null,
  doctorSelfUsed: false,
  dayEliminatedUid: null,
  seerReveal: null,
  seerReveal2: null,
  silencedPlayers: [],
  forenseResults: {},
  saboteadorBan: null,
  principeUsed: false,
  alborotadoraFight: [],
  eventRound: null,
  malditoUid: null,
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
      if (hostStillHere && game.hostUid !== user.uid) throw new Error('NOT_HOST');
      if (!hostStillHere && !callerIsPlayer) throw new Error('NOT_PLAYER');

      // Read the private role collection before writing so the public reset
      // and removal of old secrets commit atomically.
      const privateRoles = await tx.get(gameRef.collection('playerRoles'));
      // Resolution locks are keyed by round number. Since a rematch starts
      // again at round 1, retaining a resolved lock would reject its first night.
      const oldNightResolutions = await tx.get(gameRef.collection('nightResolutions'));
      const hostName = requestedHostName || 'Jugador';
      const resetPlayers = players.map((p: any) => ({
        ...p,
        isAlive: true,
        role: null,
        isHost: p?.uid === user.uid,
      }));
      tx.update(gameRef, {
        ...RESET_FIELDS,
        status: 'lobby',
        phase: 'lobby',
        roundNumber: 0,
        startedAt: null,
        hostUid: user.uid,
        hostName,
        players: resetPlayers,
      });
      for (const roleDoc of privateRoles.docs) tx.delete(roleDoc.ref);
      for (const resolutionDoc of oldNightResolutions.docs) tx.delete(resolutionDoc.ref);
    });

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
