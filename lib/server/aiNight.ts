import { randomInt } from 'node:crypto';
import { validateCanonicalNightAction } from '@/lib/game/nightActionAuthority';

type AnyRecord = Record<string, unknown>;

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);
const TARGET_ACTIONS = new Map<string, string>([
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

function pick<T>(items: T[]): T | null { return items.length ? items[randomInt(items.length)] : null; }
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function buildPayload(role: string, uid: string, round: number, players: AnyRecord[], game: AnyRecord): AnyRecord {
  const aliveOthers = players.filter((p) => p.uid !== uid && p.isAlive === true);
  if (role === 'Lobo' || role === 'Lobo Blanco' || role === 'Cría de Lobo') {
    const wolves = players.filter((p) => p.isAlive === true && WOLF_ROLES.has(String(p.role ?? '')));
    if (wolves.some((p) => p.isAI !== true) || game.lobosBlocked === true) return { _skip: true };
    const targets = aliveOthers.filter((p) => !WOLF_ROLES.has(String(p.role ?? '')));
    const target = pick(targets.length ? targets : aliveOthers);
    if (!target) return { _skip: true };
    const payload: AnyRecord = { wolfTarget: target.uid };
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
    const targets = shuffle(aliveOthers).slice(0, 2);
    return targets.length === 2 ? { cupidTargets: targets.map((p) => p.uid) } : { _skip: true };
  }
  if (role === 'Flautista') {
    const enchanted = Array.isArray(game.enchanted) ? game.enchanted.filter((v): v is string => typeof v === 'string') : [];
    const targets = shuffle(aliveOthers.filter((p) => !enchanted.includes(String(p.uid)))).slice(0, 2);
    return targets.length === 2 ? { flautistaTargets: targets.map((p) => p.uid) } : { _skip: true };
  }
  if (role === 'Perro Lobo') return round === 1 ? { perroLoboSide: randomInt(2) === 0 ? 'wolves' : 'village' } : { _skip: true };
  if (role === 'Espía') return { espiaActivate: true };
  if (role === 'Vigía') return { vigiaActivate: true };
  if (role === 'Hechicera') return { _skip: true };
  if (role === 'Ángel Resucitador') {
    if (game.angelResucitadorUsed === true) return { _skip: true };
    const dead = players.filter((p) => p.isAlive === false);
    const target = randomInt(10) < 3 ? pick(dead) : null;
    return target ? { angelResucitarTarget: target.uid } : { _skip: true };
  }
  if (role === 'Médico Forense') {
    const target = pick(players.filter((p) => p.isAlive === false));
    return target ? { forenseTarget: target.uid } : { _skip: true };
  }
  const action = TARGET_ACTIONS.get(role);
  if (!action) return { _skip: true };
  if (round === 1 && ['Niño Salvaje', 'Ladrón', 'Sirena del Río', 'Virginia Woolf', 'Cambiaformas'].includes(role)) {
    const target = pick(aliveOthers); return target ? { [action]: target.uid } : { _skip: true };
  }
  if (role === 'Hada Buscadora' && game.hadaLinked === true) return { _skip: true };
  if (role === 'Guardián') {
    const last = typeof game.guardianLastTarget === 'string' ? game.guardianLastTarget : null;
    const target = pick(aliveOthers.filter((p) => p.uid !== last)); return target ? { [action]: target.uid } : { _skip: true };
  }
  if (role === 'Doctor') {
    const last = typeof game.doctorLastTarget === 'string' ? game.doctorLastTarget : null;
    const target = pick(aliveOthers.filter((p) => p.uid !== last)); return target ? { [action]: target.uid } : { _skip: true };
  }
  const target = pick(aliveOthers); return target ? { [action]: target.uid } : { _skip: true };
}

export async function ensureServerAINightSubmissions(
  db: FirebaseFirestore.Firestore,
  gameId: string,
  game: AnyRecord,
  players: AnyRecord[],
  round: number,
): Promise<{ accepted: string[]; rejected: Array<{ uid: string; errors: string[] }> }> {
  const gameRef = db.collection('games').doc(gameId);
  const aiPlayers = players.filter((p) => p.isAI === true && p.isAlive === true && typeof p.uid === 'string');
  const accepted: string[] = [];
  const rejected: Array<{ uid: string; errors: string[] }> = [];
  const roleSnapshots = await Promise.all(aiPlayers.map(async (p) => ({ uid: String(p.uid), snap: await gameRef.collection('playerRoles').doc(String(p.uid)).get() })));
  const writes: Array<{ uid: string; role: string; actions: unknown[] }> = [];

  for (const { uid, snap } of roleSnapshots) {
    if (!snap.exists) { rejected.push({ uid, errors: ['missing_private_role'] }); continue; }
    const role = typeof snap.data()?.role === 'string' ? snap.data()!.role as string : null;
    if (!role) { rejected.push({ uid, errors: ['invalid_private_role'] }); continue; }
    const payload = buildPayload(role, uid, round, players, game);
    const validation = validateCanonicalNightAction({
      players: players.map((p) => ({ uid: String(p.uid), isAlive: p.isAlive === true })),
      actorUid: uid, actorRole: role, roundNumber: round, payload,
    });
    if (!validation.valid) { rejected.push({ uid, errors: validation.errors }); continue; }
    writes.push({ uid, role, actions: validation.submissions });
  }

  // The resolver can call this function repeatedly (timer, reconnect, takeover,
  // or concurrent resolution attempts). AI decisions are immutable once written
  // for a round, so this path must never overwrite an existing submission.
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const refs = writes.map((write) => gameRef.collection('nightSubmissions').doc(`${write.uid}:${round}`));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));

    for (let i = 0; i < writes.length; i++) {
      if (snapshots[i].exists) continue;
      const write = writes[i];
      tx.create(refs[i], {
        actorUid: write.uid,
        role: write.role,
        roundNumber: round,
        actions: write.actions,
        submittedAt: now,
        syncedAt: now,
        source: 'server-ai',
      });
      accepted.push(write.uid);
    }
  });

  return { accepted, rejected };
}
