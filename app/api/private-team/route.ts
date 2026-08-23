import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

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
    const players = Array.isArray(game.players) ? game.players : [];
    const me = players.find((p: any) => p?.uid === uid);
    if (!me) return NextResponse.json({ error: 'Jugador no pertenece a la partida' }, { status: 403 });

    const roleSnap = await gameRef.collection('playerRoles').doc(uid).get();
    const role = roleSnap.data()?.role ?? roleSnap.data()?.rol;
    if (typeof role !== 'string') return NextResponse.json({ teammates: [] });

    // Preserve the existing RoleReveal behaviour: only the Lobo sees the named Lobo teammates.
    if (role !== 'Lobo') return NextResponse.json({ teammates: [] });

    const roleDocs = await Promise.all(
      players
        .filter((p: any) => p?.uid && p.uid !== uid && p.isAlive)
        .map(async (p: any) => {
          const snap = await gameRef.collection('playerRoles').doc(p.uid).get();
          const otherRole = snap.data()?.role ?? snap.data()?.rol;
          return otherRole === 'Lobo' ? { uid: p.uid, name: p.name } : null;
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
