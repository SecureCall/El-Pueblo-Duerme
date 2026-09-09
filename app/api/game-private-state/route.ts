import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);
const WOLF_ALLY_ROLES = new Set(['Bruja']);

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
    const players = Array.isArray(game.players)
      ? game.players.filter((p: any) => p && typeof p.uid === 'string')
      : [];
    const actor = players.find((p: any) => p.uid === tokenUid);
    if (!actor) return NextResponse.json({ error: 'Jugador no autorizado' }, { status: 403 });

    const roleEntries = await Promise.all(
      players.map(async (player: any) => {
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
    if (game.phase === 'ended' || game.status === 'ended') {
      const wolfTeam: Record<string, boolean> = {};
      for (const [uid, role] of Object.entries(roles)) {
        if (WOLF_ROLES.has(role)) wolfTeam[uid] = true;
      }
      return NextResponse.json({ ok: true, phase: 'ended', myRole, roles, wolfTeam });
    }

    const canSeeWolfRoster = !!myRole && (WOLF_ROLES.has(myRole) || WOLF_ALLY_ROLES.has(myRole));
    const wolfRoster = canSeeWolfRoster
      ? players
          .filter((player: any) => WOLF_ROLES.has(roles[player.uid]))
          .map((player: any) => ({ uid: player.uid, name: player.name }))
      : [];

    return NextResponse.json({
      ok: true,
      phase: String(game.phase ?? ''),
      myRole,
      myTeam: myRole && (WOLF_ROLES.has(myRole) || WOLF_ALLY_ROLES.has(myRole)) ? 'wolves' : 'village',
      wolfRoster,
    });
  } catch (err) {
    console.error('[game-private-state]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
