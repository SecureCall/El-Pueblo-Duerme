import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 });
    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    let hostName = 'Jugador';
    await db.runTransaction(async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists) throw new Error('GAME_NOT_FOUND');
      const game = snap.data()!;
      if (game.phase !== 'ended') throw new Error('INVALID_PHASE');
      const players = Array.isArray(game.players) ? game.players : [];
      const requester = players.find((p: any) => p?.uid === uid);
      if (!requester || requester.isAI) throw new Error('NOT_PLAYER');
      const currentHost = players.find((p: any) => p?.uid === game.hostUid);
      if (game.hostUid !== uid && currentHost) throw new Error('NOT_HOST');
      hostName = requester.name || 'Jugador';
      tx.update(gameRef, {
        phase:'lobby', roundNumber:0, hostUid:uid, hostName, roles:{}, nightActions:{},
        nightSubmissions:{}, dayVotes:{}, eliminatedHistory:[], winners:null, winMessage:'',
        lastVictim:null, bearGrowl:false, profetaReveal:null,
        players:players.map((p:any)=>({...p,isAlive:true,role:null,isHost:p.uid===uid})),
        loversUids:null,twinUids:null,enchanted:[],cursed:[],vampirizados:[],liderCultoMembers:[],
        virginiawoolTarget:null,vigiaUsed:false,angelResucitadorUsed:false,hadaLinked:false,
        fantasmaPending:[],fantasmaUsed:[],voteBanned:[],noExileActive:false,currentEvent:null,
        nightKilledUids:[],espiaUsed:false,doubleSeerActive:false,doubleExecution:false,
        bansheePredictionUid:null,cazadorPendingShot:null,chivoPendingChoice:null,silverwolf:false,
        criaLoboRage:false,narratorBroadcast:null,phaseEndsAt:null,dayStartedAt:null,nightStartedAt:null,
      });
    });
    return NextResponse.json({ ok:true, hostName });
  } catch (err) {
    const code=err instanceof Error?err.message:'INTERNAL';
    const errors:Record<string,[string,number]>={GAME_NOT_FOUND:['Partida no encontrada',404],INVALID_PHASE:['La revancha no está disponible',409],NOT_PLAYER:['No perteneces a esta partida',403],NOT_HOST:['El anfitrión actual sigue en la partida',403]};
    const [error,status]=errors[code]??['Error interno',500];
    return NextResponse.json({error},{status});
  }
}