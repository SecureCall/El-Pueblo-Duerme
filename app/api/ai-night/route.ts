import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getSdks } from '@/lib/server/firebase-admin';
import { validateCanonicalNightAction } from '@/lib/game/nightActionAuthority';

function pick<T>(items: T[]): T | null {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null;
}

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo', 'Bruja']);
const rolesWithTargets = new Map<string, string>([
  ['Vidente', 'seerTarget'], ['Profeta', 'profetaTarget'], ['Bruja', 'brujaTarget'],
  ['Guardián', 'guardianTarget'], ['Doctor', 'doctorTarget'], ['Niño Salvaje', 'salvajeMentor'],
  ['Sacerdote', 'sacerdoteTarget'], ['Ladrón', 'ladronTarget'], ['Anciana Líder', 'ancianaTarget'],
  ['Ángel Resucitador', 'angelResucitarTarget'], ['Silenciadora', 'silenciadoraTarget'],
  ['Sirena del Río', 'sirenaTarget'], ['Virginia Woolf', 'virginiawoolTarget'],
  ['Banshee', 'bansheePrediction'], ['Cambiaformas', 'cambiaformasTarget'],
  ['Líder del Culto', 'liderCultoTarget'], ['Pescador', 'pescadorTarget'],
  ['Vampiro', 'vampiroTarget'], ['Hada Buscadora', 'hadaBuscadoraTarget'],
  ['Médico Forense', 'forenseTarget'], ['Saboteador', 'saboteadorTarget'],
]);

function candidateTargets(players: Array<Record<string, unknown>>, uid: string, excludeRoles: Set<string> = new Set()) {
  return players.filter((p) => p.uid !== uid && p.isAlive === true && !excludeRoles.has(String(p.role ?? '')));
}

function buildPayload(
  role: string,
  uid: string,
  round: number,
  players: Array<Record<string, unknown>>,
  game: Record<string, unknown>,
): Record<string, unknown> {
  const alive = players.filter((p) => p.isAlive === true);
  const others = candidateTargets(players, uid);

  if (role === 'Lobo' || role === 'Lobo Blanco' || role === 'Cría de Lobo') {
    const wolves = players.filter((p) => p.isAlive === true && WOLF_ROLES.has(String(p.role ?? '')));
    const humanWolves = wolves.filter((p) => p.isAI !== true);
    if (humanWolves.length > 0 || game.lobosBlocked === true) return { _skip: true };
    const targets = others.filter((p) => !WOLF_ROLES.has(String(p.role ?? '')) && p.role !== 'Bruja');
    const target = pick(targets.length ? targets : others);
    if (!target) return { _skip: true };
    const payload: Record<string, unknown> = { wolfTarget: target.uid };
    if (game.criaLoboRage === true) {
      const second = pick(targets.filter((p) => p.uid !== target.uid));
      if (second) payload.wolfTarget2 = second.uid;
    }
    if (role === 'Lobo Blanco' && round % 2 === 0) {
      const special = pick(targets.filter((p) => p.uid !== target.uid));
      if (special) payload.loboBlancoCide = special.uid;
    }
    return payload;
  }

  if (role === 'Cupido') {
    if (round !== 1) return { _skip: true };
    const targets = others.filter((p) => p.isAlive === true).slice(0, 2);
    return targets.length === 2 ? { cupidTargets: targets.map((p) => p.uid) } : { _skip: true };
  }
  if (role === 'Flautista') {
    const enchanted = Array.isArray(game.enchanted) ? game.enchanted.filter((v): v is string => typeof v === 'string') : [];
    const targets = others.filter((p) => !enchanted.includes(String(p.uid)));
    const shuffled = [...targets].sort(() => Math.random() - 0.5).slice(0, 2);
    return shuffled.length === 2 ? { flautistaTargets: shuffled.map((p) => p.uid) } : { _skip: true };
  }
  if (role === 'Perro Lobo') return round === 1 ? { perroLoboSide: Math.random() < 0.5 ? 'wolves' : 'village' } : { _skip: true };
  if (role === 'Espía') return { espiaActivate: true };
  if (role === 'Vigía') return { vigiaActivate: true };
  if (role === 'Hechicera') return { _skip: true };

  if (role === 'Ángel Resucitador') {
    if (game.angelResucitadorUsed === true) return { _skip: true };
    const dead = players.filter((p) => p.isAlive === false);
    const target = Math.random() < 0.3 ? pick(dead) : null;
    return target ? { angelResucitarTarget: target.uid } : { _skip: true };
  }
  if (role === 'Médico Forense') {
    const dead = players.filter((p) => p.isAlive === false);
    const target = pick(dead);
    return target ? { forenseTarget: target.uid } : { _skip: true };
  }

  const action = rolesWithTargets.get(role);
  if (action) {
    if (round === 1 && ['Niño Salvaje', 'Ladrón', 'Sirena del Río', 'Virginia Woolf', 'Cambiaformas'].includes(role)) {
      const target = pick(others);
      return target ? { [action]: target.uid } : { _skip: true };
    }
    if (role === 'Hada Buscadora' && game.hadaLinked === true) return { _skip: true };
    if (role === 'Guardián') {
      const last = typeof game.guardianLastTarget === 'string' ? game.guardianLastTarget : null;
      const target = pick(others.filter((p) => p.uid !== last));
      return target ? { [action]: target.uid } : { _skip: true };
    }
    if (role === 'Doctor') {
      const last = typeof game.doctorLastTarget === 'string' ? game.doctorLastTarget : null;
      const target = pick(others.filter((p) => p.uid !== last));
      return target ? { [action]: target.uid } : { _skip: true };
    }
    const target = pick(others);
    return target ? { [action]: target.uid } : { _skip: true };
  }

  return { _skip: true };
}

