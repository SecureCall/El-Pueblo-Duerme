import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);
const WOLF_ALLY_ROLES = new Set(['Bruja']);
// Faction membership is broader than membership of the attacking pack.
// Hada Buscadora belongs to the wolves faction but has a separate win condition;
// Maldito starts on the village side and only joins the pack after transformation.
const WOLF_FACTION_ROLES = new Set([...WOLF_ROLES, 'Bruja', 'Hada Buscadora']);
type GamePlayer = Record<string, unknown> & { uid: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const isWolfPackMember = (uid: string, role: string | undefined, choices: Record<string, string>) =>
  !!role && (WOLF_ROLES.has(role) || (role === 'Perro Lobo' && choices[uid] === 'wolves'));

/**
 * Returns only secret state the authenticated player is entitled to see.
 *
 * Active games: own role/team and the wolf roster only for the wolf side or
 * its explicit Bruja ally.
 * Ended games: the complete role reveal, because roles are public after the
 * game has finished.
 */
export async function GET(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const gameId = req.nextUrl.searchParams.get('gameId')?.trim() ?? '';
    if (!gameId) return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });

    const game = gameSnap.data() ?? {};
    const players: GamePlayer[] = Array.isArray(game.players)
      ? game.players.filter((player): player is GamePlayer => isRecord(player) && typeof player.uid === 'string')
      : [];
    const actor = players.find((player) => player.uid === tokenUid);
    if (!actor) return NextResponse.json({ error: 'Jugador no autorizado' }, { status: 403 });

    const roleEntries = await Promise.all(
      players.map(async (player) => {
        const snap = await gameRef.collection('playerRoles').doc(player.uid).get();
        const role = snap.data()?.role;
        return typeof role === 'string' ? [player.uid, role] as const : null;
      }),
    );
    const roles: Record<string, string> = {};
    for (const entry of roleEntries) {
      if (entry) roles[entry[0]] = entry[1];
    }

    const myRole = roles[tokenUid] ?? null;
    const perroLoboChoices: Record<string, string> = {};
    if (isRecord(game.perroLoboChoices)) {
      for (const [uid, choice] of Object.entries(game.perroLoboChoices)) {
        if (typeof choice === 'string') perroLoboChoices[uid] = choice;
      }
    }
    const hasJoinedWolves = myRole === 'Perro Lobo' && perroLoboChoices[tokenUid] === 'wolves';
    const myTeam: 'wolves' | 'village' =
      myRole && (WOLF_FACTION_ROLES.has(myRole) || hasJoinedWolves) ? 'wolves' : 'village';

    if (game.phase === 'ended' || game.status === 'ended') {
      const wolfTeam: Record<string, boolean> = {};
      for (const [uid, role] of Object.entries(roles)) {
        if (isWolfPackMember(uid, role, perroLoboChoices)) wolfTeam[uid] = true;
      }
      return NextResponse.json({ ok: true, phase: 'ended', myRole, myTeam, roles, wolfTeam });
    }

    const knownAllies = myRole === 'Gemela' || myRole === 'Gemelas' || myRole === 'Hermanos'
      ? players
          .filter((player) => player.uid !== tokenUid && roles[player.uid] === myRole && player.isAlive === true)
          .map((player) => ({ uid: player.uid, name: typeof player.name === 'string' ? player.name : '' }))
      : [];

    const canSeeWolfRoster = !!myRole && (
      WOLF_ROLES.has(myRole) || WOLF_ALLY_ROLES.has(myRole) || hasJoinedWolves
    );
    const wolfRoster = canSeeWolfRoster
      ? players
          .filter((player) => isWolfPackMember(player.uid, roles[player.uid], perroLoboChoices))
          .map((player) => ({ uid: player.uid, name: typeof player.name === 'string' ? player.name : '' }))
      : [];

    return NextResponse.json({
      ok: true,
      phase: String(game.phase ?? ''),
      myRole,
      myTeam,
      wolfRoster,
      knownAllies,
    });
  } catch (err) {
    console.error('[game-private-state]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
