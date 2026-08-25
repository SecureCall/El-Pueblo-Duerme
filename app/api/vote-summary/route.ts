import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const token = await adminAuth.verifyIdToken(authorization.slice(7));
    const gameId = request.nextUrl.searchParams.get('gameId');
    if (!gameId) return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });

    const gameRef = adminDb.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });

    const game = gameSnap.data() as any;
    const player = (game.players ?? []).find((p: any) => p.uid === token.uid);
    if (!player) return NextResponse.json({ error: 'No perteneces a esta partida' }, { status: 403 });

    // Vote summaries are only available to living players while the vote is active.
    // This prevents historical vote data from becoming a post-game information leak.
    if (!player.isAlive) {
      return NextResponse.json({ error: 'Solo los jugadores vivos pueden consultar la votación' }, { status: 403 });
    }
    if (game.phase !== 'day' && game.phase !== 'voting') {
      return NextResponse.json({ error: 'La votación no está activa' }, { status: 409 });
    }

    const round = Number(game.roundNumber ?? 1);
    if (!Number.isInteger(round) || round < 1) {
      return NextResponse.json({ error: 'Ronda de partida inválida' }, { status: 409 });
    }

    const aliveUids = new Set(
      (game.players ?? [])
        .filter((p: any) => p?.isAlive === true && typeof p?.uid === 'string')
        .map((p: any) => p.uid)
    );

    const votesSnap = await gameRef.collection('votes').get();
    const counts: Record<string, number> = {};
    let myVote: string | null = null;
    let totalVoted = 0;

    votesSnap.forEach((voteDoc) => {
      const data = voteDoc.data() as any;
      if (Number(data.round) !== round || typeof data.target !== 'string') return;
      if (!aliveUids.has(voteDoc.id) || !aliveUids.has(data.target)) return;

      counts[data.target] = (counts[data.target] ?? 0) + 1;
      totalVoted += 1;
      if (voteDoc.id === token.uid) myVote = data.target;
    });

    return NextResponse.json({ round, counts, myVote, totalVoted }, { status: 200 });
  } catch (error) {
    console.error('[vote-summary]', error);
    return NextResponse.json({ error: 'No se pudo obtener el resumen de votos' }, { status: 500 });
  }
}
