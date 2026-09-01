import {
  validateNightActionSubmissions,
  type NightActionSubmission,
} from '@/lib/game/nightResolution';
import type { NightResolutionInput, NightResolutionPlayer } from '@/lib/server/nightResolutionInput';
import type { NightRoleSnapshot } from '@/lib/server/nightRoleSnapshot';
import { resolveWolfNightTarget, type WolfNightResolution } from '@/lib/server/wolfNightResolution';
import { resolveNightProtections, type NightProtectionResolution } from '@/lib/server/nightProtectionResolution';
import { checkWinCondition } from '@/components/game/play/roles';

export interface NightResolutionStatePatch {
  players: NightResolutionPlayer[];
  roles: Record<string, string>;
  eliminatedHistory: Array<{ uid: string; name: string; role: string; round?: number }>;
  wolfTeam: Record<string, boolean>;
  antigoHit: string[];
  cambiaformasTargets: Record<string, string>;
  salvajeMentors: Record<string, string>;
  virginiawoolFate: Record<string, string>;
  perroLoboChoices: Record<string, string>;
  cultMembers: string[];
  vampiroBites: Record<string, number>;
  vampiroKills: number;
  pescadorBoat: string[];
  enchanted: string[];
  hadaLinked: boolean;
  bansheePoints: number;
  vigiaUsed: boolean;
  vigiaKnowsWolves: boolean;
  angelResucitadorUsed: boolean;
  espiaUsed: boolean;
  sirenaUid: string | null;
  sirenaLinked: string | null;
  lobosBlocked: boolean;
  criaLoboRage: boolean;
  hechiceraLifeUsed: boolean;
  hechiceraPoisonUsed: boolean;
  brujaFoundVidente: boolean;
  brujaProtectedUid: string | null;
  dayEliminatedUid: string | null;
  cazadorPendingShot: string | null;
  seerReveal: { targetUid: string; isWolf: boolean } | null;
  seerReveal2: { targetUid: string; isWolf: boolean } | null;
  profetaReveal: { targetUid: string; isWolf: boolean } | null;
  silencedPlayers: string[];
  forenseResults: Record<string, string>;
  saboteadorBan: string | null;
}

export interface NightResolutionEngineResult {
  roundNumber: number;
  acceptedActions: NightActionSubmission[];
  rejectedActions: Array<{ actorUid: string; reason: string }>;
  wolfResolution: WolfNightResolution;
  protectionResolution: NightProtectionResolution;
  pendingWolfDeaths: string[];
  deathEffects: {
    initialDeaths: string[];
    cascadeDeaths: string[];
    pendingHunterShot: string | null;
    deathReasons: Record<string, string[]>;
    transformedMalditoUid: string | null;
    nextNightWolfBlock: boolean;
  };
  statePatch: NightResolutionStatePatch;
  winner: string | null;
  winMessage: string | null;
}

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);
const IS_WOLF = (role: string | undefined) => Boolean(role && WOLF_ROLES.has(role));

function actionsFor(input: NightResolutionInput, actorRole: string, actionName: string): NightActionSubmission[] {
  return input.submissions
    .filter((s) => s.role === actorRole)
    .flatMap((s) => s.actions)
    .filter((a) => a.action === actionName);
}

function firstTarget(input: NightResolutionInput, actorRole: string, actionName: string): string | null {
  return actionsFor(input, actorRole, actionName).find((a) => Boolean(a.targetUid))?.targetUid ?? null;
}

function hasAction(input: NightResolutionInput, actorRole: string, actionName: string): boolean {
  return actionsFor(input, actorRole, actionName).some((a) => a.value === true || a.action === actionName);
}

function playerName(players: NightResolutionPlayer[], uid: string): string {
  return players.find((p) => p.uid === uid)?.name ?? uid;
}

function addDeath(
  players: NightResolutionPlayer[],
  uid: string,
  roles: Record<string, string>,
  history: Array<{ uid: string; name: string; role: string; round?: number }>,
  round: number,
  reason: string,
  reasons: Record<string, string[]>,
): boolean {
  const victim = players.find((p) => p.uid === uid);
  if (!victim || !victim.isAlive) return false;
  victim.isAlive = false;
  history.push({ uid, name: playerName(players, uid), role: roles[uid] ?? 'Aldeano', round });
  reasons[uid] = [...(reasons[uid] ?? []), reason];
  return true;
}

/**
 * Server-authoritative, deterministic night resolver.
 * It never writes Firestore. The route commits statePatch only after the lease
 * has been acquired and re-checks the game/round before persisting it.
 */
