import { checkWinCondition } from '@/components/game/play/roles';

export interface DayResolutionPlayer {
  uid: string;
  name?: string;
  isAlive: boolean;
  [key: string]: unknown;
}

export interface DayResolutionInput {
  gameId: string;
  roundNumber: number;
  now: number;
  players: DayResolutionPlayer[];
  votes: Record<string, string>;
  roles: Record<string, string>;
  wolfTeam: Record<string, boolean>;
  eliminatedHistory: Array<{ uid: string; name: string; role: string; round?: number }>;
  enchanted: string[];
  salvajeMentors: Record<string, string>;
  cambiaformasTargets: Record<string, string>;
  verdugos: Record<string, string>;
  virginiawoolFate: Record<string, string>;
  lovers: [string, string] | null;
  cultMembers: string[];
  perroLoboChoices: Record<string, 'wolves' | 'village'>;
  vampiroKills: number;
  pescadorBoat: string[];
  hadaLinked: boolean;
  fantasmaPending: string[];
  fantasmaUsed: string[];
  bansheePoints: number;
  bansheePredictionUid: string | null;
  voteBanned: string[];
  saboteadorBan: string | null;
  cursed: { uid: string; round: number } | null;
  currentEvent: { mechanical?: string } | null;
  noExileActive: boolean;
  principeUsed: boolean;
  alborotadoraFight: [string, string] | null;
  sirenaLinked: string | null;
}

export interface DayResolutionStatePatch {
  players: DayResolutionPlayer[];
  roles: Record<string, string>;
  eliminatedHistory: Array<{ uid: string; name: string; role: string; round?: number }>;
  enchanted: string[];
  cazadorPendingShot: string | null;
  chivoPendingChoice: string | null;
  voteBanned: string[];
  alquimistaPotion: null;
  alquimistaRevealUid: null;
  juezUsed: boolean;
  alborotadoraFight: null;
  fantasmaPending: string[];
  silencedPlayers: string[];
  bansheePredictionUid: null;
  bansheePoints: number;
  phase: 'night' | 'ended';
  winners: string | null;
  winMessage: string | null;
  roundNumber: number;
  dayVotes: Record<string, string>;
  dayEliminatedUid: null;
  seerReveal: null;
  seerReveal2: null;
  profetaReveal: null;
  nightActions: Record<string, never>;
  nightSubmissions: Record<string, never>;
  bearGrowl: false;
  nightStartedAt: number | null;
  phaseEndsAt: number | null;
  currentEvent: null;
  eclipseActive: false;
  doubleSeerActive: false;
  anonymousVotesActive: false;
  noExileActive: false;
  saboteadorBan: null;
  cambiaformasTargets: Record<string, string>;
  wolfTeam: Record<string, boolean>;
  revealDeadResult: null;
}

export interface DayResolutionEngineResult {
  roundNumber: number;
  tally: Record<string, number>;
  eliminated: string | null;
  secondEliminated: string | null;
  isTie: boolean;
  winner: string | null;
  winMessage: string | null;
  statePatch: DayResolutionStatePatch;
}

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);
const isWolf = (role?: string) => Boolean(role && WOLF_ROLES.has(role));

function addHistory(players: DayResolutionPlayer[], history: DayResolutionStatePatch['eliminatedHistory'], roles: Record<string, string>, uid: string, round: number): void {
  const p = players.find((item) => item.uid === uid);
  if (!p || history.some((h) => h.uid === uid && h.round === round)) return;
  history.push({ uid, name: p.name ?? uid, role: roles[uid] ?? 'Aldeano', round });
}

function kill(players: DayResolutionPlayer[], history: DayResolutionStatePatch['eliminatedHistory'], roles: Record<string, string>, uid: string, round: number): boolean {
  const p = players.find((item) => item.uid === uid);
  if (!p || !p.isAlive) return false;
  p.isAlive = false;
  addHistory(players, history, roles, uid, round);
  return true;
}

function cascadeForDeath(players: DayResolutionPlayer[], history: DayResolutionStatePatch['eliminatedHistory'], roles: Record<string, string>, uid: string, round: number, lovers: [string, string] | null, virginiawoolFate: Record<string, string>): void {
  if (lovers) {
    const partner = uid === lovers[0] ? lovers[1] : uid === lovers[1] ? lovers[0] : null;
    if (partner) kill(players, history, roles, partner, round);
  }
  const twins = players.filter((p) => roles[p.uid] === 'Gemela' || roles[p.uid] === 'Gemelas');
  if (twins.length === 2) {
    const partner = uid === twins[0].uid ? twins[1].uid : uid === twins[1].uid ? twins[0].uid : null;
    if (partner) kill(players, history, roles, partner, round);
  }
  const linked = virginiawoolFate[uid];
  if (linked) kill(players, history, roles, linked, round);
}

