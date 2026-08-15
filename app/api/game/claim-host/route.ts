import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const HOST_TIMEOUT_MS = 90_000;

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const gameId = body?.gameId;
    if (typeof gameId !== 'string' || gameId.length === 0 || gameId.length > 64) {
      return NextResponse.json({ error: 'gameId inválido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);

    const result = await db.runTransaction(async tx => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) return { status: 404, body: { error: 'Partida no encontrada' } };
      const game = gameSnap.data()!;

      if (game.phase === 'ended' || game.phase === 'lobby') {
        return { status: 409, body: { error: 'La partida no permite cambio de host' } };
      }

      if (game.hostUid === uid) {
        return { status: 200, body: { ok: true, alreadyHost: true } };
      }

      const players = Array.isArray(game.players) ? game.players : [];
      const me = players.find((p: any) => p.uid === uid);
      if (!me?.isAlive) return { status: 403, body: { error: 'Solo un jugador vivo puede asumir el host' } };

      const candidates = players
        .filter((p: any) => p.isAlive && typeof p.uid === 'string')
        .sort((a: any, b: any) => a.uid.localeCompare(b.uid));
      if (!candidates.length || candidates[0].uid !== uid) {
        return { status: 403, body: { error: 'No eres el candidato de host autorizado' } };
      }

      const hostPresenceSnap = await tx.get(db.collection('presence').doc(game.hostUid));
      const lastSeen = Number(hostPresenceSnap.data()?.lastSeen ?? 0);
      if (lastSeen > 0 && Date.now() - lastSeen <= HOST_TIMEOUT_MS) {
        return { status: 409, body: { error: 'El host actual sigue conectado' } };
      }

      const updatedPlayers = players.map((p: any) => ({ ...p, isHost: p.uid === uid }));
      tx.update(gameRef, { hostUid: uid, players: updatedPlayers, hostChangedAt: Date.now() });
      return { status: 200, body: { ok: true, hostUid: uid } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('[claim-host]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
