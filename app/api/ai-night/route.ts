import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getSdks } from '@/lib/server/firebase-admin';
import { validateCanonicalNightAction } from '@/lib/game/nightActionAuthority';

function pick<T>(items: T[]): T | null {
  return items.length ? items[randomInt(items.length)] : null;
}

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);
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

interface Player {
  uid: string;
  isAlive: boolean;
  isAI: boolean;
  role: string;
}

function candidateTargets(players: Player[], uid: string, excludeRoles: Set<string> = new Set()) {
  return players.filter((p) => p.uid !== uid && p.isAlive && !excludeRoles.has(p.role));
}

function buildPayload(
  role: string,
  uid: string,
  round: number,
  players: Player[],
  game: Record<string, unknown>,
  aiWolfUids: string[],
): Record<string, unknown> {
  const others = candidateTargets(players, uid);

  if (WOLF_ROLES.has(role)) {
    // Exactly one AI wolf owns the shared kill when no human wolf has submitted.
    // This prevents multiple AI wolves from racing to overwrite one another.
    if (aiWolfUids[0] !== uid || game.lobosBlocked === true) return { _skip: true };
    const targets = others.filter((p) => !WOLF_ROLES.has(p.role));
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
    const shuffled = [...others].sort(() => randomInt(2) === 0 ? -1 : 1);
    const targets = shuffled.slice(0, 2);
    return targets.length === 2 ? { cupidTargets: targets.map((p) => p.uid) } : { _skip: true };
  }

  if (role === 'Flautista') {
    const enchanted = Array.isArray(game.enchanted)
      ? game.enchanted.filter((v): v is string => typeof v === 'string')
      : [];
    const targets = others.filter((p) => !enchanted.includes(p.uid));
    const shuffled = [...targets].sort(() => randomInt(2) === 0 ? -1 : 1).slice(0, 2);
    return shuffled.length === 2 ? { flautistaTargets: shuffled.map((p) => p.uid) } : { _skip: true };
  }

  if (role === 'Perro Lobo') {
    return round === 1
      ? { perroLoboSide: randomInt(2) === 0 ? 'wolves' : 'village' }
      : { _skip: true };
  }

  if (role === 'Espía') return { espiaActivate: true };
  if (role === 'Vigía') return { vigiaActivate: true };
  if (role === 'Hechicera') return { _skip: true };

  if (role === 'Ángel Resucitador') {
    if (game.angelResucitadorUsed === true) return { _skip: true };
    const dead = players.filter((p) => !p.isAlive);
    const target = randomInt(10) < 3 ? pick(dead) : null;
    return target ? { angelResucitarTarget: target.uid } : { _skip: true };
  }

  if (role === 'Médico Forense') {
    const dead = players.filter((p) => !p.isAlive);
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

    const rawPlayers = Array.isArray(game.players) ? game.players : [];
    const playerBase = rawPlayers
      .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
      .filter((p) => typeof p.uid === 'string');
    const caller = playerBase.find((p) => p.uid === uid);
    if (caller?.isAlive !== true) return NextResponse.json({ error: 'Not an alive player' }, { status: 403 });
    if (game.hostUid !== uid) return NextResponse.json({ error: 'Only the host may trigger AI night actions' }, { status: 403 });

    const round = typeof game.roundNumber === 'number' && Number.isInteger(game.roundNumber) && game.roundNumber > 0
      ? game.roundNumber
      : null;
    if (round === null) return NextResponse.json({ error: 'Invalid round' }, { status: 409 });

    // Roles used for AI decisions come exclusively from private server documents.
    const aiCandidates = playerBase.filter((p) => p.isAI === true && p.isAlive === true);
    const roleEntries = await Promise.all(aiCandidates.map(async (p) => {
      const roleSnap = await gameRef.collection('playerRoles').doc(String(p.uid)).get();
      const role = roleSnap.exists && typeof roleSnap.data()?.role === 'string' ? String(roleSnap.data()?.role) : null;
      return { uid: String(p.uid), role };
    }));

    const privateRoles = new Map(roleEntries.filter((x): x is { uid: string; role: string } => x.role !== null).map((x) => [x.uid, x.role]));
    const allPlayers: Player[] = playerBase.map((p) => ({
      uid: String(p.uid),
      isAlive: p.isAlive === true,
      isAI: p.isAI === true,
      role: privateRoles.get(String(p.uid)) ?? 'Aldeano',
    }));
    const aiPlayers = allPlayers.filter((p) => p.isAI && p.isAlive && privateRoles.has(p.uid));
    const aiWolfUids = aiPlayers.filter((p) => WOLF_ROLES.has(p.role)).map((p) => p.uid).sort();

    const accepted: string[] = [];
    const rejected: Array<{ uid: string; errors: string[] }> = [];
    const writes: Array<{ uid: string; role: string; actions: unknown[] }> = [];

    for (const ai of aiPlayers) {
      const payload = buildPayload(ai.role, ai.uid, round, allPlayers, game, aiWolfUids);
      const validation = validateCanonicalNightAction({
        players: allPlayers.map((p) => ({ uid: p.uid, isAlive: p.isAlive })),
        actorUid: ai.uid,
        actorRole: ai.role,
        roundNumber: round,
        payload,
      });

      if (!validation.valid) {
        rejected.push({ uid: ai.uid, errors: validation.errors });
        continue;
      }
      writes.push({ uid: ai.uid, role: ai.role, actions: validation.submissions });
      accepted.push(ai.uid);
    }

    // Persist all AI submissions atomically. Repeated calls are idempotent for the
    // same uid+round and can never leave half of the AI team submitted.
    const batch = db.batch();
    const now = Date.now();
    for (const write of writes) {
      const ref = gameRef.collection('nightSubmissions').doc(`${write.uid}:${round}`);
      batch.set(ref, {
        actorUid: write.uid,
        role: write.role,
        roundNumber: round,
        actions: write.actions,
        submittedAt: now,
        syncedAt: now,
        source: 'server-ai',
      }, { merge: true });
    }
    if (writes.length) await batch.commit();

    return NextResponse.json({ ok: true, roundNumber: round, accepted, rejected });
  } catch (error) {
    console.error('[ai-night]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
