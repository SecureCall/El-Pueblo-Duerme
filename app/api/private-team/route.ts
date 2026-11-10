import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

type GamePlayer = Record<string, unknown>;
const isRecord = (value: unknown): value is GamePlayer =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export async function GET(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const gameId = req.nextUrl.searchParams.get('gameId');
  if (!gameId) return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });

  try {
    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });

    const game = gameSnap.data() ?? {};
    const players = Array.isArray(game.players) ? game.players.filter(isRecord) : [];
    const me = players.find((player) => player.uid === uid);
    if (!me) return NextResponse.json({ error: 'Jugador no pertenece a la partida' }, { status: 403 });

    const roleSnap = await gameRef.collection('playerRoles').doc(uid).get();
    const role = roleSnap.data()?.role ?? roleSnap.data()?.rol;
    if (typeof role !== 'string') return NextResponse.json({ teammates: [] });

    // Preserve the existing RoleReveal behaviour: only the Lobo sees the named Lobo teammates.
    if (role !== 'Lobo') return NextResponse.json({ teammates: [] });

    const roleDocs = await Promise.all(
      players
        .filter((player) => typeof player.uid === 'string' && player.uid !== uid && player.isAlive === true)
        .map(async (player) => {
          const playerUid = player.uid as string;
          const snap = await gameRef.collection('playerRoles').doc(playerUid).get();
          const otherRole = snap.data()?.role ?? snap.data()?.rol;
          return otherRole === 'Lobo' ? { uid: playerUid, name: typeof player.name === 'string' ? player.name : 'Jugador' } : null;
        })
    );

    return NextResponse.json({
      teammates: roleDocs.filter(Boolean),
    });
  } catch (error) {
    console.error('[private-team]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