export async function POST(request: NextRequest) {
  const uid = await verifyAuthToken(request);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    const gameId = typeof body?.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });

    const { db } = getSdks();
    const gameRef = db.collection('games').doc(gameId);
    const snap = await gameRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    const game = snap.data() as Record<string, unknown>;
    if (game.phase !== 'night') return NextResponse.json({ error: 'Night phase is not active' }, { status: 409 });
    const players = Array.isArray(game.players) ? game.players.filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object') : [];
    const caller = players.find((p) => p.uid === uid);
    if (!caller?.isAlive) return NextResponse.json({ error: 'Not an alive player' }, { status: 403 });
    if (game.hostUid !== uid) return NextResponse.json({ error: 'Only the host may trigger AI night actions' }, { status: 403 });

    const round = typeof game.roundNumber === 'number' && Number.isInteger(game.roundNumber) && game.roundNumber > 0 ? game.roundNumber : null;
    if (round === null) return NextResponse.json({ error: 'Invalid round' }, { status: 409 });

    const aiPlayers = players.filter((p) => p.isAI === true && p.isAlive === true && typeof p.uid === 'string');
    const accepted: string[] = [];
    const rejected: Array<{ uid: string; errors: string[] }> = [];

    for (const ai of aiPlayers) {
      const aiUid = String(ai.uid);
      const roleSnap = await gameRef.collection('playerRoles').doc(aiUid).get();
      if (!roleSnap.exists) { rejected.push({ uid: aiUid, errors: ['missing_private_role'] }); continue; }
      const roleData = roleSnap.data() ?? {};
      const role = typeof roleData.role === 'string' ? roleData.role : null;
      if (!role) { rejected.push({ uid: aiUid, errors: ['invalid_private_role'] }); continue; }

      const payload = buildPayload(role, aiUid, round, players, game);
      const validation = validateCanonicalNightAction({
        players: players.map((p) => ({ uid: String(p.uid), isAlive: p.isAlive === true })),
        actorUid: aiUid,
        actorRole: role,
        roundNumber: round,
        payload,
      });
      if (!validation.valid) { rejected.push({ uid: aiUid, errors: validation.errors }); continue; }

      const ref = gameRef.collection('nightSubmissions').doc(`${aiUid}:${round}`);
      const now = Date.now();
      await ref.set({ actorUid: aiUid, role, roundNumber: round, actions: validation.submissions, submittedAt: now, syncedAt: now }, { merge: true });
      accepted.push(aiUid);
    }

    return NextResponse.json({ ok: true, roundNumber: round, accepted, rejected });
  } catch (error) {
    console.error('[ai-night]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
