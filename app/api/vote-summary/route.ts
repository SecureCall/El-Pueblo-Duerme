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

    const round = Number(game.roundNumber ?? 1);
    const votesSnap = await gameRef.collection('votes').get();
    const counts: Record<string, number> = {};
    let myVote: string | null = null;
    let totalVoted = 0;

    votesSnap.forEach((doc) => {
      const data = doc.data() as any;
      if (Number(data.round) !== round || typeof data.target !== 'string') return;
      counts[data.target] = (counts[data.target] ?? 0) + 1;
      totalVoted += 1;
      if (doc.id === token.uid) myVote = data.target;
    });

    return NextResponse.json({ round, counts, myVote, totalVoted }, { status: 200 });
  } catch (error) {
    console.error('[vote-summary]', error);
    return NextResponse.json({ error: 'No se pudo obtener el resumen de votos' }, { status: 500 });
  }
}
