import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { assignRoles } from '@/components/game/play/roles';

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { gameId } = await req.json();
    if (typeof gameId !== 'string' || gameId.length < 1 || gameId.length > 128) {
      return NextResponse.json({ error: 'gameId inválido' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const ref = db.collection('games').doc(gameId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });

    const game = snap.data()!;
    if (game.hostUid !== uid) return NextResponse.json({ error: 'Solo el host puede iniciar la partida' }, { status: 403 });
    if (game.status !== 'playing') return NextResponse.json({ error: 'La partida no está lista para iniciar' }, { status: 409 });
    if (game.roles && Object.keys(game.roles).length > 0) return NextResponse.json({ ok: true, alreadyAssigned: true });

    const players = Array.isArray(game.players) ? game.players : [];
    if (players.length < 2) return NextResponse.json({ error: 'Jugadores insuficientes' }, { status: 409 });

    const scaledWolves = game.maxPlayers > 0
      ? Math.max(1, Math.round((Number(game.wolves ?? 1) / Number(game.maxPlayers)) * players.length))
      : Math.max(1, Number(game.wolves ?? 1));
    const assigned = assignRoles(players, scaledWolves, Array.isArray(game.specialRoles) ? game.specialRoles : []);

    const wolfTeam: Record<string, boolean> = {};
    const verdugos: Record<string, string> = {};
    const iluminadoReveal: Record<string, string> = {};
    const playersWithRoles = players.map((p: any) => ({ ...p, role: assigned[p.uid] ?? 'Aldeano' }));

    for (const [playerUid, role] of Object.entries(assigned)) {
      if (['Lobo', 'Lobo Blanco', 'Cría de Lobo', 'Bruja', 'Lobo Bruja'].includes(role)) wolfTeam[playerUid] = true;
      if (role === 'Verdugo') {
        const others = players.filter((p: any) => p.uid !== playerUid);
        if (others.length) verdugos[playerUid] = others[Math.floor(Math.random() * others.length)].uid;
      }
      if (role === 'Iluminado') {
        const wolves = players.filter((p: any) => ['Lobo', 'Lobo Blanco', 'Cría de Lobo'].includes(assigned[p.uid]));
        if (wolves.length) iluminadoReveal[playerUid] = wolves[Math.floor(Math.random() * wolves.length)].uid;
      }
    }

    const malditoUid = players.find((p: any) => assigned[p.uid] === 'Maldito')?.uid ?? null;
    const pescadorUid = players.find((p: any) => assigned[p.uid] === 'Pescador')?.uid ?? null;
    const now = Date.now();

    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      const currentData = current.data();
      if (!current.exists || currentData?.hostUid !== uid || (currentData.roles && Object.keys(currentData.roles).length)) {
        throw new Error('ASSIGNMENT_CONFLICT');
      }
      for (const [playerUid, role] of Object.entries(assigned)) {
        tx.set(ref.collection('playerRoles').doc(playerUid), { role, assignedAt: now });
      }
      tx.update(ref, {
        roles: assigned,
        wolfTeam,
        players: playersWithRoles,
        phase: 'roleReveal',
        roundNumber: 1,
        nightActions: {}, nightSubmissions: {}, dayVotes: {}, dayEliminatedUid: null,
        seerReveal: null, profetaReveal: null, lovers: null, winners: null,
        eliminatedHistory: [], enchanted: [], guardianLastTarget: null, doctorLastTarget: null,
        doctorSelfUsed: false, antiguoHit: [], perroLoboChoices: {}, salvajeMentors: {},
        brujaFoundVidente: false, brujaProtectedUid: null, lobosBlocked: false, criaLoboRage: false,
        silencedPlayers: [], sirenaUid: null, sirenaLinked: null, vigiaUsed: false, vigiaKnowsWolves: false,
        angelResucitadorUsed: false, bansheePoints: 0, bansheePredictionUid: null, cultMembers: [],
        vampiroBites: {}, vampiroKills: 0, pescadorBoat: [], pescadorUid, hadaLinked: false,
        verdugos, principeUsed: false, cambiaformasTargets: {}, virginiawoolFate: {}, fantasmaPending: [],
        fantasmaUsed: [], alborotadoraFight: null, alborotadoraUsed: false, hechiceraLifeUsed: false,
        hechiceraPoisonUsed: false, malditoUid, iluminadoReveal, forenseResults: {}, saboteadorBan: null,
        currentEvent: null, eventRound: 0, eclipseActive: false, doubleSeerActive: false,
        anonymousVotesActive: false, noExileActive: false,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === 'ASSIGNMENT_CONFLICT') return NextResponse.json({ error: 'La partida ya fue iniciada' }, { status: 409 });
    console.error('[assign-roles]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