/** Pure server-side day resolver. It never trusts a client-computed patch. */
export function resolveDay(input: DayResolutionInput): DayResolutionEngineResult {
  const players = input.players.map((p) => ({ ...p }));
  const roles = { ...input.roles };
  const history = input.eliminatedHistory.map((h) => ({ ...h }));
  const enchanted = [...input.enchanted];
  const fantasmaPending = [...input.fantasmaPending];
  const fantasmaUsed = [...input.fantasmaUsed];
  const aliveBeforeDay = new Set(players.filter((p) => p.isAlive).map((p) => p.uid));
  const round = input.roundNumber;
  const banned = new Set([...input.voteBanned, ...(input.saboteadorBan ? [input.saboteadorBan] : [])]);
  const effectiveVotes: Record<string, string> = {};

  for (const [voter, target] of Object.entries(input.votes)) {
    if (!aliveBeforeDay.has(voter) || !aliveBeforeDay.has(target) || banned.has(voter)) continue;
    effectiveVotes[voter] = target;
  }
  if (input.sirenaLinked) {
    const sirenaUid = players.find((p) => roles[p.uid] === 'Sirena del Río' && p.isAlive)?.uid;
    if (sirenaUid && effectiveVotes[sirenaUid]) effectiveVotes[input.sirenaLinked] = effectiveVotes[sirenaUid];
  }

  const tally: Record<string, number> = {};
  for (const [voter, target] of Object.entries(effectiveVotes)) {
    tally[target] = (tally[target] ?? 0) + (roles[voter] === 'Alcalde' ? 2 : 1);
  }
  if (input.cursed?.uid && (input.cursed.round === round || input.cursed.round === round - 1) && aliveBeforeDay.has(input.cursed.uid)) {
    tally[input.cursed.uid] = (tally[input.cursed.uid] ?? 0) + 1;
  }

  let eliminated: string | null = null;
  let isTie = false;
  if (input.currentEvent?.mechanical === 'inverterVotes' && Object.keys(tally).length) {
    const min = Math.min(...Object.values(tally));
    const mins = Object.entries(tally).filter(([, count]) => count === min);
    if (mins.length === 1) eliminated = mins[0][0]; else isTie = true;
  } else {
    const max = Math.max(0, ...Object.values(tally));
    const maxes = Object.entries(tally).filter(([, count]) => count === max && max > 0);
    if (maxes.length === 1) eliminated = maxes[0][0]; else if (maxes.length > 1) isTie = true;
  }

  let secondEliminated: string | null = null;
  if (input.currentEvent?.mechanical === 'dobleEjecucion' && Object.keys(tally).length >= 2) {
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (sorted[1]?.[1] > 0) secondEliminated = sorted[1][0];
  }
  if (input.noExileActive) { eliminated = null; secondEliminated = null; }

  let chivoPendingChoice: string | null = null;
  if (isTie && !input.noExileActive) {
    const chivo = players.find((p) => p.isAlive && roles[p.uid] === 'Chivo Expiatorio');
    if (chivo) { eliminated = chivo.uid; chivoPendingChoice = chivo.uid; }
  }

  if (input.alborotadoraFight) {
    for (const uid of input.alborotadoraFight) {
      const fighter = players.find((p) => p.uid === uid && p.isAlive);
      if (!fighter) continue;
      if (roles[uid] === 'Príncipe' && !input.principeUsed) continue;
      if (kill(players, history, roles, uid, round) && roles[uid] === 'Fantasma' && !fantasmaUsed.includes(uid)) fantasmaPending.push(uid);
      cascadeForDeath(players, history, roles, uid, round, input.lovers, input.virginiawoolFate);
    }
  }
  if (eliminated && input.alborotadoraFight?.includes(eliminated) && !players.find((p) => p.uid === eliminated)?.isAlive) eliminated = null;

  let princeUsed = input.principeUsed;
  if (eliminated) {
    const victim = players.find((p) => p.uid === eliminated && p.isAlive);
    if (victim && roles[eliminated] === 'Príncipe' && !princeUsed) {
      princeUsed = true;
      eliminated = null;
    } else if (victim) {
      if (roles[eliminated] === 'Antiguo') {
        for (const uid of Object.keys(roles)) if (!isWolf(roles[uid]) && roles[uid] !== 'Aldeano') roles[uid] = 'Aldeano';
      }
      if (kill(players, history, roles, eliminated, round)) {
        if (roles[eliminated] === 'Fantasma' && !fantasmaUsed.includes(eliminated)) fantasmaPending.push(eliminated);
        cascadeForDeath(players, history, roles, eliminated, round, input.lovers, input.virginiawoolFate);
      }
    }
  }

  if (secondEliminated && secondEliminated !== eliminated) {
    if (kill(players, history, roles, secondEliminated, round)) {
      if (roles[secondEliminated] === 'Fantasma' && !fantasmaUsed.includes(secondEliminated)) fantasmaPending.push(secondEliminated);
      cascadeForDeath(players, history, roles, secondEliminated, round, input.lovers, input.virginiawoolFate);
    }
  }

  const newWolfTeam = { ...input.wolfTeam };
  const cambiaformasTargets = { ...input.cambiaformasTargets };
  for (const [uid, mentorUid] of Object.entries(input.salvajeMentors)) {
    const mentor = players.find((p) => p.uid === mentorUid);
    if (mentor && !mentor.isAlive && roles[uid] === 'Niño Salvaje') { roles[uid] = 'Lobo'; newWolfTeam[uid] = true; }
  }
  for (const [uid, targetUid] of Object.entries(cambiaformasTargets)) {
    const changer = players.find((p) => p.uid === uid && p.isAlive);
    const target = players.find((p) => p.uid === targetUid);
    if (changer && target && !target.isAlive && aliveBeforeDay.has(targetUid)) {
      roles[uid] = input.roles[targetUid] ?? 'Aldeano';
      if (isWolf(roles[uid])) newWolfTeam[uid] = true;
      delete cambiaformasTargets[uid];
    }
  }

  const videnteDied = players.some((p) => (roles[p.uid] === 'Vidente' || input.roles[p.uid] === 'Vidente') && !p.isAlive && aliveBeforeDay.has(p.uid));
  if (videnteDied) {
    const apprentice = players.find((p) => roles[p.uid] === 'Aprendiz de Vidente' && p.isAlive);
    if (apprentice) roles[apprentice.uid] = 'Vidente';
  }

  const hunter = players.find((p) => !p.isAlive && aliveBeforeDay.has(p.uid) && roles[p.uid] === 'Cazador');
  const cazadorPendingShot = hunter?.uid ?? null;

  const winResult = checkWinCondition(players, roles, {
    enchanted, round, dayEliminatedUid: eliminated, secondEliminatedUid: secondEliminated,
    eliminatedByVote: true, perroLoboChoices: input.perroLoboChoices,
    cultMembers: input.cultMembers, vampiroKills: input.vampiroKills,
    pescadorBoat: input.pescadorBoat, hadaLinked: input.hadaLinked,
    lovers: input.lovers ?? [],
  });
  let finalWinner = winResult.winner ?? null;
  let finalMsg = winResult.message ?? null;

  for (const [verdugoUid, targetUid] of Object.entries(input.verdugos)) {
    if (eliminated === targetUid && aliveBeforeDay.has(verdugoUid)) {
      finalWinner = 'verdugo';
      finalMsg = '¡El Verdugo consiguió linchar a su objetivo secreto y gana solo!';
      break;
    }
  }
  let bansheePoints = input.bansheePoints;
  if (input.bansheePredictionUid === eliminated) bansheePoints += 1;
  if (bansheePoints >= 2 && players.some((p) => p.isAlive && roles[p.uid] === 'Banshee')) {
    finalWinner = 'banshee';
    finalMsg = '¡La Banshee alcanza 2 predicciones correctas y gana sola!';
  }

  for (const uid of Object.keys(newWolfTeam)) if (!isWolf(roles[uid])) delete newWolfTeam[uid];
  const nextRound = round + 1;
  const nextPhase = finalWinner ? 'ended' : 'night';
  const statePatch: DayResolutionStatePatch = {
    players, roles, eliminatedHistory: history, enchanted,
    cazadorPendingShot: cazadorPendingShot && !finalWinner ? cazadorPendingShot : null,
    chivoPendingChoice: chivoPendingChoice && !finalWinner ? chivoPendingChoice : null,
    voteBanned: [], alquimistaPotion: null, alquimistaRevealUid: null,
    juezUsed: false, alborotadoraFight: null, fantasmaPending: [...new Set(fantasmaPending)],
    silencedPlayers: [], bansheePredictionUid: null, bansheePoints,
    phase: nextPhase, winners: finalWinner, winMessage: finalMsg,
    roundNumber: nextRound, dayVotes: {}, dayEliminatedUid: null,
    seerReveal: null, seerReveal2: null, profetaReveal: null,
    nightActions: {}, nightSubmissions: {}, bearGrowl: false,
    nightStartedAt: finalWinner ? null : input.now, phaseEndsAt: finalWinner ? null : input.now + 60_000,
    currentEvent: null, eclipseActive: false, doubleSeerActive: false,
    anonymousVotesActive: false, noExileActive: false, saboteadorBan: null,
    cambiaformasTargets, wolfTeam: newWolfTeam, revealDeadResult: null,
  };
  return { roundNumber: round, tally, eliminated, secondEliminated, isTie, winner: finalWinner, winMessage: finalMsg, statePatch };
}