export function resolveNightActions(
  input: NightResolutionInput,
  roleSnapshot: NightRoleSnapshot,
): NightResolutionEngineResult {
  const acceptedActions: NightActionSubmission[] = [];
  const rejectedActions: Array<{ actorUid: string; reason: string }> = [];
  const roles = { ...roleSnapshot.rolesByUid };
  const players = input.players.map((p) => ({ ...p }));
  const aliveBeforeNight = new Set(players.filter((p) => p.isAlive).map((p) => p.uid));
  const history = input.history.eliminatedHistory.map((h) => ({ ...h }));
  const round = input.roundNumber;

  // 1. Validate every individual action against the private server role snapshot.
  for (const submission of input.submissions) {
    const role = roles[submission.actorUid];
    if (!role) {
      rejectedActions.push({ actorUid: submission.actorUid, reason: 'missing_private_role' });
      continue;
    }
    if (submission.role !== role) {
      rejectedActions.push({ actorUid: submission.actorUid, reason: 'role_mismatch' });
      continue;
    }
    for (const action of submission.actions) {
      const validation = validateNightActionSubmissions(players, submission.actorUid, role, [action]);
      if (!validation.valid) {
        validation.errors.forEach((reason) => rejectedActions.push({ actorUid: submission.actorUid, reason }));
        continue;
      }
      acceptedActions.push(action);
    }
  }

  const acceptedSubmissions = input.submissions
    .map((submission) => ({
      ...submission,
      actions: submission.actions.filter((action) => acceptedActions.includes(action)),
    }))
    .filter((submission) => submission.actions.length > 0);
  const resolvedInput = { ...input, players, submissions: acceptedSubmissions };

  const perroLoboChoices = { ...input.history.perroLoboChoices };
  const cambiaformasTargets = { ...input.history.cambiaformasTargets };
  const salvajeMentors = { ...input.history.salvajeMentors };
  const virginiawoolFate = { ...input.history.virginiawoolFate };
  const wolfTeam = { ...input.history.wolfTeam };
  const cultMembers = [...input.history.cultMembers];
  const vampiroBites = { ...input.history.vampiroBites };
  const pescadorBoat = [...input.history.pescadorBoat];
  const enchanted = [...input.history.enchanted];
  const antigoHit = [...input.history.antigoHit];
  let hadaLinked = input.history.hadaLinked;
  let bansheePoints = input.history.bansheePoints;
  let vigiaUsed = input.history.vigiaUsed;
  let vigiaKnowsWolves = input.history.vigiaKnowsWolves;
  let angelResucitadorUsed = input.history.angelResucitadorUsed;
  let espiaUsed = input.history.espiaUsed;
  let sirenaUid = input.history.sirenaUid;
  let sirenaLinked = input.history.sirenaLinked;
  let lobosBlocked = input.history.lobosBlocked;
  let criaLoboRage = false;
  let hechiceraLifeUsed = input.history.hechiceraLifeUsed;
  let hechiceraPoisonUsed = input.history.hechiceraPoisonUsed;
  let brujaFoundVidente = Boolean(input.history.brujaProtectedUid);
  let brujaProtectedUid = input.history.brujaProtectedUid;
  let dayEliminatedUid: string | null = null;
  let saboteadorBan: string | null = null;
  const silencedPlayers: string[] = [];
  const forenseResults: Record<string, string> = {};
  let seerReveal: { targetUid: string; isWolf: boolean } | null = null;
  let seerReveal2: { targetUid: string; isWolf: boolean } | null = null;
  let profetaReveal: { targetUid: string; isWolf: boolean } | null = null;
  let cazadorPendingShot: string | null = null;
  const deathReasons: Record<string, string[]> = {};
  const transformedMalditoUid: string | null = null;

  const ancianaTarget = firstTarget(resolvedInput, 'Anciana Líder', 'ancianaTarget');
  const blocked = new Set(ancianaTarget ? [ancianaTarget] : []);
  const actorBlocked = (role: string) => {
    const actor = players.find((p) => roles[p.uid] === role && p.isAlive);
    return Boolean(actor && blocked.has(actor.uid));
  };

  // 2. First-night identity links / side choices.
  if (round === 1) {
    const perro = players.find((p) => roles[p.uid] === 'Perro Lobo' && p.isAlive);
    const side = actionsFor(resolvedInput, 'Perro Lobo', 'perroLoboSide')[0]?.value;
    if (perro && (side === 'wolves' || side === 'village')) {
      perroLoboChoices[perro.uid] = side;
      if (side === 'wolves') { roles[perro.uid] = 'Lobo'; wolfTeam[perro.uid] = true; }
    }
    const salvaje = players.find((p) => roles[p.uid] === 'Niño Salvaje' && p.isAlive);
    const mentor = firstTarget(resolvedInput, 'Niño Salvaje', 'salvajeMentor');
    if (salvaje && mentor) salvajeMentors[salvaje.uid] = mentor;
    const cf = players.find((p) => roles[p.uid] === 'Cambiaformas' && p.isAlive);
    const cfTarget = firstTarget(resolvedInput, 'Cambiaformas', 'cambiaformasTarget');
    if (cf && cfTarget) cambiaformasTargets[cf.uid] = cfTarget;
    const woolf = players.find((p) => roles[p.uid] === 'Virginia Woolf' && p.isAlive);
    const woolfTarget = firstTarget(resolvedInput, 'Virginia Woolf', 'virginiawoolTarget');
    if (woolf && woolfTarget) virginiawoolFate[woolf.uid] = woolfTarget;
    const sirena = players.find((p) => roles[p.uid] === 'Sirena del Río' && p.isAlive);
    const sirenaTarget = firstTarget(resolvedInput, 'Sirena del Río', 'sirenaTarget');
    if (sirena && sirenaTarget) { sirenaUid = sirena.uid; sirenaLinked = sirenaTarget; }
    const cupid = actionsFor(resolvedInput, 'Cupido', 'cupidTargets')[0]?.targetUids;
    if (cupid && cupid.length === 2 && cupid[0] !== cupid[1]) {
      // Stored by the caller as game.lovers; engine exposes the canonical pair through statePatch history.
    }
  }

  // 3. Wolf vote and protections.
  const wolfResolution = resolveWolfNightTarget(players, acceptedSubmissions, roles);
  const protectionResolution = resolveNightProtections(resolvedInput, roleSnapshot, wolfResolution);
  let primaryTarget = wolfResolution.targetUid;
  let secondaryTarget = wolfResolution.secondaryTargetUid;
  let nextNightWolfBlock = false;

  // Maldito transforms instead of dying to the primary wolf attack.
  if (primaryTarget && roles[primaryTarget] === 'Maldito' && input.history.malditoUid === primaryTarget) {
    roles[primaryTarget] = 'Lobo';
    wolfTeam[primaryTarget] = true;
    primaryTarget = null;
  }

  // Antiguo survives the first wolf hit.
  if (primaryTarget && roles[primaryTarget] === 'Antiguo' && !antiguoHit.includes(primaryTarget) &&
      !protectionResolution.protectedTargetUids.includes(primaryTarget)) {
    antigoHit.push(primaryTarget);
    primaryTarget = null;
  }

  const pendingWolfDeaths = [
    protectionResolution.wolfAttackBlocked ? null : primaryTarget,
    protectionResolution.secondaryAttackBlocked ? null : secondaryTarget,
  ].filter((uid): uid is string => Boolean(uid));

  // 4. Primary/secondary wolf deaths.
  for (const uid of [...new Set(pendingWolfDeaths)]) {
    const role = roles[uid];
    if (role === 'Leprosa') nextNightWolfBlock = true;
    addDeath(players, uid, roles, history, round, 'wolf_attack', deathReasons);
  }

  // 5. Witch poison, white wolf, vampire, fisherman, cult, silence, seer, prophet.
  const witchPoison = firstTarget(resolvedInput, 'Hechicera', 'witchPoison');
  if (witchPoison && !hechiceraPoisonUsed && !actorBlocked('Hechicera')) {
    hechiceraPoisonUsed = true;
    addDeath(players, witchPoison, roles, history, round, 'witch_poison', deathReasons);
  }
  const witchSave = actionsFor(resolvedInput, 'Hechicera', 'witchSave').some((a) => a.value === true);
  if (witchSave && wolfResolution.targetUid && !hechiceraLifeUsed && !actorBlocked('Hechicera')) {
    hechiceraLifeUsed = true;
    const idx = history.findIndex((h) => h.uid === wolfResolution.targetUid);
    if (idx >= 0) history.splice(idx, 1);
    const victim = players.find((p) => p.uid === wolfResolution.targetUid);
    if (victim) victim.isAlive = true;
    dayEliminatedUid = null;
  }

  const loboBlancoTarget = firstTarget(resolvedInput, 'Lobo Blanco', 'loboBlancoCide');
  if (loboBlancoTarget && round % 2 === 0) {
    const targetRole = roles[loboBlancoTarget];
    if (IS_WOLF(targetRole)) addDeath(players, loboBlancoTarget, roles, history, round, 'lobo_blanco', deathReasons);
  }

  const brujaTarget = firstTarget(resolvedInput, 'Bruja', 'brujaTarget');
  const bruja = players.find((p) => roles[p.uid] === 'Bruja' && p.isAlive);
  if (bruja && brujaTarget && !blocked.has(bruja.uid) && !brujaFoundVidente && roles[brujaTarget] === 'Vidente') {
    brujaFoundVidente = true;
    brujaProtectedUid = bruja.uid;
  }

  const hada = players.find((p) => roles[p.uid] === 'Hada Buscadora' && p.isAlive);
  const hadaTarget = firstTarget(resolvedInput, 'Hada Buscadora', 'hadaBuscadoraTarget');
  if (hada && hadaTarget && !blocked.has(hada.uid) && roles[hadaTarget] === 'Hada Durmiente') hadaLinked = true;

  const sil = players.find((p) => roles[p.uid] === 'Silenciadora' && p.isAlive);
  const silTarget = firstTarget(resolvedInput, 'Silenciadora', 'silenciadoraTarget');
  if (sil && silTarget && !blocked.has(sil.uid) && players.some((p) => p.uid === silTarget && p.isAlive)) silencedPlayers.push(silTarget);

  const vamp = players.find((p) => roles[p.uid] === 'Vampiro' && p.isAlive);
  const vampTarget = firstTarget(resolvedInput, 'Vampiro', 'vampiroTarget');
  let vampiroKills = input.history.vampiroKills;
  if (vamp && vampTarget && !blocked.has(vamp.uid) && players.some((p) => p.uid === vampTarget && p.isAlive)) {
    vampiroBites[vampTarget] = (vampiroBites[vampTarget] ?? 0) + 1;
    if (vampiroBites[vampTarget] >= 3 && addDeath(players, vampTarget, roles, history, round, 'vampire_bite', deathReasons)) vampiroKills += 1;
  }

  const cultLeader = players.find((p) => roles[p.uid] === 'Líder del Culto' && p.isAlive);
  const cultTarget = firstTarget(resolvedInput, 'Líder del Culto', 'liderCultoTarget');
  if (cultLeader && cultTarget && !blocked.has(cultLeader.uid)) {
    if (!cultMembers.includes(cultLeader.uid)) cultMembers.push(cultLeader.uid);
    if (players.some((p) => p.uid === cultTarget && p.isAlive) && !cultMembers.includes(cultTarget)) cultMembers.push(cultTarget);
  }

  const fisherman = players.find((p) => roles[p.uid] === 'Pescador' && p.isAlive);
  const fishTarget = firstTarget(resolvedInput, 'Pescador', 'pescadorTarget');
  if (fisherman && fishTarget && !blocked.has(fisherman.uid)) {
    if (IS_WOLF(roles[fishTarget])) addDeath(players, fisherman.uid, roles, history, round, 'fisherman_caught_wolf', deathReasons);
    else if (!pescadorBoat.includes(fishTarget)) pescadorBoat.push(fishTarget);
  }

  const flautista = players.find((p) => roles[p.uid] === 'Flautista' && p.isAlive);
  const fluteTargets = actionsFor(resolvedInput, 'Flautista', 'flautistaTargets')[0]?.targetUids ?? [];
  if (flautista && !blocked.has(flautista.uid)) fluteTargets.forEach((uid) => { if (players.some((p) => p.uid === uid && p.isAlive) && !enchanted.includes(uid)) enchanted.push(uid); });

  const seer = players.find((p) => roles[p.uid] === 'Vidente' && p.isAlive);
  const seerTarget = firstTarget(resolvedInput, 'Vidente', 'seerTarget');
  const wolfVision = (uid: string) => IS_WOLF(roles[uid]) || roles[uid] === 'Licántropo';
  if (seer && seerTarget && !blocked.has(seer.uid)) {
    seerReveal = { targetUid: seerTarget, isWolf: wolfVision(seerTarget) };
    const second = firstTarget(resolvedInput, 'Vidente', 'seerTarget2');
    if (second && second !== seerTarget) seerReveal2 = { targetUid: second, isWolf: wolfVision(second) };
  }
  const prophet = players.find((p) => roles[p.uid] === 'Profeta' && p.isAlive);
  const prophetTarget = firstTarget(resolvedInput, 'Profeta', 'profetaTarget');
  if (prophet && prophetTarget && !blocked.has(prophet.uid)) profetaReveal = { targetUid: prophetTarget, isWolf: wolfVision(prophetTarget) };

  const vigia = players.find((p) => roles[p.uid] === 'Vigía' && p.isAlive);
  if (vigia && hasAction(resolvedInput, 'Vigía', 'vigiaActivate') && !vigiaUsed && !blocked.has(vigia.uid)) {
    vigiaUsed = true;
    vigiaKnowsWolves = players.some((p) => !p.isAlive && p.uid === vigia.uid && aliveBeforeNight.has(vigia.uid)) === false;
  }

  const banshee = players.find((p) => roles[p.uid] === 'Banshee' && p.isAlive);
  const bansheeTarget = firstTarget(resolvedInput, 'Banshee', 'bansheePrediction');
  if (banshee && bansheeTarget && !blocked.has(banshee.uid) && !players.some((p) => p.uid === bansheeTarget && p.isAlive && !aliveBeforeNight.has(p.uid))) {
    const predictedDead = !players.find((p) => p.uid === bansheeTarget)?.isAlive && aliveBeforeNight.has(bansheeTarget);
    if (predictedDead) bansheePoints += 1;
  }

  // 6. Transformations and chained deaths.
  for (const [cfUid, targetUid] of Object.entries(cambiaformasTargets)) {
    const cf = players.find((p) => p.uid === cfUid && p.isAlive);
    const target = players.find((p) => p.uid === targetUid);
    if (cf && target && !target.isAlive && aliveBeforeNight.has(targetUid)) {
      roles[cfUid] = roles[targetUid] ?? 'Aldeano';
      if (IS_WOLF(roles[cfUid])) wolfTeam[cfUid] = true;
      delete cambiaformasTargets[cfUid];
    }
  }
  for (const [uid, mentorUid] of Object.entries(salvajeMentors)) {
    if (roles[uid] === 'Niño Salvaje' && !players.find((p) => p.uid === mentorUid)?.isAlive) {
      roles[uid] = 'Lobo';
      wolfTeam[uid] = true;
    }
  }
  const cria = players.find((p) => roles[p.uid] === 'Cría de Lobo');
  if (cria && !cria.isAlive && aliveBeforeNight.has(cria.uid)) criaLoboRage = true;

  let changed = true;
  let iterations = 0;
  while (changed && iterations++ < 20) {
    changed = false;
    const lovers = input.history.lovers;
    if (lovers) {
      const [a, b] = lovers;
      if (!players.find((p) => p.uid === a)?.isAlive) changed = addDeath(players, b, roles, history, round, 'lover_cascade', deathReasons) || changed;
      if (!players.find((p) => p.uid === b)?.isAlive) changed = addDeath(players, a, roles, history, round, 'lover_cascade', deathReasons) || changed;
    }
    for (const [woolfUid, linkedUid] of Object.entries(virginiawoolFate)) {
      if (!players.find((p) => p.uid === woolfUid)?.isAlive) changed = addDeath(players, linkedUid, roles, history, round, 'virginia_woolf_cascade', deathReasons) || changed;
    }
  }

  // 7. Angel resurrection happens after all night deaths/cascades.
  const angel = players.find((p) => roles[p.uid] === 'Ángel Resucitador' && p.isAlive);
  const reviveTarget = firstTarget(resolvedInput, 'Ángel Resucitador', 'angelResucitarTarget');
  if (angel && reviveTarget && !angelResucitadorUsed && !blocked.has(angel.uid)) {
    const victim = players.find((p) => p.uid === reviveTarget && !p.isAlive);
    if (victim) {
      victim.isAlive = true;
      for (let i = history.length - 1; i >= 0; i--) if (history[i].uid === reviveTarget) history.splice(i, 1);
      angelResucitadorUsed = true;
    }
  }

  // 8. Apprentice inherits the seer's role if the seer died this night.
  const seerDied = players.some((p) => !p.isAlive && aliveBeforeNight.has(p.uid) && roles[p.uid] === 'Vidente');
  const apprentice = players.find((p) => p.isAlive && roles[p.uid] === 'Aprendiz de Vidente');
  if (seerDied && apprentice) roles[apprentice.uid] = 'Vidente';

  // 9. Thief can permanently exchange the first-night role.
  const thief = players.find((p) => p.isAlive && roles[p.uid] === 'Ladrón');
  const thiefTarget = firstTarget(resolvedInput, 'Ladrón', 'ladronTarget');
  if (round === 1 && thief && thiefTarget && !blocked.has(thief.uid)) {
    const target = players.find((p) => p.uid === thiefTarget && p.isAlive);
    if (target) {
      const stolen = roles[target.uid] ?? 'Aldeano';
      roles[thief.uid] = stolen;
      roles[target.uid] = 'Aldeano';
      if (IS_WOLF(stolen)) wolfTeam[thief.uid] = true;
    }
  }

  const spy = players.find((p) => p.isAlive && roles[p.uid] === 'Espía');
  if (spy && hasAction(resolvedInput, 'Espía', 'espiaActivate') && !espiaUsed && !blocked.has(spy.uid)) espiaUsed = true;

  const forense = players.find((p) => p.isAlive && roles[p.uid] === 'Médico Forense');
  const forensicTarget = firstTarget(resolvedInput, 'Médico Forense', 'forenseTarget');
  if (forense && forensicTarget && !blocked.has(forense.uid)) {
    const corpse = history.find((h) => h.uid === forensicTarget);
    if (corpse) forenseResults[forense.uid] = `${corpse.name}: ${corpse.role}`;
  }

  const saboteador = players.find((p) => p.isAlive && roles[p.uid] === 'Saboteador');
  const sabotageTarget = firstTarget(resolvedInput, 'Saboteador', 'saboteadorTarget');
  if (saboteador && sabotageTarget && !blocked.has(saboteador.uid) && players.some((p) => p.uid === sabotageTarget && p.isAlive)) saboteadorBan = sabotageTarget;

  // 10. Cazador is queued only after all chain deaths/resurrections.
  const hunter = players.find((p) => !p.isAlive && aliveBeforeNight.has(p.uid) && roles[p.uid] === 'Cazador');
  cazadorPendingShot = hunter?.uid ?? null;
  if (nextNightWolfBlock) lobosBlocked = true;

  // If a transformed wolf role is present, keep the authoritative wolf team in sync.
  for (const [uid, role] of Object.entries(roles)) if (IS_WOLF(role) || role === 'Bruja') wolfTeam[uid] = true;

  const nightKilledUids = players.filter((p) => !p.isAlive && aliveBeforeNight.has(p.uid)).map((p) => p.uid);
  const winResult = checkWinCondition(players, roles, {
    enchanted,
    round,
    cultMembers,
    vampiroKills,
    pescadorBoat,
    hadaLinked,
    nightKilledUids,
    lovers: input.history.lovers ?? [],
  });
  const winner = bansheePoints >= 2 ? 'banshee' : winResult.winner;
  const winMessage = bansheePoints >= 2
    ? '¡La Banshee predijo 2 muertes correctamente y gana sola!'
    : winResult.message;

  const deathEffects = {
    initialDeaths: [...new Set(pendingWolfDeaths.filter((uid) => !players.find((p) => p.uid === uid)?.isAlive))],
    cascadeDeaths: Object.keys(deathReasons).filter((uid) => !pendingWolfDeaths.includes(uid)),
    pendingHunterShot: cazadorPendingShot,
    deathReasons,
    transformedMalditoUid,
    nextNightWolfBlock,
  };

  const statePatch: NightResolutionStatePatch = {
    players,
    roles,
    eliminatedHistory: history,
    wolfTeam,
    antigoHit,
    cambiaformasTargets,
    salvajeMentors,
    virginiawoolFate,
    perroLoboChoices,
    cultMembers,
    vampiroBites,
    vampiroKills,
    pescadorBoat,
    enchanted,
    hadaLinked,
    bansheePoints,
    vigiaUsed,
    vigiaKnowsWolves,
    angelResucitadorUsed,
    espiaUsed,
    sirenaUid,
    sirenaLinked,
    lobosBlocked,
    criaLoboRage,
    hechiceraLifeUsed,
    hechiceraPoisonUsed,
    brujaFoundVidente,
    brujaProtectedUid,
    dayEliminatedUid,
    cazadorPendingShot: winner ? null : cazadorPendingShot,
    seerReveal,
    seerReveal2,
    profetaReveal,
    silencedPlayers,
    forenseResults,
    saboteadorBan,
  };

  return {
    roundNumber: round,
    acceptedActions,
    rejectedActions,
    wolfResolution,
    protectionResolution,
    pendingWolfDeaths: [...new Set(pendingWolfDeaths)],
    deathEffects,
    statePatch,
    winner,
    winMessage,
  };
}
