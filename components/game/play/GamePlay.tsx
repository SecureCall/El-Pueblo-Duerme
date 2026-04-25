'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import {
  doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp,
  query, orderBy, limit, setDoc, getDoc, writeBatch,
} from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { assignRoles, checkWinCondition, ROLES, ROLE_SUBMISSION_KEY, drawRandomEvent } from './roles';
import { BOT_VOTE_CONFIG, pickBotVoteTarget, type BotType, FALLBACK_BOT_MESSAGES, BOT_NARRATOR_SPOTLIGHTS } from '@/lib/bots/botSystem';
import { recordVote, recordGameResult } from '@/lib/bots/playerStats';
import { sendPushToMany } from '@/lib/firebase/push';
import { RoleReveal } from './RoleReveal';
import { NightPhase } from './NightPhase';
import { DayPhase } from './DayPhase';
import { EndGame } from './EndGame';
import { NightTransition } from './NightTransition';
import { DayTransition } from './DayTransition';
import { ChaosEventScreen } from './ChaosEventScreen';
import { NarratorBroadcast } from './NarratorBroadcast';
import { useNarrator, NARRATIONS } from '@/hooks/useNarrator';
import { DeathOverlay } from './DeathOverlay';
import { MomentBanner, buildMoment, type Moment } from './MomentBanner';
import { playNightAmbience, playDayAmbience, stopAllAmbience, playDeathSting, playVoteAlarm, playGameStart, playVictory, playDefeat } from '@/lib/gameAudio';

export interface Player {
  uid: string;
  name: string;
  photoURL: string;
  isHost: boolean;
  isAlive: boolean;
  role: string | null;
  isAI?: boolean;
  botType?: BotType;
}

export interface GameState {
  name: string;
  code: string;
  hostUid: string;
  maxPlayers: number;
  wolves: number;
  specialRoles: string[];
  fillWithAI: boolean;
  players: Player[];
  status: string;
  phase: string;
  roles?: Record<string, string>;
  wolfTeam?: Record<string, boolean>;
  roundNumber?: number;
  nightActions?: {
    wolfTarget?: string;
    wolfTarget2?: string;
    seerTarget?: string;
    witchSave?: boolean;
    witchPoison?: string;
    cupidTargets?: string[];
    guardianTarget?: string;
    flautistaTargets?: string[];
    loboBlancoCide?: string;
    perroLoboSide?: 'wolves' | 'village';
    salvajeMentor?: string;
    profetaTarget?: string;
    sacerdoteTarget?: string;
    ladronTarget?: string;
    espiaActivate?: boolean;
    ancianaTarget?: string;
    angelResucitarTarget?: string;
    doctorTarget?: string;
    silenciadoraTarget?: string;
    sirenaTarget?: string;
    virginiawoolTarget?: string;
    vigiaActivate?: boolean;
    bansheePrediction?: string;
    cambiaformasTarget?: string;
    liderCultoTarget?: string;
    pescadorTarget?: string;
    vampiroTarget?: string;
    hadaBuscadoraTarget?: string;
    brujaTarget?: string;
    forenseTarget?: string;
    saboteadorTarget?: string;
  };
  nightSubmissions?: Record<string, boolean>;
  dayVotes?: Record<string, string>;
  dayEliminatedUid?: string | null;
  dayStartedAt?: number;
  dayDuration?: number;
  seerReveal?: { targetUid: string; isWolf: boolean } | null;
  profetaReveal?: { targetUid: string; isWolf: boolean } | null;
  lovers?: [string, string] | null;
  winners?: string | null;
  winMessage?: string;
  eliminatedHistory?: { uid: string; name: string; role: string; round: number }[];
  // Extended game state
  enchanted?: string[];
  guardianLastTarget?: string | null;
  doctorLastTarget?: string | null;
  doctorSelfUsed?: boolean;
  antiguoHit?: string[];
  perroLoboChoices?: Record<string, 'wolves' | 'village'>;
  salvajeMentors?: Record<string, string>;
  bearGrowl?: boolean;
  cazadorPendingShot?: string | null;
  juezUsed?: boolean;
  espiaUsed?: boolean;
  chivoPendingChoice?: string | null;
  voteBanned?: string[];
  alquimistaPotion?: 'save' | 'reveal' | 'nothing' | null;
  alquimistaRevealUid?: string | null;
  // New role fields
  brujaFoundVidente?: boolean;
  brujaProtectedUid?: string | null;
  lobosBlocked?: boolean;
  criaLoboRage?: boolean;
  silencedPlayers?: string[];
  sirenaUid?: string | null;
  sirenaLinked?: string | null;
  vigiaUsed?: boolean;
  vigiaKnowsWolves?: boolean;
  angelResucitadorUsed?: boolean;
  bansheePoints?: number;
  bansheePredictionUid?: string | null;
  cultMembers?: string[];
  vampiroBites?: Record<string, number>;
  vampiroKills?: number;
  pescadorBoat?: string[];
  pescadorUid?: string | null;
  hadaLinked?: boolean;
  verdugos?: Record<string, string>;
  principeUsed?: boolean;
  cambiaformasTargets?: Record<string, string>;
  virginiawoolFate?: Record<string, string>;
  fantasmaPending?: string[];
  fantasmaUsed?: string[];
  alborotadoraFight?: [string, string] | null;
  alborotadoraUsed?: boolean;
  hechiceraLifeUsed?: boolean;
  hechiceraPoisonUsed?: boolean;
  malditoUid?: string | null;
  // New feature fields
  nightStartedAt?: number;
  phaseEndsAt?: number;
  currentEvent?: { id: string; emoji: string; name: string; description: string; mechanical: string } | null;
  eventRound?: number;
  saboteadorBan?: string | null;
  forenseResults?: Record<string, string>;
  iluminadoReveal?: Record<string, string>;
  eclipseActive?: boolean;
  doubleSeerActive?: boolean;
  anonymousVotesActive?: boolean;
  noExileActive?: boolean;
  narratorBroadcast?: { text: string; type: 'warning' | 'suspicion' | 'chaos' | 'irony' | 'accusation'; triggeredAt: number } | null;
  confessionUid?: string | null;
  cursed?: { uid: string; round: number } | null;
  lastXpAwardedAt?: number;
}

// ── Finite-State Machine: only these transitions are legal ────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  lobby:      ['roleReveal'],
  roleReveal: ['night'],
  night:      ['day', 'ended'],
  day:        ['voting', 'night', 'ended'],
  voting:     ['night', 'day', 'ended'],
  ended:      [],
};

function isValidTransition(from: string | undefined, to: string): boolean {
  if (!from) return false;
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export function GamePlay({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleRevealDone, setRoleRevealDone] = useState(false);
  const [showNightReveal, setShowNightReveal] = useState(false);
  const [nightRevealData, setNightRevealData] = useState<{ victimName: string | null; victimRole: string | null; victimUid: string | null }>({ victimName: null, victimRole: null, victimUid: null });
  const [showDayTransition, setShowDayTransition] = useState(false);
  const [dayTransitionData, setDayTransitionData] = useState<{ eliminatedName: string | null; eliminatedRole: string | null; eliminatedUid: string | null }>({ eliminatedName: null, eliminatedRole: null, eliminatedUid: null });
  const [showChaosEvent, setShowChaosEvent] = useState(false);
  const chaosShownForRound = useRef<number>(-1);
  const [fantasmaMsg, setFantasmaMsg] = useState('');
  const [fantasmaTarget, setFantasmaTarget] = useState('');
  const [hostAbsent, setHostAbsent] = useState(false);
  const [votesFromSub, setVotesFromSub] = useState<Record<string, string>>({});
  const [deathQueue, setDeathQueue] = useState<{ uid: string; name: string; role: string }[]>([]);
  const prevElimCount = useRef<number>(0);
  const [currentMoment, setCurrentMoment] = useState<Moment | null>(null);
  const momentQueue = useRef<Moment[]>([]);
  const momentPlaying = useRef(false);

  const triggerMoment = (m: Moment) => {
    momentQueue.current.push(m);
    if (!momentPlaying.current) showNextMoment();
  };
  const showNextMoment = () => {
    if (!momentQueue.current.length) { momentPlaying.current = false; return; }
    momentPlaying.current = true;
    setCurrentMoment(momentQueue.current.shift()!);
  };
  const aiChatSentRound = useRef<number>(-1);
  const aiNightSubmittedRound = useRef<number>(-1);
  const aiDayVotedRound = useRef<number>(-1);
  const wolfChatLastProcessed = useRef<string>('');
  const prevPhase = useRef<string | null>(null);
  const processingDayRef = useRef(false);
  const narratorInterruptAt = useRef<number>(0);
  const narratorInterruptRound = useRef<number>(-1);
  const processingNightRef = useRef(false);
  const nightStartedAtRef = useRef<number>(0);
  const { play, playSequence, interruptWith, AUDIO_FILES } = useNarrator();

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'games', gameId),
      (snap: any) => {
        if (!snap.exists()) { router.push('/'); return; }
        setGame(snap.data() as GameState);
        setLoading(false);
      },
      (_err: any) => { router.push('/'); }
    );
    return () => { unsub(); stopAllAmbience(); };
  }, [gameId, router]);

  useEffect(() => {
    if (!game) return;
    const phase = game.phase;

    if (prevPhase.current === null && phase === 'roleReveal') {
      play(AUDIO_FILES.introEpic);
      playGameStart();
    }
    if (prevPhase.current === 'roleReveal' && phase === 'night') {
      interruptWith(AUDIO_FILES.gameStart, AUDIO_FILES.nightStart);
      playNightAmbience();
    }
    if (prevPhase.current === 'night' && phase === 'day') {
      processingNightRef.current = false;
      stopAllAmbience();
      const victimUid = (game as any).dayEliminatedUid ?? null;
      const victim = victimUid ? (game.players ?? []).find((p: any) => p.uid === victimUid) : null;
      const victimRole = victim ? (game.roles?.[victim.uid] ?? null) : null;
      if (victim) {
        playDeathSting();
        setDeathQueue([{ uid: victim.uid, name: victim.name, role: victimRole ?? '???' }]);
      }
      setNightRevealData({ victimName: victim?.name ?? null, victimRole, victimUid });
      setShowNightReveal(true);
      setTimeout(() => playDayAmbience(), 3500);
      const round = game.roundNumber ?? 1;
      if (game.currentEvent && chaosShownForRound.current !== round) {
        chaosShownForRound.current = round;
        setShowChaosEvent(true);
      }
    }
    if (prevPhase.current === 'day' && phase === 'voting') {
      playVoteAlarm();
    }
    if (prevPhase.current === 'day' && phase === 'night') {
      processingDayRef.current = false;
      stopAllAmbience();
      const history = game.eliminatedHistory ?? [];
      const lastElim = history[history.length - 1];
      if (lastElim) {
        playDeathSting();
        setDeathQueue([{ uid: lastElim.uid ?? '', name: lastElim.name ?? '???', role: lastElim.role ?? '???' }]);
      }
      const elimUid = lastElim?.uid ?? (lastElim ? (game.players ?? []).find((p: any) => p.name === lastElim.name)?.uid ?? null : null);
      setDayTransitionData({ eliminatedName: lastElim?.name ?? null, eliminatedRole: lastElim?.role ?? null, eliminatedUid: elimUid });
      setShowDayTransition(true);
      setTimeout(() => playNightAmbience(), 3500);
    }
    if (phase === 'ended') {
      stopAllAmbience();
      const myUid = user?.uid;
      const iWon = myUid && (game.winners ?? []).includes(myUid);
      setTimeout(() => { if (iWon) playVictory(); else playDefeat(); }, 800);
    }
    if (prevPhase.current === 'roleReveal' && phase === 'night') {
      nightStartedAtRef.current = Date.now();
    }
    prevPhase.current = phase ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber]);

  // ── Heartbeat during game: write to /presence/{uid} every 60s ────────────
  useEffect(() => {
    if (!user || !gameId) return;
    const writePresence = () => {
      setDoc(doc(db, 'presence', user.uid), { uid: user.uid, gameId, lastSeen: Date.now() }, { merge: true }).catch(() => {});
    };
    writePresence();
    const id = setInterval(writePresence, 60000);
    return () => clearInterval(id);
  }, [user?.uid, gameId]);

  // ── Subscribe to votes subcollection during day phase ────────────────────
  useEffect(() => {
    if (!game || game.phase !== 'day') { setVotesFromSub({}); return; }
    const round = game.roundNumber ?? 1;
    const unsub = onSnapshot(collection(db, 'games', gameId, 'votes'), (snap) => {
      const v: Record<string, string> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.round === round && data.target) v[d.id] = data.target;
      });
      setVotesFromSub(v);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, gameId]);

  // ── Host absence detection: check /presence every 30s, auto-claim after 5min ─
  useEffect(() => {
    if (!game || !user) return;
    if (game.hostUid === user.uid) { setHostAbsent(false); return; }
    if (game.phase === 'ended' || game.phase === 'lobby' || !game.phase) return;

    const HOST_ABSENT_MS = 90 * 1000;
    const check = async () => {
      try {
        const presSnap = await getDoc(doc(db, 'presence', game.hostUid));
        const lastSeen: number = presSnap.exists() ? (presSnap.data().lastSeen ?? 0) : 0;
        const gone = !lastSeen || Date.now() - lastSeen > HOST_ABSENT_MS;
        setHostAbsent(gone);
        if (!gone) return;

        // Only the lexicographically first alive non-host player auto-claims
        const me = (game.players ?? []).find(p => p.uid === user.uid);
        if (!me?.isAlive) return;
        const candidates = (game.players ?? []).filter(p => p.isAlive && p.uid !== game.hostUid);
        if (!candidates.length) return;
        candidates.sort((a, b) => a.uid.localeCompare(b.uid));
        if (candidates[0].uid !== user.uid) return;

        console.warn('[Host absent] Auto-claiming host after 5min absence');
        const newPlayers = (game.players ?? []).map(p => ({ ...p, isHost: p.uid === user.uid }));
        await updateDoc(doc(db, 'games', gameId), { hostUid: user.uid, players: newPlayers });
      } catch { /* ignore */ }
    };

    const id = setInterval(check, 30000);
    check();
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.hostUid, game?.phase, user?.uid]);

  // Host assigns roles on game start
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.roles && Object.keys(game.roles).length > 0) return;
    if (game.status !== 'playing') return;

    const assigned = assignRoles(game.players, game.wolves, game.specialRoles ?? []);
    const updatedPlayers = game.players.map(p => ({ ...p, role: assigned[p.uid] ?? 'Aldeano' }));

    // Assign secret targets for Verdugos
    const verdugos: Record<string, string> = {};
    const malditoUid: string | null = game.players.find(p => assigned[p.uid] === 'Maldito')?.uid ?? null;
    for (const [uid, role] of Object.entries(assigned)) {
      if (role === 'Verdugo') {
        const others = game.players.filter(p => p.uid !== uid);
        const target = others[Math.floor(Math.random() * others.length)];
        if (target) verdugos[uid] = target.uid;
      }
    }
    const pescUid = game.players.find(p => assigned[p.uid] === 'Pescador')?.uid ?? null;

    // Iluminado: reveal one wolf to the Iluminado player
    const iluminadoReveal: Record<string, string> = {};
    for (const [uid, role] of Object.entries(assigned)) {
      if (role === 'Iluminado') {
        const wolves = game.players.filter(p => assigned[p.uid] === 'Lobo' || assigned[p.uid] === 'Lobo Blanco' || assigned[p.uid] === 'Cría de Lobo');
        if (wolves.length > 0) iluminadoReveal[uid] = wolves[Math.floor(Math.random() * wolves.length)].uid;
      }
    }

    // Build wolfTeam map (uid → true) for Firestore rule enforcement on wolfChat
    const wolfTeam: Record<string, boolean> = {};
    for (const [uid, role] of Object.entries(assigned)) {
      if (['Lobo', 'Lobo Blanco', 'Cría de Lobo', 'Bruja', 'Lobo Bruja'].includes(role)) {
        wolfTeam[uid] = true;
      }
    }

    // Write each player's role to a private subcollection (only readable by that player + host)
    // Fire-and-forget — runs concurrently with the main updateDoc below
    Promise.all(
      Object.entries(assigned).map(([uid, role]) =>
        setDoc(doc(db, 'games', gameId, 'playerRoles', uid), { role, assignedAt: Date.now() })
      )
    ).catch(() => {});

    updateDoc(doc(db, 'games', gameId), {
      roles: assigned,
      wolfTeam,
      players: updatedPlayers,
      phase: 'roleReveal',
      roundNumber: 1,
      nightActions: {},
      nightSubmissions: {},
      dayVotes: {},
      dayEliminatedUid: null,
      seerReveal: null,
      profetaReveal: null,
      lovers: null,
      winners: null,
      eliminatedHistory: [],
      enchanted: [],
      guardianLastTarget: null,
      doctorLastTarget: null,
      doctorSelfUsed: false,
      antiguoHit: [],
      perroLoboChoices: {},
      salvajeMentors: {},
      brujaFoundVidente: false,
      brujaProtectedUid: null,
      lobosBlocked: false,
      criaLoboRage: false,
      silencedPlayers: [],
      sirenaUid: null,
      sirenaLinked: null,
      vigiaUsed: false,
      vigiaKnowsWolves: false,
      angelResucitadorUsed: false,
      bansheePoints: 0,
      bansheePredictionUid: null,
      cultMembers: [],
      vampiroBites: {},
      vampiroKills: 0,
      pescadorBoat: [],
      pescadorUid: pescUid,
      hadaLinked: false,
      verdugos,
      principeUsed: false,
      cambiaformasTargets: {},
      virginiawoolFate: {},
      fantasmaPending: [],
      fantasmaUsed: [],
      alborotadoraFight: null,
      alborotadoraUsed: false,
      hechiceraLifeUsed: false,
      hechiceraPoisonUsed: false,
      malditoUid,
      iluminadoReveal,
      forenseResults: {},
      saboteadorBan: null,
      currentEvent: null,
      eventRound: 0,
      eclipseActive: false,
      doubleSeerActive: false,
      anonymousVotesActive: false,
      noExileActive: false,
    }).catch((e: any) => console.error('assignRoles error:', e));
  }, [game, user, gameId]);

  const advanceFromRoleReveal = useCallback(async () => {
    if (!game) return;
    setRoleRevealDone(true);
    if (game.hostUid !== user?.uid) return;
    if (!isValidTransition(game.phase, 'night')) { console.warn(`[FSM] Blocked roleReveal→night (current: ${game.phase})`); return; }
    try {
      const now = Date.now();
      await updateDoc(doc(db, 'games', gameId), { phase: 'night', nightActions: {}, nightSubmissions: {}, nightStartedAt: now, phaseEndsAt: now + 93000 });
    } catch (e) { console.error('advanceFromRoleReveal error:', e); }
  }, [game, user, gameId]);

  const submitNightAction = useCallback(async (action: Record<string, unknown>) => {
    if (!game || !user) return;
    if (game.phase !== 'night') { console.warn('[FSM] submitNightAction rejected — not night phase'); return; }
    const me = game.players?.find(p => p.uid === user.uid);
    if (!me?.isAlive) { console.warn('[FSM] submitNightAction rejected — player not alive'); return; }
    const myRole = game.roles?.[user.uid] ?? 'Aldeano';
    const submissionKey = ROLE_SUBMISSION_KEY[myRole] ?? user.uid;

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(action)) {
      if (k !== '_skip') updates[`nightActions.${k}`] = v;
    }
    updates[`nightSubmissions.${submissionKey}`] = true;

    if (myRole === 'Lobo Blanco' && (game.roundNumber ?? 1) % 2 === 0) {
      updates[`nightSubmissions.loboblanco`] = true;
    }

    try { await updateDoc(doc(db, 'games', gameId), updates); }
    catch (e) { console.error('submitNightAction error:', e); }
  }, [game, user, gameId]);

  // Host auto-submits AI players' night actions
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'night') return;

    const round = game.roundNumber ?? 1;
    if (aiNightSubmittedRound.current === round) return;

    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const aiPlayers = alivePlayers.filter(p => p.isAI);
    if (aiPlayers.length === 0) return;

    const MIN_NIGHT_DELAY = 10000;
    const elapsed = Date.now() - nightStartedAtRef.current;
    const waitMs = Math.max(500, MIN_NIGHT_DELAY - elapsed);

    const nightTimer = setTimeout(() => {
      if (aiNightSubmittedRound.current === round) return;
      aiNightSubmittedRound.current = round;

      const roles = game.roles ?? {};
      const subs = game.nightSubmissions ?? {};
      const updates: Record<string, unknown> = {};
      let needsUpdate = false;

      const randAlive = (exclude: string[] = []) => {
        const cands = alivePlayers.filter(p => !exclude.includes(p.uid));
        return cands.length > 0 ? cands[Math.floor(Math.random() * cands.length)] : null;
      };

      // AI Wolves
      const aiWolves = aiPlayers.filter(p => roles[p.uid] === 'Lobo' || roles[p.uid] === 'Lobo Blanco' || roles[p.uid] === 'Cría de Lobo');
      const humanWolves = alivePlayers.filter(p => !p.isAI && (roles[p.uid] === 'Lobo' || roles[p.uid] === 'Lobo Blanco' || roles[p.uid] === 'Cría de Lobo'));
      if (aiWolves.length > 0 && !subs['wolves'] && !game.lobosBlocked) {
        const notWolf = alivePlayers.filter(p => roles[p.uid] !== 'Lobo' && roles[p.uid] !== 'Lobo Blanco' && roles[p.uid] !== 'Cría de Lobo' && roles[p.uid] !== 'Bruja' && p.uid !== game.brujaProtectedUid);
        const humanTargets = notWolf.filter(p => !p.isAI);
        const pool = humanTargets.length > 0 ? humanTargets : notWolf;
        const target = pool[Math.floor(Math.random() * pool.length)] ?? null;
        if (target) updates['nightActions.wolfTarget'] = target.uid;
        if (game.criaLoboRage) {
          const target2 = notWolf.filter(p => p.uid !== target?.uid)[0];
          if (target2) updates['nightActions.wolfTarget2'] = target2.uid;
        }
        if (humanWolves.length === 0) updates['nightSubmissions.wolves'] = true;
        needsUpdate = true;
      } else if (aiWolves.length > 0 && !subs['wolves'] && game.lobosBlocked) {
        if (humanWolves.length === 0) updates['nightSubmissions.wolves'] = true;
        needsUpdate = true;
      }

      // AI Lobo Blanco special kill
      const aiLoboBlanco = aiPlayers.find(p => roles[p.uid] === 'Lobo Blanco');
      const humanLoboBlanco = alivePlayers.find(p => !p.isAI && roles[p.uid] === 'Lobo Blanco');
      if (aiLoboBlanco && round % 2 === 0 && !subs['loboblanco'] && !humanLoboBlanco) {
        updates['nightSubmissions.loboblanco'] = true; needsUpdate = true;
      }

      // AI Vidente
      const aiSeer = aiPlayers.find(p => roles[p.uid] === 'Vidente');
      if (aiSeer && !subs['vidente']) { updates['nightSubmissions.vidente'] = true; needsUpdate = true; }

      // AI Profeta
      const aiProfeta = aiPlayers.find(p => roles[p.uid] === 'Profeta');
      if (aiProfeta && !subs['profeta']) { updates['nightSubmissions.profeta'] = true; needsUpdate = true; }

      // AI Hechicera (old Bruja)
      const aiHechicera = aiPlayers.find(p => roles[p.uid] === 'Hechicera');
      if (aiHechicera && !subs['hechicera']) { updates['nightSubmissions.hechicera'] = true; needsUpdate = true; }

      // AI Bruja (wolf team - find Vidente)
      const aiBruja = aiPlayers.find(p => roles[p.uid] === 'Bruja');
      if (aiBruja && !subs['bruja']) {
        const pick = randAlive([aiBruja.uid]);
        if (pick) updates['nightActions.brujaTarget'] = pick.uid;
        updates['nightSubmissions.bruja'] = true; needsUpdate = true;
      }

      // AI Cupido
      const aiCupido = aiPlayers.find(p => roles[p.uid] === 'Cupido');
      if (aiCupido && !subs['cupido'] && round === 1) {
        const cands = alivePlayers.filter(p => !p.isAI).slice(0, 2);
        if (cands.length >= 2) updates['nightActions.cupidTargets'] = [cands[0].uid, cands[1].uid];
        updates['nightSubmissions.cupido'] = true; needsUpdate = true;
      }

      // AI Guardián
      const aiGuardian = aiPlayers.find(p => roles[p.uid] === 'Guardián');
      if (aiGuardian && !subs['guardian']) {
        const cands = alivePlayers.filter(p => p.uid !== (game.guardianLastTarget ?? ''));
        const pick = cands[Math.floor(Math.random() * cands.length)];
        if (pick) updates['nightActions.guardianTarget'] = pick.uid;
        updates['nightSubmissions.guardian'] = true; needsUpdate = true;
      }

      // AI Doctor
      const aiDoctor = aiPlayers.find(p => roles[p.uid] === 'Doctor');
      if (aiDoctor && !subs['doctor']) {
        const cands = alivePlayers.filter(p => p.uid !== (game.doctorLastTarget ?? ''));
        const pick = cands[Math.floor(Math.random() * cands.length)];
        if (pick) updates['nightActions.doctorTarget'] = pick.uid;
        updates['nightSubmissions.doctor'] = true; needsUpdate = true;
      }

      // AI Flautista
      const aiFlautista = aiPlayers.find(p => roles[p.uid] === 'Flautista');
      if (aiFlautista && !subs['flautista']) {
        const cands = alivePlayers.filter(p => p.uid !== aiFlautista.uid && !(game.enchanted ?? []).includes(p.uid));
        const picks = cands.sort(() => Math.random() - 0.5).slice(0, 2).map(p => p.uid);
        if (picks.length) updates['nightActions.flautistaTargets'] = picks;
        updates['nightSubmissions.flautista'] = true; needsUpdate = true;
      }

      // AI Perro Lobo
      const aiPerroLobo = aiPlayers.find(p => roles[p.uid] === 'Perro Lobo');
      if (aiPerroLobo && !subs['perrolo'] && round === 1) {
        const choice = Math.random() > 0.5 ? 'wolves' : 'village';
        updates['nightActions.perroLoboSide'] = choice;
        updates[`perroLoboChoices.${aiPerroLobo.uid}`] = choice;
        updates['nightSubmissions.perrolo'] = true; needsUpdate = true;
      }

      // AI Niño Salvaje
      const aiSalvaje = aiPlayers.find(p => roles[p.uid] === 'Niño Salvaje');
      if (aiSalvaje && !subs['salvaje'] && round === 1) {
        const cands = alivePlayers.filter(p => p.uid !== aiSalvaje.uid);
        const mentor = cands[Math.floor(Math.random() * cands.length)];
        if (mentor) {
          updates['nightActions.salvajeMentor'] = mentor.uid;
          updates[`salvajeMentors.${aiSalvaje.uid}`] = mentor.uid;
        }
        updates['nightSubmissions.salvaje'] = true; needsUpdate = true;
      }

      // AI Sacerdote
      const aiSacerdote = aiPlayers.find(p => roles[p.uid] === 'Sacerdote');
      if (aiSacerdote && !subs['sacerdote']) {
        const cands = alivePlayers.filter(p => p.uid !== aiSacerdote.uid);
        const pick = cands[Math.floor(Math.random() * cands.length)];
        if (pick) updates['nightActions.sacerdoteTarget'] = pick.uid;
        updates['nightSubmissions.sacerdote'] = true; needsUpdate = true;
      }

      // AI Espía (skip)
      const aiEspia = aiPlayers.find(p => roles[p.uid] === 'Espía');
      if (aiEspia && !subs['espia']) { updates['nightSubmissions.espia'] = true; needsUpdate = true; }

      // AI Ladrón
      const aiLadron = aiPlayers.find(p => roles[p.uid] === 'Ladrón');
      if (aiLadron && !subs['ladron'] && round === 1) {
        const cands = alivePlayers.filter(p => p.uid !== aiLadron.uid && roles[p.uid] !== 'Lobo' && roles[p.uid] !== 'Lobo Blanco');
        const pick = cands[Math.floor(Math.random() * cands.length)];
        if (pick) updates['nightActions.ladronTarget'] = pick.uid;
        updates['nightSubmissions.ladron'] = true; needsUpdate = true;
      }

      // AI Anciana Líder
      const aiAnciana = aiPlayers.find(p => roles[p.uid] === 'Anciana Líder');
      if (aiAnciana && !subs['anciana']) {
        const pick = randAlive([aiAnciana.uid]);
        if (pick) updates['nightActions.ancianaTarget'] = pick.uid;
        updates['nightSubmissions.anciana'] = true; needsUpdate = true;
      }

      // AI Ángel Resucitador
      const aiAngel = aiPlayers.find(p => roles[p.uid] === 'Ángel Resucitador');
      if (aiAngel && !subs['angelresucitador'] && !game.angelResucitadorUsed) {
        const dead = (game.players ?? []).filter(p => !p.isAlive);
        if (dead.length > 0 && Math.random() < 0.3) {
          const pick = dead[Math.floor(Math.random() * dead.length)];
          updates['nightActions.angelResucitarTarget'] = pick.uid;
        }
        updates['nightSubmissions.angelresucitador'] = true; needsUpdate = true;
      } else if (aiAngel && !subs['angelresucitador'] && game.angelResucitadorUsed) {
        updates['nightSubmissions.angelresucitador'] = true; needsUpdate = true;
      }

      // AI Silenciadora
      const aiSilenciadora = aiPlayers.find(p => roles[p.uid] === 'Silenciadora');
      if (aiSilenciadora && !subs['silenciadora']) {
        const pick = randAlive([aiSilenciadora.uid]);
        if (pick) updates['nightActions.silenciadoraTarget'] = pick.uid;
        updates['nightSubmissions.silenciadora'] = true; needsUpdate = true;
      }

      // AI Sirena del Río
      const aiSirena = aiPlayers.find(p => roles[p.uid] === 'Sirena del Río');
      if (aiSirena && !subs['sirena'] && round === 1) {
        const pick = randAlive([aiSirena.uid]);
        if (pick) updates['nightActions.sirenaTarget'] = pick.uid;
        updates['nightSubmissions.sirena'] = true; needsUpdate = true;
      }

      // AI Virginia Woolf
      const aiVirginia = aiPlayers.find(p => roles[p.uid] === 'Virginia Woolf');
      if (aiVirginia && !subs['virginiawoolf'] && round === 1) {
        const pick = randAlive([aiVirginia.uid]);
        if (pick) updates['nightActions.virginiawoolTarget'] = pick.uid;
        updates['nightSubmissions.virginiawoolf'] = true; needsUpdate = true;
      }

      // AI Vigía (pass - AI never activates)
      const aiVigia = aiPlayers.find(p => roles[p.uid] === 'Vigía');
      if (aiVigia && !subs['vigia'] && !game.vigiaUsed) {
        updates['nightSubmissions.vigia'] = true; needsUpdate = true;
      }

      // AI Banshee (random prediction)
      const aiBanshee = aiPlayers.find(p => roles[p.uid] === 'Banshee');
      if (aiBanshee && !subs['banshee']) {
        const pick = randAlive([aiBanshee.uid]);
        if (pick) updates['nightActions.bansheePrediction'] = pick.uid;
        updates['nightSubmissions.banshee'] = true; needsUpdate = true;
      }

      // AI Cambiaformas
      const aiCambiaformas = aiPlayers.find(p => roles[p.uid] === 'Cambiaformas');
      if (aiCambiaformas && !subs['cambiaformas'] && round === 1) {
        const pick = randAlive([aiCambiaformas.uid]);
        if (pick) updates['nightActions.cambiaformasTarget'] = pick.uid;
        updates['nightSubmissions.cambiaformas'] = true; needsUpdate = true;
      }

      // AI Líder del Culto
      const aiLiderCulto = aiPlayers.find(p => roles[p.uid] === 'Líder del Culto');
      if (aiLiderCulto && !subs['liderculto']) {
        const cands = alivePlayers.filter(p => p.uid !== aiLiderCulto.uid && !(game.cultMembers ?? []).includes(p.uid));
        const pick = cands[Math.floor(Math.random() * cands.length)];
        if (pick) updates['nightActions.liderCultoTarget'] = pick.uid;
        updates['nightSubmissions.liderculto'] = true; needsUpdate = true;
      }

      // AI Pescador
      const aiPescador = aiPlayers.find(p => roles[p.uid] === 'Pescador');
      if (aiPescador && !subs['pescador']) {
        const cands = alivePlayers.filter(p => p.uid !== aiPescador.uid && !(game.pescadorBoat ?? []).includes(p.uid));
        const pick = cands[Math.floor(Math.random() * cands.length)];
        if (pick) updates['nightActions.pescadorTarget'] = pick.uid;
        updates['nightSubmissions.pescador'] = true; needsUpdate = true;
      }

      // AI Vampiro
      const aiVampiro = aiPlayers.find(p => roles[p.uid] === 'Vampiro');
      if (aiVampiro && !subs['vampiro']) {
        const pick = randAlive([aiVampiro.uid]);
        if (pick) updates['nightActions.vampiroTarget'] = pick.uid;
        updates['nightSubmissions.vampiro'] = true; needsUpdate = true;
      }

      // AI Hada Buscadora
      const aiHadaBuscadora = aiPlayers.find(p => roles[p.uid] === 'Hada Buscadora');
      if (aiHadaBuscadora && !subs['hadabuscadora'] && !game.hadaLinked) {
        const pick = randAlive([aiHadaBuscadora.uid]);
        if (pick) updates['nightActions.hadaBuscadoraTarget'] = pick.uid;
        updates['nightSubmissions.hadabuscadora'] = true; needsUpdate = true;
      } else if (aiHadaBuscadora && !subs['hadabuscadora'] && game.hadaLinked) {
        updates['nightSubmissions.hadabuscadora'] = true; needsUpdate = true;
      }

      // AI Médico Forense
      const aiForense = aiPlayers.find(p => roles[p.uid] === 'Médico Forense');
      if (aiForense && !subs['forense']) {
        const dead = (game.players ?? []).filter(p => !p.isAlive);
        if (dead.length > 0) {
          const pick = dead[Math.floor(Math.random() * dead.length)];
          updates['nightActions.forenseTarget'] = pick.uid;
        }
        updates['nightSubmissions.forense'] = true; needsUpdate = true;
      }

      // AI Saboteador
      const aiSaboteador = aiPlayers.find(p => roles[p.uid] === 'Saboteador');
      if (aiSaboteador && !subs['saboteador']) {
        const pick = randAlive([aiSaboteador.uid]);
        if (pick) updates['nightActions.saboteadorTarget'] = pick.uid;
        updates['nightSubmissions.saboteador'] = true; needsUpdate = true;
      }

      if (needsUpdate) {
        updateDoc(doc(db, 'games', gameId), updates).catch((e: any) => console.error('AI auto-submit error:', e));
      }
    }, waitMs);

    return () => clearTimeout(nightTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber]);

  // Host listens to wolf chat — AI wolves reply and auto-confirm kill target
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'night') return;

    const roles = game.roles ?? {};
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const humanWolves = alivePlayers.filter(p => !p.isAI && (roles[p.uid] === 'Lobo' || roles[p.uid] === 'Lobo Blanco' || roles[p.uid] === 'Cría de Lobo' || roles[p.uid] === 'Bruja'));
    const aiWolves = alivePlayers.filter(p => p.isAI && (roles[p.uid] === 'Lobo' || roles[p.uid] === 'Lobo Blanco' || roles[p.uid] === 'Cría de Lobo' || roles[p.uid] === 'Bruja'));

    if (humanWolves.length === 0 || aiWolves.length === 0) return;

    const q = query(collection(db, 'games', gameId, 'wolfChat'), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, async (snap: any) => {
      if (snap.empty) return;
      const latestDoc = snap.docs[0];
      const latestId = latestDoc.id;
      if (wolfChatLastProcessed.current === latestId) return;

      const latestMsg = latestDoc.data();
      const isFromHuman = humanWolves.some(p => p.uid === latestMsg.senderId || p.name === latestMsg.name);
      if (!isFromHuman) return;

      wolfChatLastProcessed.current = latestId;

      try {
        const res = await fetch('/api/wolf-agree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            humanMessage: latestMsg.text,
            humanName: latestMsg.name ?? latestMsg.senderName ?? '',
            aiWolves: aiWolves.map(p => ({ uid: p.uid, name: p.name })),
            alivePlayers: alivePlayers.filter(p => humanWolves.every(h => h.uid !== p.uid) || true).map(p => ({ uid: p.uid, name: p.name })),
          }),
        });
        const data: { messages?: { uid: string; name: string; text: string }[]; targetUid?: string | null } = await res.json();

        const msgs = data.messages ?? [];
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i];
          await new Promise(r => setTimeout(r, 1500 + i * (1000 + Math.random() * 2000)));
          addDoc(collection(db, 'games', gameId, 'wolfChat'), {
            senderId: m.uid, senderName: m.name, name: m.name, text: m.text, createdAt: serverTimestamp(),
          }).catch(() => {});
        }

        if (data.targetUid) {
          const updates: Record<string, unknown> = { 'nightActions.wolfTarget': data.targetUid };
          const subs = game.nightSubmissions ?? {};
          if (!subs['wolves']) updates['nightSubmissions.wolves'] = true;
          updateDoc(doc(db, 'games', gameId), updates).catch(() => {});
        }
      } catch (e) {
        console.error('wolf-agree fetch error:', e);
      }
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, gameId]);

  // Host processes night when all required submissions received
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'night') return;

    const subs = game.nightSubmissions ?? {};
    const roles = game.roles ?? {};
    const activePlayers = (game.players ?? []).filter(p => p.isAlive);
    const round = game.roundNumber ?? 1;

    const has = (roleKey: string, condition = true) =>
      condition && activePlayers.some(p => roles[p.uid] === roleKey);

    const done = (subKey: string, hasRole: boolean) => !hasRole || !!subs[subKey];

    const hasWolves = activePlayers.some(p => roles[p.uid] === 'Lobo' || roles[p.uid] === 'Lobo Blanco' || roles[p.uid] === 'Cría de Lobo');
    const wolfDone = !hasWolves || !!subs['wolves'];
    const loboblancoDone = !has('Lobo Blanco') || round % 2 !== 0 || !!subs['loboblanco'];

    const allDone = wolfDone &&
      loboblancoDone &&
      done('vidente', has('Vidente')) &&
      done('hechicera', has('Hechicera')) &&
      done('bruja', has('Bruja')) &&
      done('cupido', has('Cupido', round === 1)) &&
      done('guardian', has('Guardián')) &&
      done('doctor', has('Doctor')) &&
      done('flautista', has('Flautista')) &&
      done('perrolo', has('Perro Lobo', round === 1)) &&
      done('salvaje', has('Niño Salvaje', round === 1)) &&
      done('profeta', has('Profeta')) &&
      done('sacerdote', has('Sacerdote')) &&
      done('ladron', has('Ladrón', round === 1)) &&
      done('espia', has('Espía')) &&
      done('anciana', has('Anciana Líder')) &&
      done('angelresucitador', has('Ángel Resucitador') && !game.angelResucitadorUsed) &&
      done('silenciadora', has('Silenciadora')) &&
      done('sirena', has('Sirena del Río', round === 1)) &&
      done('virginiawoolf', has('Virginia Woolf', round === 1)) &&
      done('vigia', has('Vigía') && !game.vigiaUsed) &&
      done('banshee', has('Banshee')) &&
      done('cambiaformas', has('Cambiaformas', round === 1)) &&
      done('liderculto', has('Líder del Culto')) &&
      done('pescador', has('Pescador')) &&
      done('vampiro', has('Vampiro')) &&
      done('hadabuscadora', has('Hada Buscadora') && !game.hadaLinked) &&
      done('forense', has('Médico Forense')) &&
      done('saboteador', has('Saboteador'));

    if (allDone && !processingNightRef.current) {
      // Mínimo 45s de noche para que los lobos puedan coordinarse
      const MIN_NIGHT_MS = 45000;
      const elapsed = Date.now() - (game.nightStartedAt ?? Date.now());
      const waitMs = Math.max(0, MIN_NIGHT_MS - elapsed);
      if (waitMs > 0) {
        const t = setTimeout(() => {
          if (processingNightRef.current) return;
          processingNightRef.current = true;
          processNight();
        }, waitMs);
        return () => clearTimeout(t);
      }
      processingNightRef.current = true;
      processNight();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.nightSubmissions, game?.phase]);

  // ── Anti-softlock: force processNight when 90s night timer expires ────────
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'night') return;
    const NIGHT_MS = 93000; // 90s night + 3s grace
    const started = game.nightStartedAt ?? Date.now();
    const remaining = Math.max(0, NIGHT_MS - (Date.now() - started));
    const t = setTimeout(() => {
      if (game.phase !== 'night' || processingNightRef.current) return;
      console.warn('[Anti-softlock] Night timer expired → forcing processNight');
      processingNightRef.current = true;
      processNight();
    }, remaining);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, game?.nightStartedAt]);

  async function processNight() {
    if (!game) return;
    if (game.phase !== 'night') { processingNightRef.current = false; return; }
    const rawActions = game.nightActions ?? {};
    const roles = game.roles ?? {};
    let players = [...(game.players ?? [])];
    const aliveBeforeNight = new Set(players.filter(p => p.isAlive).map(p => p.uid));

    // ── STEP 0 — Validation: strip actions from dead players ─────────────
    // Roles whose actions are keyed by UID (nightActions.{uid} style) are
    // filtered here; shared keys (wolfTarget, seerTarget, etc.) are kept as-is
    // since they're set by the host/AI on behalf of living role-holders.
    const actions = { ...rawActions };

    // ── Anciana Líder exile — compute first so every step below can check ─
    const ancianaExiledUid = actions.ancianaTarget ?? null;
    // A set for O(1) blocked lookups
    const blockedByAnciana = new Set<string>(ancianaExiledUid ? [ancianaExiledUid] : []);
    let history = [...(game.eliminatedHistory ?? [])];
    const round = game.roundNumber ?? 1;
    let enchanted = [...(game.enchanted ?? [])];
    const antiguoHit = [...(game.antiguoHit ?? [])];
    const perroLoboChoices = { ...(game.perroLoboChoices ?? {}) };
    let salvajeMentors = { ...(game.salvajeMentors ?? {}) };
    let newRoles = { ...roles };
    const verdugos = { ...(game.verdugos ?? {}) };
    const cambiaformasTargets = { ...(game.cambiaformasTargets ?? {}) };
    const virginiawoolFate = { ...(game.virginiawoolFate ?? {}) };
    let cultMembers = [...(game.cultMembers ?? [])];
    let vampiroBites = { ...(game.vampiroBites ?? {}) };
    let vampiroKills = game.vampiroKills ?? 0;
    let pescadorBoat = [...(game.pescadorBoat ?? [])];
    let fantasmaPending = [...(game.fantasmaPending ?? [])];
    let fantasmaUsed = [...(game.fantasmaUsed ?? [])];
    let bansheePoints = game.bansheePoints ?? 0;
    let hadaLinked = game.hadaLinked ?? false;
    let brujaFoundVidente = game.brujaFoundVidente ?? false;
    let brujaProtectedUid = game.brujaProtectedUid ?? null;
    let lobosBlocked = false; // reset each night
    let vigiaUsed = game.vigiaUsed ?? false;
    let vigiaKnowsWolves = game.vigiaKnowsWolves ?? false;
    let angelResucitadorUsed = game.angelResucitadorUsed ?? false;
    let silencedPlayers: string[] = [];
    let sirenaUid = game.sirenaUid ?? null;
    let sirenaLinked = game.sirenaLinked ?? null;
    let hechiceraLifeUsed = game.hechiceraLifeUsed ?? false;
    let hechiceraPoisonUsed = game.hechiceraPoisonUsed ?? false;
    let criaLoboRage = false; // reset each night
    const malditoUid = game.malditoUid ?? null;

    // ── Night 1 first-time setups ──────────────────────────────────────────

    // Perro Lobo chooses side
    if (actions.perroLoboSide) {
      const pl = players.find(p => roles[p.uid] === 'Perro Lobo');
      if (pl) {
        perroLoboChoices[pl.uid] = actions.perroLoboSide;
        if (actions.perroLoboSide === 'wolves') newRoles[pl.uid] = 'Lobo';
      }
    }

    // Niño Salvaje picks mentor
    if (actions.salvajeMentor) {
      const s = players.find(p => roles[p.uid] === 'Niño Salvaje');
      if (s) salvajeMentors[s.uid] = actions.salvajeMentor;
    }

    // Cupido links lovers
    if (actions.cupidTargets?.length === 2 && !game.lovers) {
      await updateDoc(doc(db, 'games', gameId), {
        lovers: actions.cupidTargets, perroLoboChoices, salvajeMentors,
      }).catch(() => {});
    }

    // Cambiaformas picks target (night 1)
    if (actions.cambiaformasTarget && round === 1) {
      const cf = players.find(p => newRoles[p.uid] === 'Cambiaformas');
      if (cf) cambiaformasTargets[cf.uid] = actions.cambiaformasTarget;
    }

    // Virginia Woolf links fate (night 1)
    if (actions.virginiawoolTarget && round === 1) {
      const vw = players.find(p => newRoles[p.uid] === 'Virginia Woolf');
      if (vw) virginiawoolFate[vw.uid] = actions.virginiawoolTarget;
    }

    // Sirena links bewitch target (night 1)
    if (actions.sirenaTarget && round === 1) {
      const sir = players.find(p => newRoles[p.uid] === 'Sirena del Río');
      if (sir) { sirenaUid = sir.uid; sirenaLinked = actions.sirenaTarget; }
    }

    // ── STEP 3 — Determine protections ────────────────────────────────────
    // Guardian / Sacerdote / Doctor can also be Anciana-blocked
    const guardianProtects = blockedByAnciana.has(
      players.find(p => roles[p.uid] === 'Guardián')?.uid ?? ''
    ) ? null : (actions.guardianTarget ?? null);
    const sacerdoteProtects = blockedByAnciana.has(
      players.find(p => roles[p.uid] === 'Sacerdote')?.uid ?? ''
    ) ? null : (actions.sacerdoteTarget ?? null);
    const doctorProtects = blockedByAnciana.has(
      players.find(p => roles[p.uid] === 'Doctor')?.uid ?? ''
    ) ? null : (actions.doctorTarget ?? null);

    // Update doctor state
    let doctorLastTarget = game.doctorLastTarget ?? null;
    let doctorSelfUsed = game.doctorSelfUsed ?? false;
    if (doctorProtects) {
      const docPlayer = players.find(p => newRoles[p.uid] === 'Doctor');
      if (docPlayer && doctorProtects === docPlayer.uid) doctorSelfUsed = true;
      doctorLastTarget = doctorProtects;
    }

    // ── Wolf kill ─────────────────────────────────────────────────────────

    let wolfTarget = (game.lobosBlocked) ? null : (actions.wolfTarget ?? null);
    let wolfTarget2: string | null = (game.criaLoboRage || game.eclipseActive) ? (actions.wolfTarget2 ?? null) : null;

    const isWolfProtected = (uid: string) =>
      uid === guardianProtects || uid === sacerdoteProtects || uid === doctorProtects ||
      (brujaFoundVidente && uid === brujaProtectedUid);

    // Maldito: if wolves target Maldito, he transforms instead of dying
    if (wolfTarget && wolfTarget === malditoUid && newRoles[malditoUid] !== 'Lobo') {
      newRoles[malditoUid] = 'Lobo';
      players = players.map(p => p.uid === malditoUid ? { ...p, role: 'Lobo' } : p);
      wolfTarget = null; // Maldito doesn't die
    }

    // Leprosa: if wolves kill Leprosa, block wolves next night
    if (wolfTarget) {
      const targetRole = newRoles[wolfTarget];
      if (targetRole === 'Leprosa' && !isWolfProtected(wolfTarget)) {
        lobosBlocked = true; // will block wolves next night
      }
    }

    // Antiguo: survives first wolf attack
    if (wolfTarget && newRoles[wolfTarget] === 'Antiguo' && !antiguoHit.includes(wolfTarget) && !isWolfProtected(wolfTarget)) {
      antiguoHit.push(wolfTarget);
      wolfTarget = null;
    }

    // Guardian / Doctor / Sacerdote block wolf kill
    if (wolfTarget && isWolfProtected(wolfTarget)) wolfTarget = null;
    if (wolfTarget2 && isWolfProtected(wolfTarget2)) wolfTarget2 = null;

    // Apply wolf kills
    const applyDeath = (uid: string) => {
      const victim = players.find(p => p.uid === uid && p.isAlive);
      if (!victim) return;
      players = players.map(p => p.uid === uid ? { ...p, isAlive: false } : p);
      history.push({ uid: victim.uid, name: victim.name, role: newRoles[uid] ?? 'Aldeano', round });
      // Fantasma: add to pending
      if (newRoles[uid] === 'Fantasma' && !fantasmaUsed.includes(uid)) {
        fantasmaPending.push(uid);
      }
    };

    let dayEliminatedUid: string | null = null;
    if (wolfTarget) {
      const hechSaves = actions.witchSave === true && !hechiceraLifeUsed;
      if (hechSaves) {
        hechiceraLifeUsed = true; // Hechicera used life potion — wolf target survives
      } else {
        applyDeath(wolfTarget);
        dayEliminatedUid = wolfTarget;
      }
    }

    if (wolfTarget2) { applyDeath(wolfTarget2); }

    // Hechicera poison
    if (actions.witchPoison && !hechiceraPoisonUsed) {
      hechiceraPoisonUsed = true;
      applyDeath(actions.witchPoison);
    }

    // Lobo Blanco kills a wolf
    if (actions.loboBlancoCide && round % 2 === 0) {
      const target = players.find(p => p.uid === actions.loboBlancoCide && p.isAlive);
      if (target && (newRoles[target.uid] === 'Lobo' || newRoles[target.uid] === 'Lobo Blanco')) {
        applyDeath(target.uid);
      }
    }

    // ── Bruja (wolf team) finds Vidente ────────────────────────────────────
    {
      const brujaPlayer = players.find(p => newRoles[p.uid] === 'Bruja' && p.isAlive);
      if (brujaPlayer && !blockedByAnciana.has(brujaPlayer.uid) && actions.brujaTarget && !brujaFoundVidente) {
        const target = players.find(p => p.uid === actions.brujaTarget);
        if (target && newRoles[actions.brujaTarget] === 'Vidente') {
          brujaFoundVidente = true;
          brujaProtectedUid = brujaPlayer.uid;
        }
      }
    }

    // ── Hada Buscadora finds Hada Durmiente ──────────────────────────────
    {
      const hadaBuscadora = players.find(p => newRoles[p.uid] === 'Hada Buscadora' && p.isAlive);
      if (hadaBuscadora && !blockedByAnciana.has(hadaBuscadora.uid) && actions.hadaBuscadoraTarget && !hadaLinked) {
        if (newRoles[actions.hadaBuscadoraTarget] === 'Hada Durmiente') {
          hadaLinked = true;
        }
      }
    }

    // ── Anciana block note: blockedByAnciana set computed at top of function ─

    // ── Silenciadora ───────────────────────────────────────────────────────
    {
      const sil = players.find(p => newRoles[p.uid] === 'Silenciadora' && p.isAlive);
      if (sil && !blockedByAnciana.has(sil.uid) && actions.silenciadoraTarget &&
          players.find(p => p.uid === actions.silenciadoraTarget && p.isAlive)) {
        silencedPlayers.push(actions.silenciadoraTarget);
      }
    }

    // ── Vampiro bites ─────────────────────────────────────────────────────
    if (actions.vampiroTarget) {
      const vampiro = players.find(p => newRoles[p.uid] === 'Vampiro' && p.isAlive);
      const target = players.find(p => p.uid === actions.vampiroTarget && p.isAlive);
      // Make sure Anciana didn't exile the vampiro
      if (vampiro && target && vampiro.uid !== ancianaExiledUid) {
        vampiroBites[target.uid] = (vampiroBites[target.uid] ?? 0) + 1;
        if (vampiroBites[target.uid] >= 3) {
          applyDeath(target.uid);
          vampiroKills += 1;
        }
      }
    }

    // ── Líder del Culto converts ──────────────────────────────────────────
    if (actions.liderCultoTarget) {
      const lider = players.find(p => newRoles[p.uid] === 'Líder del Culto' && p.isAlive);
      if (lider && lider.uid !== ancianaExiledUid) {
        if (!cultMembers.includes(lider.uid)) cultMembers.push(lider.uid);
        if (!cultMembers.includes(actions.liderCultoTarget)) cultMembers.push(actions.liderCultoTarget);
      }
    }

    // ── Pescador adds to boat ─────────────────────────────────────────────
    if (actions.pescadorTarget) {
      const pescador = players.find(p => newRoles[p.uid] === 'Pescador' && p.isAlive);
      if (pescador && pescador.uid !== ancianaExiledUid) {
        const targetRole = newRoles[actions.pescadorTarget];
        const isWolfRole = targetRole === 'Lobo' || targetRole === 'Lobo Blanco' || targetRole === 'Cría de Lobo';
        if (isWolfRole) {
          // Pescador dies if catches a wolf
          applyDeath(pescador.uid);
        } else if (!pescadorBoat.includes(actions.pescadorTarget)) {
          pescadorBoat.push(actions.pescadorTarget);
        }
      }
    }

    // ── Flautista enchants ────────────────────────────────────────────────
    {
      const flautista = players.find(p => newRoles[p.uid] === 'Flautista' && p.isAlive);
      if (flautista && !blockedByAnciana.has(flautista.uid) && actions.flautistaTargets?.length) {
        for (const uid of actions.flautistaTargets) {
          if (!enchanted.includes(uid)) enchanted.push(uid);
        }
      }
    }

    // ── Seer reveal ───────────────────────────────────────────────────────
    let seerReveal = game.seerReveal ?? null;
    {
      const vidente = players.find(p => newRoles[p.uid] === 'Vidente' && p.isAlive);
      if (vidente && !blockedByAnciana.has(vidente.uid) && actions.seerTarget) {
        const targetRole = newRoles[actions.seerTarget];
        seerReveal = {
          targetUid: actions.seerTarget,
          isWolf: targetRole === 'Lobo' || targetRole === 'Lobo Blanco' || targetRole === 'Cría de Lobo' || targetRole === 'Licántropo',
        };
      }
    }

    // ── Profeta reveal ────────────────────────────────────────────────────
    let profetaReveal = null;
    {
      const profeta = players.find(p => newRoles[p.uid] === 'Profeta' && p.isAlive);
      if (profeta && !blockedByAnciana.has(profeta.uid) && actions.profetaTarget) {
        profetaReveal = {
          targetUid: actions.profetaTarget,
          isWolf: newRoles[actions.profetaTarget] === 'Lobo' || newRoles[actions.profetaTarget] === 'Lobo Blanco' || newRoles[actions.profetaTarget] === 'Licántropo',
        };
      }
    }

    // ── Vigía spy ─────────────────────────────────────────────────────────
    {
      const vigiaPlayer = players.find(p => newRoles[p.uid] === 'Vigía' && p.isAlive);
      if (vigiaPlayer && !blockedByAnciana.has(vigiaPlayer.uid) && actions.vigiaActivate && !vigiaUsed) {
        vigiaUsed = true;
        const vigiaWasKilledThisNight = !players.find(p => p.uid === vigiaPlayer.uid)?.isAlive &&
          aliveBeforeNight.has(vigiaPlayer.uid);
        vigiaKnowsWolves = !vigiaWasKilledThisNight;
      }
    }

    // ── Banshee points ────────────────────────────────────────────────────
    {
      const banshee = players.find(p => newRoles[p.uid] === 'Banshee' && p.isAlive);
      if (banshee && !blockedByAnciana.has(banshee.uid) && actions.bansheePrediction) {
        const predictedDead = !players.find(p => p.uid === actions.bansheePrediction)?.isAlive &&
          aliveBeforeNight.has(actions.bansheePrediction);
        if (predictedDead) bansheePoints += 1;
      }
    }

    // ── Cambiaformas: adopt role if followed player died ──────────────────
    for (const [cfUid, targetUid] of Object.entries(cambiaformasTargets)) {
      const cf = players.find(p => p.uid === cfUid && p.isAlive);
      const target = players.find(p => p.uid === targetUid);
      if (cf && target && !target.isAlive && aliveBeforeNight.has(targetUid)) {
        newRoles[cfUid] = roles[targetUid] ?? 'Aldeano';
        players = players.map(p => p.uid === cfUid ? { ...p, role: newRoles[cfUid] } : p);
        delete cambiaformasTargets[cfUid]; // one-time transform
      }
    }

    // ── Niño Salvaje: if mentor is now dead, convert to wolf ──────────────
    for (const [salvajeUid, mentorUid] of Object.entries(salvajeMentors)) {
      const mentor = players.find(p => p.uid === mentorUid);
      if (mentor && !mentor.isAlive && newRoles[salvajeUid] === 'Niño Salvaje') {
        newRoles[salvajeUid] = 'Lobo';
        players = players.map(p => p.uid === salvajeUid ? { ...p, role: 'Lobo' } : p);
      }
    }

    // ── Cría de Lobo rage: if Cría de Lobo died this night ───────────────
    const criaLoboPlayer = players.find(p => newRoles[p.uid] === 'Cría de Lobo');
    if (criaLoboPlayer && !criaLoboPlayer.isAlive && aliveBeforeNight.has(criaLoboPlayer.uid)) {
      criaLoboRage = true;
    }

    // ── STEP 6 — Recursive chain-death resolution (max 20 iterations) ─────
    // Cascades: Lovers (Cupido), Gemelas, Virginia Woolf fate.
    // Loop continues until no new death is triggered, capped at 20 to prevent
    // any infinite-loop softlock regardless of edge-case role combinations.
    const lovers = game.lovers;
    {
      let chainChanged = true;
      let chainIterations = 0;
      while (chainChanged && chainIterations < 20) {
        chainChanged = false;
        chainIterations++;

        // Lovers cascade
        if (lovers) {
          const [l1, l2] = lovers;
          if (!players.find(p => p.uid === l1)?.isAlive && players.find(p => p.uid === l2 && p.isAlive)) {
            applyDeath(l2); chainChanged = true;
          }
          if (!players.find(p => p.uid === l2)?.isAlive && players.find(p => p.uid === l1 && p.isAlive)) {
            applyDeath(l1); chainChanged = true;
          }
        }

        // Gemelas cascade
        const gemelas = players.filter(p => newRoles[p.uid] === 'Gemela' || newRoles[p.uid] === 'Gemelas');
        if (gemelas.length === 2) {
          const [g1, g2] = gemelas;
          if (!players.find(p => p.uid === g1.uid)?.isAlive && players.find(p => p.uid === g2.uid && p.isAlive)) {
            applyDeath(g2.uid); chainChanged = true;
          }
          if (!players.find(p => p.uid === g2.uid)?.isAlive && players.find(p => p.uid === g1.uid && p.isAlive)) {
            applyDeath(g1.uid); chainChanged = true;
          }
        }

        // Virginia Woolf fate cascade
        for (const [woolUid, linkedUid] of Object.entries(virginiawoolFate)) {
          if (!players.find(p => p.uid === woolUid)?.isAlive &&
              players.find(p => p.uid === linkedUid && p.isAlive)) {
            applyDeath(linkedUid); chainChanged = true;
          }
        }
      }
      if (chainIterations >= 20) {
        console.warn('[processNight] Chain-death loop hit iteration cap (possible cycle)');
      }
    }

    // ── STEP 7 — Ángel Resucitador (after ALL deaths including chains) ─────
    {
      const angel = players.find(p => newRoles[p.uid] === 'Ángel Resucitador' && p.isAlive);
      if (angel && !blockedByAnciana.has(angel.uid) && actions.angelResucitarTarget && !angelResucitadorUsed) {
        const dead = players.find(p => p.uid === actions.angelResucitarTarget && !p.isAlive);
        if (dead) {
          players = players.map(p => p.uid === actions.angelResucitarTarget ? { ...p, isAlive: true } : p);
          history = history.filter(h => h.uid !== actions.angelResucitarTarget);
          if (dayEliminatedUid === actions.angelResucitarTarget) dayEliminatedUid = null;
          angelResucitadorUsed = true;
        }
      }
    }

    // ── Ladrón: steal role (round 1) ─────────────────────────────────────
    if (actions.ladronTarget && round === 1) {
      const ladron = players.find(p => newRoles[p.uid] === 'Ladrón' && p.isAlive);
      const target = players.find(p => p.uid === actions.ladronTarget && p.isAlive);
      if (ladron && !blockedByAnciana.has(ladron.uid) && target) {
        const stolenRole = newRoles[target.uid] ?? 'Aldeano';
        newRoles[ladron.uid] = stolenRole;
        newRoles[target.uid] = 'Aldeano';
        players = players.map(p => {
          if (p.uid === ladron.uid) return { ...p, role: stolenRole };
          if (p.uid === target.uid) return { ...p, role: 'Aldeano' };
          return p;
        });
      }
    }

    // ── Espía activates wolf chat ─────────────────────────────────────────
    let espiaUsed = game.espiaUsed ?? false;
    {
      const espia = players.find(p => newRoles[p.uid] === 'Espía' && p.isAlive);
      if (espia && !blockedByAnciana.has(espia.uid) && actions.espiaActivate && !espiaUsed) espiaUsed = true;
    }

    // ── Alquimista potion ─────────────────────────────────────────────────
    let alquimistaPotion: 'save' | 'reveal' | 'nothing' | null = null;
    let alquimistaRevealUid: string | null = null;
    const alquimista = players.find(p => newRoles[p.uid] === 'Alquimista' && p.isAlive);
    if (alquimista) {
      const rand = Math.random();
      if (rand < 0.25 && dayEliminatedUid) {
        alquimistaPotion = 'save';
        players = players.map(p => p.uid === dayEliminatedUid ? { ...p, isAlive: true } : p);
        history = history.filter(h => h.uid !== dayEliminatedUid);
        dayEliminatedUid = null;
      } else if (rand < 0.5) {
        alquimistaPotion = 'reveal';
        const revealable = players.filter(p => p.isAlive && p.uid !== alquimista.uid);
        if (revealable.length > 0) alquimistaRevealUid = revealable[Math.floor(Math.random() * revealable.length)].uid;
      } else {
        alquimistaPotion = 'nothing';
      }
    }

    // ── Cazador: if he died this night, queue his last shot ───────────────
    const deadCazador = players.find(p =>
      !p.isAlive && aliveBeforeNight.has(p.uid) && newRoles[p.uid] === 'Cazador'
    );
    const cazadorPendingShot = deadCazador?.uid ?? null;

    // ── Bear Growl ────────────────────────────────────────────────────────
    let bearGrowl = false;
    const bearTamer = players.find(p => newRoles[p.uid] === 'Oso' && p.isAlive);
    if (bearTamer) {
      const alivePlayers2 = players.filter(p => p.isAlive);
      const bearIdx = alivePlayers2.findIndex(p => p.uid === bearTamer.uid);
      const left = alivePlayers2[(bearIdx - 1 + alivePlayers2.length) % alivePlayers2.length];
      const right = alivePlayers2[(bearIdx + 1) % alivePlayers2.length];
      bearGrowl = [left, right].some(n => n && (newRoles[n.uid] === 'Lobo' || newRoles[n.uid] === 'Lobo Blanco' || newRoles[n.uid] === 'Cría de Lobo'));
    }

    // ── Médico Forense: learns role of chosen dead player ─────────────────
    const forenseResults: Record<string, string> = { ...(game.forenseResults ?? {}) };
    {
      const forensePlayer = players.find(p => newRoles[p.uid] === 'Médico Forense' && p.isAlive);
      if (forensePlayer && !blockedByAnciana.has(forensePlayer.uid) && actions.forenseTarget) {
        const deadTarget = history.find(h => h.uid === actions.forenseTarget);
        if (deadTarget) forenseResults[forensePlayer.uid] = `${deadTarget.name}: ${deadTarget.role}`;
      }
    }

    // ── Saboteador: bans target's vote for next day ───────────────────────
    let saboteadorBan: string | null = null;
    {
      const saboteadorPlayer = players.find(p => newRoles[p.uid] === 'Saboteador' && p.isAlive);
      if (saboteadorPlayer && !blockedByAnciana.has(saboteadorPlayer.uid) && actions.saboteadorTarget) {
        const banTarget = players.find(p => p.uid === actions.saboteadorTarget && p.isAlive);
        if (banTarget) saboteadorBan = banTarget.uid;
      }
    }

    // ── Random event for next day ─────────────────────────────────────────
    const randomEvent = drawRandomEvent();
    // Si el evento es Confesión Forzada, elegir un jugador vivo al azar
    const confessionUid: string | null = randomEvent?.mechanical === 'forceConfession'
      ? (() => {
          const cands = players.filter(p => p.isAlive);
          return cands.length > 0 ? cands[Math.floor(Math.random() * cands.length)].uid : null;
        })()
      : null;
    const eclipseActiveNext = false; // reset after night
    const doubleSeerActiveNext = randomEvent?.mechanical === 'doubleSeer';
    const anonymousVotesActiveNext = randomEvent?.mechanical === 'anonymousVotes';
    const noExileActiveNext = randomEvent?.mechanical === 'noExile';
    // healWitch: restore potions if event
    let hechiceraLifeUsedNext = hechiceraLifeUsed;
    let hechiceraPoisonUsedNext = hechiceraPoisonUsed;
    if (randomEvent?.mechanical === 'healWitch') {
      hechiceraLifeUsedNext = false;
      hechiceraPoisonUsedNext = false;
    }

    // ── Random event mechanicals that fire immediately at night end ───────
    // roleSwap: shuffle roles among alive players
    if (randomEvent?.mechanical === 'roleSwap') {
      const alivePlayers2 = players.filter(p => p.isAlive);
      const aliveRoles2 = alivePlayers2.map(p => newRoles[p.uid] ?? 'Aldeano');
      // Fisher-Yates shuffle
      for (let i = aliveRoles2.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [aliveRoles2[i], aliveRoles2[j]] = [aliveRoles2[j], aliveRoles2[i]];
      }
      alivePlayers2.forEach((p, i) => { newRoles[p.uid] = aliveRoles2[i]; });
    }

    // aiEliminate: randomly kill one alive player (chosen by "the AI narrator")
    if (randomEvent?.mechanical === 'aiEliminate') {
      const candidates = players.filter(p => p.isAlive);
      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        players = players.map(p => p.uid === chosen.uid ? { ...p, isAlive: false } : p);
        history.push({ uid: chosen.uid, name: chosen.name, role: newRoles[chosen.uid] ?? 'Aldeano', round });
        if (newRoles[chosen.uid] === 'Fantasma' && !fantasmaUsed.includes(chosen.uid)) {
          fantasmaPending.push(chosen.uid);
        }
      }
    }

    // revive: un jugador muerto vuelve a la vida
    if (randomEvent?.mechanical === 'revive') {
      const dead = players.filter(p => !p.isAlive);
      if (dead.length > 0) {
        const revived = dead[Math.floor(Math.random() * dead.length)];
        players = players.map(p => p.uid === revived.uid ? { ...p, isAlive: true } : p);
        // Quitar del historial de eliminados
        history.splice(history.findIndex(h => h.uid === revived.uid), 1);
      }
    }

    // ── STEP 9 — Win check ────────────────────────────────────────────────
    const nightKilledUids = players.filter(p => !p.isAlive && aliveBeforeNight.has(p.uid)).map(p => p.uid);
    const winResult = checkWinCondition(players, newRoles, {
      enchanted, round, perroLoboChoices,
      cultMembers, vampiroKills, pescadorBoat, hadaLinked,
      nightKilledUids,
      lovers: game.lovers ?? [],
    });

    // Banshee wins at 2 points
    const bansheeWin = bansheePoints >= 2;
    const finalWinner = bansheeWin ? 'banshee' : winResult.winner;
    const finalMsg = bansheeWin ? '¡La Banshee predijo 2 muertes correctamente y gana sola!' : winResult.message;

    // ── Epic Moments triggers ─────────────────────────────────────────────
    if (!finalWinner) {
      const wolfTeamUidsNow = new Set(Object.keys(game.wolfTeam ?? {}));
      const aliveAfter = players.filter(p => p.isAlive);
      const aliveWolves = aliveAfter.filter(p => wolfTeamUidsNow.has(p.uid));
      const aliveVillage = aliveAfter.filter(p => !wolfTeamUidsNow.has(p.uid));

      nightKilledUids.forEach(uid => {
        const role = newRoles[uid] ?? 'Aldeano';
        const name = players.find(p => p.uid === uid)?.name ?? '???';
        if (['Vidente', 'Hechicera', 'Doctor', 'Cazador', 'Príncipe'].includes(role))
          triggerMoment(buildMoment('unexpected_death', { name, role }));
      });
      if (alquimistaPotion === 'save') triggerMoment(buildMoment('witch_save'));
      if (aliveWolves.length === 1) triggerMoment(buildMoment('last_wolf', { name: aliveWolves[0].name }));
      if (aliveWolves.length > 0 && aliveVillage.length <= aliveWolves.length + 1)
        triggerMoment(buildMoment('wolves_winning'));
    }

    // Registrar estadísticas de jugadores reales al terminar partida
    if (finalWinner) {
      const wolfTeamUids = new Set(Object.keys(game.wolfTeam ?? {}));
      (game.players ?? []).filter(p => !p.isAI).forEach(p => {
        const role = newRoles[p.uid] ?? 'Aldeano';
        const isWolfSide = wolfTeamUids.has(p.uid);
        const playerWon = isWolfSide ? finalWinner === 'wolves' : finalWinner === 'village';
        recordGameResult(p.uid, playerWon, role).catch(() => {});
      });
    }

    // ── STEP 10 — Night audit log (subcollection) ─────────────────────────
    setDoc(doc(db, 'games', gameId, 'nightLogs', String(round)), {
      round,
      resolvedAt: Date.now(),
      killed: nightKilledUids,
      actionKeys: Object.keys(actions),
      blockedUid: ancianaExiledUid,
      silenced: silencedPlayers,
      winner: finalWinner ?? null,
    }).catch(e => console.warn('[nightLog] write failed:', e));

    // ── STEP 11 — Atomic state update ────────────────────────────────────
    try {
      await updateDoc(doc(db, 'games', gameId), {
        players,
        roles: newRoles,
        eliminatedHistory: history,
        dayEliminatedUid,
        seerReveal,
        profetaReveal,
        enchanted,
        antiguoHit,
        guardianLastTarget: guardianProtects,
        doctorLastTarget,
        doctorSelfUsed,
        perroLoboChoices,
        salvajeMentors,
        bearGrowl,
        cazadorPendingShot: cazadorPendingShot && !finalWinner ? cazadorPendingShot : null,
        espiaUsed,
        alquimistaPotion,
        alquimistaRevealUid,
        brujaFoundVidente,
        brujaProtectedUid,
        lobosBlocked,
        criaLoboRage,
        silencedPlayers,
        sirenaUid,
        sirenaLinked,
        vigiaUsed,
        vigiaKnowsWolves,
        angelResucitadorUsed,
        bansheePoints,
        cultMembers,
        vampiroBites,
        vampiroKills,
        pescadorBoat,
        hadaLinked,
        cambiaformasTargets,
        virginiawoolFate,
        verdugos,
        hechiceraLifeUsed: hechiceraLifeUsedNext,
        hechiceraPoisonUsed: hechiceraPoisonUsedNext,
        fantasmaPending,
        fantasmaUsed,
        forenseResults,
        saboteadorBan,
        currentEvent: randomEvent ?? null,
        confessionUid: confessionUid ?? null,
        eventRound: randomEvent ? round : (game.eventRound ?? 0),
        eclipseActive: randomEvent?.mechanical === 'eclipse' ? true : eclipseActiveNext,
        doubleSeerActive: doubleSeerActiveNext,
        anonymousVotesActive: anonymousVotesActiveNext,
        noExileActive: noExileActiveNext,
        phase: finalWinner ? 'ended' : 'day',
        winners: finalWinner ?? null,
        winMessage: finalMsg ?? null,
        nightActions: {},
        nightSubmissions: {},
        dayVotes: {},
        dayStartedAt: Date.now(),
        phaseEndsAt: (() => {
          if (finalWinner) return null;
          const alive = players.filter(p => p.isAlive).length;
          const base = Math.min(120, Math.max(60, alive * 10));
          const mech = randomEvent?.mechanical;
          const dur = mech === 'extraTime' ? Math.min(180, base + 30)
            : mech === 'halfTime' ? Math.max(30, Math.floor(base / 2))
            : base;
          return Date.now() + dur * 1000 + 2000;
        })(),
        bansheePredictionUid: null,
      });
    } catch (e) {
      console.error('processNight updateDoc error:', e);
    } finally {
      processingNightRef.current = false;
    }
  }

  const submitDayVote = useCallback(async (targetUid: string) => {
    if (!user || !game) return;
    if (game.phase !== 'day' && game.phase !== 'voting') { console.warn('[FSM] submitDayVote rejected — not day/voting phase'); return; }
    const me = game.players?.find(p => p.uid === user.uid);
    if (!me?.isAlive) { console.warn('[FSM] submitDayVote rejected — player not alive'); return; }
    let actualTarget = targetUid;
    if (game.sirenaLinked === user.uid && game.sirenaUid) {
      actualTarget = votesFromSub[game.sirenaUid] ?? targetUid;
    }
    try {
      await setDoc(doc(db, 'games', gameId, 'votes', user.uid), {
        target: actualTarget,
        round: game.roundNumber ?? 1,
        submittedAt: Date.now(),
      });
      // Registro de comportamiento del jugador (fire-and-forget)
      if (game.dayStartedAt) recordVote(user.uid, game.dayStartedAt).catch(() => {});
    } catch (e) { console.error('submitDayVote error:', e); }
  }, [user, game, gameId, votesFromSub]);

  // Host triggers AI chat messages during day phase
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;

    const round = game.roundNumber ?? 1;
    if (aiChatSentRound.current === round) return;
    aiChatSentRound.current = round;

    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const aiPlayers = alivePlayers.filter(p => p.isAI);
    if (aiPlayers.length === 0) return;

    const roles = game.roles ?? {};
    const eliminatedPlayer = game.dayEliminatedUid ? game.players?.find(p => p.uid === game.dayEliminatedUid) : null;
    const payload = {
      aiPlayers: aiPlayers.map(p => ({
        uid: p.uid, name: p.name, role: roles[p.uid] ?? 'Aldeano',
        isWolf: roles[p.uid] === 'Lobo' || roles[p.uid] === 'Lobo Blanco' || roles[p.uid] === 'Cría de Lobo',
        botType: p.botType ?? 'caotico',
      })),
      eliminatedName: eliminatedPlayer?.name ?? null,
      eliminatedRole: eliminatedPlayer ? (roles[eliminatedPlayer.uid] ?? 'Aldeano') : null,
      round,
      allAliveNames: alivePlayers.map(p => p.name),
    };

    fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(async (data: { messages?: { uid: string; name: string; text: string }[] }) => {
        const messages = data.messages ?? [];
        for (let i = 0; i < messages.length; i++) {
          const m = messages[i];
          const delay = 4000 + i * (3000 + Math.random() * 5000);
          await new Promise(res => setTimeout(res, delay));
          addDoc(collection(db, 'games', gameId, 'publicChat'), {
            senderId: m.uid, senderName: m.name, text: m.text, createdAt: serverTimestamp(),
          }).catch(() => {});
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber]);

  // Host auto-votes for AI players during day — personality-based timing
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;

    const round = game.roundNumber ?? 1;
    if (aiDayVotedRound.current === round) return;

    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const aiAlive = alivePlayers.filter(p => p.isAI);
    if (aiAlive.length === 0) return;

    const dayStarted = game.dayStartedAt ?? Date.now();
    const elapsed = Date.now() - dayStarted;
    const voteBanned = game.voteBanned ?? [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const alreadyVoted = new Set<string>(Object.keys(votesFromSub));

    for (const ai of aiAlive) {
      if (alreadyVoted.has(ai.uid) || voteBanned.includes(ai.uid)) continue;
      const bType = (ai.botType ?? 'caotico') as BotType;
      const cfg = BOT_VOTE_CONFIG[bType];
      const targetDelay = cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay);
      const waitMs = Math.max(500, targetDelay - elapsed);
      const capturedUid = ai.uid;

      const t = setTimeout(async () => {
        try {
          const snap = await getDoc(doc(db, 'games', gameId));
          if (!snap.exists()) return;
          const freshGame = snap.data() as GameState;
          if (freshGame.phase !== 'day' || (freshGame.roundNumber ?? 1) !== round) return;

          const freshAlive = (freshGame.players ?? []).filter(p => p.isAlive);
          const allCurrentVotes: Record<string, string> = freshGame.dayVotes ?? {};

          // Verdugo AI: 80% de probabilidad de votar a su objetivo secreto si sigue vivo
          const verdugoTarget = freshGame.verdugos?.[capturedUid];
          const verdugoTargetAlive = verdugoTarget && freshAlive.some(p => p.uid === verdugoTarget);
          const targetUid = (verdugoTargetAlive && Math.random() < 0.8)
            ? verdugoTarget!
            : pickBotVoteTarget(bType, capturedUid, freshAlive, allCurrentVotes);
          if (!targetUid) return;

          await setDoc(doc(db, 'games', gameId, 'votes', capturedUid), {
            target: targetUid,
            round,
            submittedAt: Date.now(),
          });

          // Narrador spotlight: 28% de probabilidad de mencionar al bot
          if (Math.random() < 0.28) {
            const botPlayer = aiAlive.find(p => p.uid === capturedUid);
            if (botPlayer) {
              const bTypeSpot = (botPlayer.botType ?? 'caotico') as BotType;
              const spotlights = BOT_NARRATOR_SPOTLIGHTS[bTypeSpot];
              const spot = spotlights[Math.floor(Math.random() * spotlights.length)];
              const spotText = spot.text.replace(/\{name\}/g, botPlayer.name);
              updateDoc(doc(db, 'games', gameId), {
                narratorBroadcast: { text: spotText, type: spot.type, triggeredAt: Date.now() },
              }).catch(() => {});
            }
          }
        } catch { /* ignore */ }
      }, waitMs);
      timers.push(t);
    }

    aiDayVotedRound.current = round;
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, game?.dayStartedAt]);

  // ── Host: narrador IA interrumpe el debate en tiempo real ──────────────
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;
    const round = game.roundNumber ?? 1;
    const dayStarted = game.dayStartedAt ?? Date.now();

    const FIRST_INTERRUPT_DELAY = 50000;  // 50s después de iniciar el día
    const REPEAT_INTERVAL = 75000;        // cada 75s

    const schedule = () => {
      const now = Date.now();
      const sinceDay = now - dayStarted;
      const sinceLastInterrupt = now - narratorInterruptAt.current;
      const isFirstRound = narratorInterruptRound.current !== round;

      const waitFirst = Math.max(0, FIRST_INTERRUPT_DELAY - sinceDay);
      const waitRepeat = Math.max(0, REPEAT_INTERVAL - sinceLastInterrupt);
      const waitMs = isFirstRound ? waitFirst : waitRepeat;

      return setTimeout(async () => {
        if (!game || game.phase !== 'day') return;
        narratorInterruptAt.current = Date.now();
        narratorInterruptRound.current = round;

        const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
        const elapsed = Math.floor((Date.now() - dayStarted) / 1000);
        const interruptTypes: Array<'warning' | 'suspicion' | 'chaos' | 'irony' | 'accusation'> =
          ['warning', 'suspicion', 'chaos', 'irony', 'accusation'];
        const interruptType = interruptTypes[Math.floor(Math.random() * interruptTypes.length)];

        // Elegir jugadores silenciosos (muestra de jugadores vivos al azar)
        const shuffled = [...alivePlayers].sort(() => Math.random() - 0.5);
        const silentPlayers = shuffled.slice(0, 2).map(p => p.name);
        const talkingMost = shuffled[shuffled.length - 1]?.name ?? '';

        try {
          const res = await fetch('/api/narrator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'day_interrupt',
              round,
              survivors: alivePlayers.map(p => p.name),
              interruptType,
              silentPlayers,
              talkingMost,
              timeElapsedSeconds: elapsed,
            }),
          });
          const data = await res.json();
          if (data.narration) {
            updateDoc(doc(db, 'games', gameId), {
              narratorBroadcast: {
                text: data.narration,
                type: interruptType,
                triggeredAt: Date.now(),
              },
            }).catch(() => {});
          }
        } catch { /* silencioso */ }
      }, waitMs);
    };

    const timer = schedule();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, game?.dayStartedAt]);

  // Host processes day votes when all eligible alive players have voted
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const voteBanned = game.voteBanned ?? [];
    const eligible = alivePlayers.filter(p => !voteBanned.includes(p.uid));
    const votedCount = eligible.filter(p => !!votesFromSub[p.uid]).length;
    if (votedCount >= eligible.length && eligible.length > 0) {
      processDayVotes(votesFromSub);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votesFromSub, game?.phase]);

  // ── Anti-softlock: force processDayVotes when day timer expires ───────────
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;
    // Use server phaseEndsAt if available, else compute locally
    const endsAt = game.phaseEndsAt ?? (() => {
      const alive = (game.players ?? []).filter(p => p.isAlive).length;
      const base = Math.min(300, Math.max(60, alive * 20));
      const mech = game.currentEvent?.mechanical;
      const dur = mech === 'extraTime' ? Math.min(300, base + 30)
        : mech === 'halfTime' ? Math.max(30, Math.floor(base / 2))
        : base;
      return (game.dayStartedAt ?? Date.now()) + dur * 1000 + 2000;
    })();
    const remaining = Math.max(0, endsAt - Date.now());
    const t = setTimeout(() => {
      if (game.phase !== 'day' || processingDayRef.current) return;
      console.warn('[Anti-softlock] Day timer expired → forcing processDayVotes');
      processDayVotes(votesFromSub);
    }, remaining);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, game?.dayStartedAt, game?.phaseEndsAt]);

  // ── Micro-momento: duda en votación ──────────────────────────────────────
  const hesitationFiredRef = useRef(false);
  useEffect(() => {
    if (!game || game.phase !== 'day') { hesitationFiredRef.current = false; return; }
    const t = setTimeout(() => {
      if (hesitationFiredRef.current) return;
      const alivePlayers = (game.players ?? []).filter(p => p.isAlive && !p.isAI);
      const voteBanned = game.voteBanned ?? [];
      const eligible = alivePlayers.filter(p => !voteBanned.includes(p.uid));
      const pending = eligible.filter(p => !votesFromSub[p.uid]);
      if (pending.length === 0 || pending.length === eligible.length) return;
      const target = pending[Math.floor(Math.random() * pending.length)];
      hesitationFiredRef.current = true;
      const phrases = [
        `${target.name} no ha votado aún…`,
        `¿Qué oculta ${target.name}?`,
        `${target.name} duda demasiado…`,
      ];
      const subPhrases = [
        '¿Indecisión o cálculo?',
        'El silencio también acusa.',
        'Cada segundo cuenta en el pueblo.',
      ];
      const i = Math.floor(Math.random() * phrases.length);
      triggerMoment(buildMoment('hesitation', {
        headline: phrases[i],
        subtext: subPhrases[i],
      }));
    }, 32_000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber]);

  async function processDayVotes(dayVotes: Record<string, string>) {
    if (!game) return;
    if (game.phase !== 'day' && game.phase !== 'voting') { return; }
    if (processingDayRef.current) return;
    processingDayRef.current = true;
    const roles = game.roles ?? {};
    const newRoles = { ...roles };
    const salvajeMentors = game.salvajeMentors ?? {};
    const perroLoboChoices = game.perroLoboChoices ?? {};
    const round = game.roundNumber ?? 1;
    const aliveBeforeDay = new Set((game.players ?? []).filter(p => p.isAlive).map(p => p.uid));
    const verdugos = game.verdugos ?? {};
    const virginiawoolFate = game.virginiawoolFate ?? {};
    let fantasmaPending = [...(game.fantasmaPending ?? [])];
    const fantasmaUsed = [...(game.fantasmaUsed ?? [])];

    // Sirena: force sirena-linked player to vote same as sirena
    const sirenaLinked = game.sirenaLinked;
    const sirenaUid = game.sirenaUid;
    const effectiveDayVotes = { ...dayVotes };
    if (sirenaLinked && sirenaUid && effectiveDayVotes[sirenaUid]) {
      effectiveDayVotes[sirenaLinked] = effectiveDayVotes[sirenaUid];
    }

    // Apply vote ban (includes Saboteador's nightly ban)
    const voteBanned = [...(game.voteBanned ?? [])];
    if (game.saboteadorBan && !voteBanned.includes(game.saboteadorBan)) voteBanned.push(game.saboteadorBan);
    const effectiveVotes: Record<string, string> = {};
    for (const [voter, target] of Object.entries(effectiveDayVotes)) {
      if (!voteBanned.includes(voter)) effectiveVotes[voter] = target;
    }

    // Tally (Alcalde gets double vote)
    const tally: Record<string, number> = {};
    for (const [voterUid, target] of Object.entries(effectiveVotes)) {
      const multiplier = newRoles[voterUid] === 'Alcalde' ? 2 : 1;
      tally[target] = (tally[target] ?? 0) + multiplier;
    }

    // Maldición de Venganza: +1 voto al maldito si la maldición es de esta ronda
    const cursed = game.cursed;
    if (cursed?.uid && (cursed.round === round || cursed.round === round - 1)) {
      if (aliveBeforeDay.has(cursed.uid)) {
        tally[cursed.uid] = (tally[cursed.uid] ?? 0) + 1;
      }
    }

    let maxVotes = 0;
    let eliminated: string | null = null;
    let isTie = false;

    // Evento: Democracia Inversa — el menos votado es exiliado
    if (game.currentEvent?.mechanical === 'inverterVotes' && Object.keys(tally).length > 0) {
      let minVotes = Infinity;
      for (const [uid, count] of Object.entries(tally)) {
        if (count < minVotes) { minVotes = count; eliminated = uid; isTie = false; }
        else if (count === minVotes) { isTie = true; }
      }
      if (isTie) eliminated = null;
    } else {
      for (const [uid, count] of Object.entries(tally)) {
        if (count > maxVotes) { maxVotes = count; eliminated = uid; isTie = false; }
        else if (count === maxVotes && maxVotes > 0) { isTie = true; }
      }
      if (isTie) eliminated = null;
    }

    // Evento: Doble Ejecución — los 2 más votados son exiliados
    let secondEliminated: string | null = null;
    if (game.currentEvent?.mechanical === 'dobleEjecucion' && Object.keys(tally).length >= 2) {
      const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      if (sorted.length >= 2 && sorted[1][1] > 0) {
        secondEliminated = sorted[1][0];
      }
    }

    // Evento: Tormenta — nadie puede ser exiliado hoy
    if (game.noExileActive) { eliminated = null; secondEliminated = null; }

    // Chivo Expiatorio: dies on tie
    let chivoPendingChoice: string | null = null;
    let players = [...(game.players ?? [])];
    const history = [...(game.eliminatedHistory ?? [])];
    const enchanted = [...(game.enchanted ?? [])];

    if (isTie) {
      const chivoPlayer = players.find(p => p.isAlive && newRoles[p.uid] === 'Chivo Expiatorio');
      if (chivoPlayer) { eliminated = chivoPlayer.uid; chivoPendingChoice = chivoPlayer.uid; }
    }

    // Alborotadora fight: both fighters die (Prince check applies to fighters too)
    const alborotadoraFight = game.alborotadoraFight;
    if (alborotadoraFight) {
      for (const fightUid of alborotadoraFight) {
        const fighter = players.find(p => p.uid === fightUid && p.isAlive);
        if (fighter) {
          // Príncipe sobrevive la pelea si no ha usado su poder
          if (newRoles[fightUid] === 'Príncipe' && !game.principeUsed) {
            await updateDoc(doc(db, 'games', gameId), { principeUsed: true }).catch(() => {});
            continue; // El Príncipe no muere en la pelea
          }
          players = players.map(p => p.uid === fightUid ? { ...p, isAlive: false } : p);
          history.push({ uid: fighter.uid, name: fighter.name, role: newRoles[fighter.uid] ?? 'Aldeano', round });
          if (newRoles[fightUid] === 'Fantasma' && !fantasmaUsed.includes(fightUid)) {
            fantasmaPending.push(fightUid);
          }
        }
      }
    }

    // Si el más votado murió en la pelea de la Alborotadora, cancelar eliminación normal (evitar doble historia y cascada)
    if (eliminated && alborotadoraFight?.includes(eliminated)) {
      if (!players.find(p => p.uid === eliminated && p.isAlive)) {
        eliminated = null;
      }
    }

    if (eliminated) {
      const victim = players.find(p => p.uid === eliminated);
      if (victim && victim.isAlive) {

        // Príncipe: survives one lynch
        if (newRoles[eliminated] === 'Príncipe' && !game.principeUsed) {
          // Prince reveals and survives — don't eliminate
          eliminated = null;
          await updateDoc(doc(db, 'games', gameId), {
            principeUsed: true,
            alborotadoraFight: null,
          }).catch(() => {});
          processingDayRef.current = false;
          return;
        }

        // Antiguo: if eliminated by village, all special roles lose powers
        if (newRoles[eliminated] === 'Antiguo') {
          for (const uid of Object.keys(newRoles)) {
            const role = newRoles[uid];
            if (role !== 'Lobo' && role !== 'Lobo Blanco' && role !== 'Cría de Lobo' && role !== 'Aldeano') {
              newRoles[uid] = 'Aldeano';
            }
          }
        }

        players = players.map(p => p.uid === eliminated ? { ...p, isAlive: false } : p);
        history.push({ uid: victim.uid, name: victim.name, role: newRoles[victim.uid] ?? 'Aldeano', round });

        // Fantasma pending
        if (newRoles[eliminated!] === 'Fantasma' && !fantasmaUsed.includes(eliminated!)) {
          fantasmaPending.push(eliminated!);
        }
      }
    }

    // Doble Ejecución: también eliminar al segundo más votado
    if (secondEliminated && secondEliminated !== eliminated) {
      const victim2 = players.find(p => p.uid === secondEliminated && p.isAlive);
      if (victim2) {
        players = players.map(p => p.uid === secondEliminated ? { ...p, isAlive: false } : p);
        history.push({ uid: victim2.uid, name: victim2.name, role: newRoles[victim2.uid] ?? 'Aldeano', round });
        if (newRoles[secondEliminated] === 'Fantasma' && !fantasmaUsed.includes(secondEliminated)) {
          fantasmaPending.push(secondEliminated);
        }
      }
    }

    // Niño Salvaje: if mentor eliminated, convert to wolf
    for (const [salvajeUid, mentorUid] of Object.entries(salvajeMentors)) {
      const mentor = players.find(p => p.uid === mentorUid);
      if (mentor && !mentor.isAlive && newRoles[salvajeUid] === 'Niño Salvaje') {
        newRoles[salvajeUid] = 'Lobo';
        players = players.map(p => p.uid === salvajeUid ? { ...p, role: 'Lobo' } : p);
      }
    }

    // Lovers cascade
    const lovers = game.lovers;
    if (lovers && eliminated) {
      const [l1, l2] = lovers;
      const partnerUid = eliminated === l1 ? l2 : eliminated === l2 ? l1 : null;
      if (partnerUid && players.find(p => p.uid === partnerUid && p.isAlive)) {
        players = players.map(p => p.uid === partnerUid ? { ...p, isAlive: false } : p);
        const partner = players.find(p => p.uid === partnerUid);
        if (partner) history.push({ uid: partnerUid, name: partner.name, role: newRoles[partnerUid] ?? 'Aldeano', round });
      }
    }

    // Gemela cascade
    const gemelas = players.filter(p => newRoles[p.uid] === 'Gemela' || newRoles[p.uid] === 'Gemelas');
    if (gemelas.length === 2 && eliminated) {
      const [g1, g2] = gemelas;
      const partnerGemela = eliminated === g1.uid ? g2 : eliminated === g2.uid ? g1 : null;
      if (partnerGemela && players.find(p => p.uid === partnerGemela.uid && p.isAlive)) {
        players = players.map(p => p.uid === partnerGemela.uid ? { ...p, isAlive: false } : p);
        history.push({ uid: partnerGemela.uid, name: partnerGemela.name, role: newRoles[partnerGemela.uid] ?? 'Aldeano', round });
      }
    }

    // Virginia Woolf fate cascade
    if (eliminated) {
      for (const [woolUid, linkedUid] of Object.entries(virginiawoolFate)) {
        if (eliminated === woolUid) {
          const linked = players.find(p => p.uid === linkedUid && p.isAlive);
          if (linked) {
            players = players.map(p => p.uid === linkedUid ? { ...p, isAlive: false } : p);
            history.push({ uid: linkedUid, name: linked.name, role: newRoles[linkedUid] ?? 'Aldeano', round });
          }
        }
      }
    }

    // Cazador: if eliminated by vote, queue last shot
    const deadCazadorDay = players.find(p =>
      !p.isAlive && aliveBeforeDay.has(p.uid) && newRoles[p.uid] === 'Cazador'
    );
    const cazadorPendingShot = deadCazadorDay?.uid ?? null;

    const winResult = checkWinCondition(players, newRoles, {
      enchanted, round,
      dayEliminatedUid: eliminated,
      secondEliminatedUid: secondEliminated,
      eliminatedByVote: true,
      perroLoboChoices,
      cultMembers: game.cultMembers ?? [],
      vampiroKills: game.vampiroKills ?? 0,
      pescadorBoat: game.pescadorBoat ?? [],
      hadaLinked: game.hadaLinked ?? false,
      lovers: game.lovers ?? [],
    });

    // Verdugo win check: if their secret target was lynched
    let verdugosWin = false;
    let verdugosWinMsg = '';
    for (const [verdUid, targetUid] of Object.entries(verdugos)) {
      if (eliminated === targetUid && aliveBeforeDay.has(verdUid)) {
        verdugosWin = true;
        const verdPlayer = players.find(p => p.uid === verdUid);
        verdugosWinMsg = `¡El Verdugo ${verdPlayer?.name ?? ''} consiguió linchar a su objetivo secreto y gana solo!`;
        break;
      }
    }

    // Banshee: check day-phase prediction (predicted the lynched player)
    let bansheePoints = game.bansheePoints ?? 0;
    if (game.bansheePredictionUid && game.bansheePredictionUid === eliminated) {
      bansheePoints += 1;
    }
    const bansheePlayer = players.find(p => newRoles[p.uid] === 'Banshee' && p.isAlive);
    const bansheeWinDay = bansheePoints >= 2 && !!bansheePlayer;

    const finalWinner = bansheeWinDay ? 'banshee' : verdugosWin ? 'verdugo' : winResult.winner;
    const finalMsg = bansheeWinDay
      ? `¡La Banshee predijo correctamente al ejecutado del pueblo y alcanza 2 predicciones! ¡Gana sola!`
      : verdugosWin ? verdugosWinMsg : winResult.message;

    // ── Epic Moments: trigger narrative banners ───────────────────────────
    if (!finalWinner) {
      const alivePlayers = players.filter(p => p.isAlive);
      const wolfTeamUidsNow = new Set(Object.keys(game.wolfTeam ?? {}));
      const aliveWolves = alivePlayers.filter(p => wolfTeamUidsNow.has(p.uid));
      const aliveVillage = alivePlayers.filter(p => !wolfTeamUidsNow.has(p.uid));

      if (eliminated) {
        const elimRole = newRoles[eliminated] ?? 'Aldeano';
        const elimName = players.find(p => p.uid === eliminated)?.name ?? '???';
        const wasWolf = wolfTeamUidsNow.has(eliminated);
        if (wasWolf) triggerMoment(buildMoment('wolf_eliminated', { name: elimName, role: elimRole }));
        else if (['Vidente', 'Hechicera', 'Doctor', 'Cazador'].includes(elimRole))
          triggerMoment(buildMoment('unexpected_death', { name: elimName, role: elimRole }));
      }
      if (isTie) triggerMoment(buildMoment('tie_vote'));
      if (aliveWolves.length === 1) triggerMoment(buildMoment('last_wolf', { name: aliveWolves[0].name }));
      if (aliveWolves.length > 0 && aliveVillage.length <= aliveWolves.length + 1)
        triggerMoment(buildMoment('final_battle'));
    }

    // Registrar estadísticas de jugadores reales al terminar partida
    if (finalWinner) {
      const wolfTeamUids = new Set(Object.keys(game.wolfTeam ?? {}));
      (game.players ?? []).filter(p => !p.isAI).forEach(p => {
        const role = newRoles[p.uid] ?? 'Aldeano';
        const isWolfSide = wolfTeamUids.has(p.uid);
        const playerWon = isWolfSide ? finalWinner === 'wolves' : finalWinner === 'village';
        recordGameResult(p.uid, playerWon, role).catch(() => {});
      });
    }

    try {
      await updateDoc(doc(db, 'games', gameId), {
        players,
        roles: newRoles,
        eliminatedHistory: history,
        enchanted,
        cazadorPendingShot: cazadorPendingShot && !finalWinner ? cazadorPendingShot : null,
        chivoPendingChoice: chivoPendingChoice && !finalWinner ? chivoPendingChoice : null,
        voteBanned: [],
        alquimistaPotion: null,
        alquimistaRevealUid: null,
        juezUsed: false,
        alborotadoraFight: null,
        fantasmaPending,
        silencedPlayers: [],
        bansheePredictionUid: null,
        bansheePoints,
        phase: finalWinner ? 'ended' : 'night',
        winners: finalWinner ?? null,
        winMessage: finalMsg ?? null,
        roundNumber: round + 1,
        dayVotes: {},
        dayEliminatedUid: null,
        seerReveal: null,
        profetaReveal: null,
        nightActions: {},
        nightSubmissions: {},
        bearGrowl: false,
        nightStartedAt: finalWinner ? null : Date.now(),
        phaseEndsAt: finalWinner ? null : Date.now() + 93000,
        currentEvent: null,
        eclipseActive: false,
        doubleSeerActive: false,
        anonymousVotesActive: false,
        noExileActive: false,
        saboteadorBan: null,
      });
    } catch (e) {
      console.error('processDayVotes updateDoc error:', e);
    } finally {
      processingDayRef.current = false;
    }
  }

  // Cazador fires last shot
  const applyCazadorShot = useCallback(async (targetUid: string) => {
    if (!game) return;
    const roles = game.roles ?? {};
    let players = [...(game.players ?? [])];
    const history = [...(game.eliminatedHistory ?? [])];
    const round = game.roundNumber ?? 1;
    const target = players.find(p => p.uid === targetUid && p.isAlive);
    if (target) {
      players = players.map(p => p.uid === targetUid ? { ...p, isAlive: false } : p);
      history.push({ uid: targetUid, name: target.name, role: roles[targetUid] ?? 'Aldeano', round });
    }
    const winResult = checkWinCondition(players, roles, {
      enchanted: game.enchanted ?? [], round,
      perroLoboChoices: game.perroLoboChoices ?? {},
      cultMembers: game.cultMembers ?? [],
      vampiroKills: game.vampiroKills ?? 0,
      pescadorBoat: game.pescadorBoat ?? [],
      hadaLinked: game.hadaLinked ?? false,
      lovers: game.lovers ?? [],
    });
    interruptWith(AUDIO_FILES.lastBullet);
    await updateDoc(doc(db, 'games', gameId), {
      players, eliminatedHistory: history, cazadorPendingShot: null,
      winners: winResult.winner ?? null, winMessage: winResult.message ?? null,
      phase: winResult.winner ? 'ended' : game.phase,
    }).catch((e: unknown) => console.error('cazadorShot error:', e));
  }, [game, gameId, interruptWith, AUDIO_FILES]);

  // Chivo Expiatorio: after dying in tie, chooses who can't vote next round
  const applyChivoChoice = useCallback(async (bannedUid: string | null) => {
    await updateDoc(doc(db, 'games', gameId), {
      chivoPendingChoice: null, voteBanned: bannedUid ? [bannedUid] : [],
    }).catch((e: unknown) => console.error('chivoChoice error:', e));
  }, [gameId]);

  // Juez: calls a second vote during day phase (reset timer to give 30s to re-vote)
  const juezCallSecondVote = useCallback(async () => {
    if (!game) return;
    const now = Date.now();
    await updateDoc(doc(db, 'games', gameId), {
      dayVotes: {},
      juezUsed: true,
      dayStartedAt: now,
      phaseEndsAt: now + 35000,
    }).catch((e: unknown) => console.error('juezSecondVote error:', e));
  }, [game, gameId]);

  // Alborotadora: choose 2 players to fight
  const alborotadoraChooseFight = useCallback(async (p1: string, p2: string) => {
    if (!game) return;
    await updateDoc(doc(db, 'games', gameId), {
      alborotadoraFight: [p1, p2],
      alborotadoraUsed: true,
    }).catch((e: unknown) => console.error('alborotadoraFight error:', e));
  }, [game, gameId]);

  // Fantasma: send anonymous message
  const fantasmaSendMessage = useCallback(async (senderUid: string, targetUid: string, message: string) => {
    if (!game || !message.trim() || !targetUid) return;
    const targetPlayer = (game.players ?? []).find(p => p.uid === targetUid);
    if (!targetPlayer) return;
    // Send message to ghostChat visible to all and as private DM
    await addDoc(collection(db, 'games', gameId, 'publicChat'), {
      senderId: 'ghost',
      senderName: '👻 Mensaje Anónimo',
      text: `(Mensaje del más allá para ${targetPlayer.name}): ${message.slice(0, 280)}`,
      createdAt: serverTimestamp(),
    }).catch(() => {});
    // Mark as used
    const newUsed = [...(game.fantasmaUsed ?? []), senderUid];
    const newPending = (game.fantasmaPending ?? []).filter(uid => uid !== senderUid);
    await updateDoc(doc(db, 'games', gameId), {
      fantasmaUsed: newUsed,
      fantasmaPending: newPending,
    }).catch(() => {});
  }, [game, gameId]);

  // AI auto-selects for Chivo Expiatorio
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (!game.chivoPendingChoice) return;
    const chivoUid = game.chivoPendingChoice;
    const chivo = (game.players ?? []).find(p => p.uid === chivoUid);
    if (!chivo?.isAI) return;
    const timer = setTimeout(() => {
      const alive = (game.players ?? []).filter(p => p.isAlive && p.uid !== chivoUid);
      applyChivoChoice(alive.length > 0 ? alive[Math.floor(Math.random() * alive.length)].uid : null);
    }, 2500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.chivoPendingChoice]);

  // AI auto-shoots for Cazador
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (!game.cazadorPendingShot) return;
    const cazadorUid = game.cazadorPendingShot;
    const cazador = (game.players ?? []).find(p => p.uid === cazadorUid);
    if (!cazador?.isAI) return;
    const timer = setTimeout(() => {
      const alive = (game.players ?? []).filter(p => p.isAlive && p.uid !== cazadorUid);
      if (alive.length > 0) {
        applyCazadorShot(alive[Math.floor(Math.random() * alive.length)].uid);
      } else {
        updateDoc(doc(db, 'games', gameId), { cazadorPendingShot: null }).catch(() => {});
      }
    }, 2500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.cazadorPendingShot]);

  // AI auto-sends fantasma message
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    const pending = game.fantasmaPending ?? [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const ghostUid of pending) {
      const ghostPlayer = (game.players ?? []).find(p => p.uid === ghostUid);
      if (!ghostPlayer?.isAI) continue;
      const alive = (game.players ?? []).filter(p => p.isAlive);
      if (alive.length > 0) {
        const target = alive[Math.floor(Math.random() * alive.length)];
        const t = setTimeout(() => {
          fantasmaSendMessage(ghostUid, target.uid, 'Soy un fantasma. Confiad en el pueblo y eliminad a los lobos.');
        }, 3000);
        timers.push(t);
      }
    }
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.fantasmaPending?.length]);

  if (loading || !game) return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f]">
      <Loader2 className="h-10 w-10 animate-spin text-white/50" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f] text-white">
      <p>Debes iniciar sesión para jugar.</p>
    </div>
  );

  const myRole = game.roles?.[user.uid];
  const me = game.players?.find(p => p.uid === user.uid);

  // ── Fantasma overlay: dead Fantasma player sends anonymous message ──────
  const myFantasmaPending = (game.fantasmaPending ?? []).includes(user.uid) && !(game.fantasmaUsed ?? []).includes(user.uid);
  if (myFantasmaPending && !me?.isAlive) {
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    return (
      <div className="min-h-screen w-full text-white flex flex-col items-center justify-center p-6 relative"
        style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/90" />
        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">👻</div>
            <h2 className="text-3xl font-bold text-purple-300">Mensaje desde el más allá</h2>
            <p className="text-white/60 mt-2 text-sm">Has muerto, pero puedes enviar un último mensaje anónimo de 280 caracteres.</p>
          </div>
          <div className="mb-4">
            <label className="text-sm text-white/60 mb-1 block">¿A quién?</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alivePlayers.map(p => (
                <button key={p.uid} onClick={() => setFantasmaTarget(p.uid)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${fantasmaTarget === p.uid ? 'border-purple-400 bg-purple-900/40' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden text-xs">
                    {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                  </div>
                  <span className="font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={fantasmaMsg}
            onChange={e => setFantasmaMsg(e.target.value.slice(0, 280))}
            placeholder="Escribe tu mensaje..."
            className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-white resize-none h-24 text-sm focus:outline-none focus:border-purple-400 mb-1"
          />
          <p className="text-xs text-white/40 text-right mb-3">{fantasmaMsg.length}/280</p>
          <button
            onClick={() => fantasmaSendMessage(user.uid, fantasmaTarget, fantasmaMsg)}
            disabled={!fantasmaTarget || !fantasmaMsg.trim()}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Enviar mensaje anónimo
          </button>
        </div>
      </div>
    );
  }

  // ── Chivo Expiatorio overlay ───────────────────────────────────────────
  if (game.chivoPendingChoice) {
    const chivoUid = game.chivoPendingChoice;
    const isMyChoice = chivoUid === user.uid;
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    return (
      <div className="min-h-screen w-full text-white flex flex-col items-center justify-center p-6 relative"
        style={{ backgroundImage: 'url(/dia.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/85" />
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="text-7xl mb-4">🐐</div>
          {isMyChoice ? (
            <>
              <h2 className="text-3xl font-bold mb-2 text-amber-400">¡El Chivo Expiatorio!</h2>
              <p className="text-white/60 mb-2">Has muerto en el empate. Pero puedes elegir quién <strong>no podrá votar</strong> en la próxima ronda.</p>
              <div className="space-y-2 mt-6 mb-4">
                {alivePlayers.map(p => (
                  <button key={p.uid} onClick={() => applyChivoChoice(p.uid)}
                    className="w-full flex items-center gap-3 bg-amber-900/30 border border-amber-500/40 rounded-xl p-4 hover:bg-amber-900/60 transition-all text-left">
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold">
                      {p.photoURL ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" /> : <span>{p.name[0]}</span>}
                    </div>
                    <span className="font-semibold">{p.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => applyChivoChoice(null)}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium py-3 rounded-xl transition-colors">
                No excluir a nadie
              </button>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold mb-2 text-amber-400">¡El Chivo Expiatorio muere!</h2>
              <p className="text-white/60 mb-4">
                <span className="text-white font-semibold">{(game.players ?? []).find(p => p.uid === chivoUid)?.name ?? 'El Chivo'}</span> elige quién no votará...
              </p>
              <div className="animate-pulse text-5xl mt-4">⏳</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Cazador overlay ────────────────────────────────────────────────────
  if (game.cazadorPendingShot) {
    const cazadorUid = game.cazadorPendingShot;
    const isMyShot = cazadorUid === user.uid;
    const cazadorPlayer = (game.players ?? []).find(p => p.uid === cazadorUid);
    const targets = (game.players ?? []).filter(p => p.isAlive && p.uid !== cazadorUid);
    return (
      <div className="min-h-screen w-full text-white flex flex-col items-center justify-center p-6 relative"
        style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/85" />
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="text-7xl mb-4">🏹</div>
          {isMyShot ? (
            <>
              <h2 className="text-3xl font-bold mb-2 text-red-400">¡Última bala!</h2>
              <p className="text-white/60 mb-8">Estás muriendo... pero puedes llevarte a alguien contigo.</p>
              <div className="space-y-3">
                {targets.map(p => (
                  <button key={p.uid} onClick={() => applyCazadorShot(p.uid)}
                    className="w-full flex items-center gap-3 bg-red-900/30 border border-red-500/40 rounded-xl p-4 hover:bg-red-900/60 transition-all text-left">
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold">
                      {p.photoURL ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" /> : <span>{p.name[0]}</span>}
                    </div>
                    <span className="font-semibold">{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold mb-2 text-red-400">¡El Cazador dispara!</h2>
              <p className="text-white/60 mb-4">
                <span className="text-white font-semibold">{cazadorPlayer?.name ?? 'El Cazador'}</span> agoniza y apunta su última bala...
              </p>
              <div className="animate-pulse text-5xl mt-4">💀</div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (game.phase === 'roleReveal' || !game.roles) {
    return (
      <RoleReveal
        game={game} myRole={myRole} me={me}
        onReady={advanceFromRoleReveal}
        isHost={game.hostUid === user.uid}
        gameId={gameId} userId={user.uid}
      />
    );
  }

  if (game.phase === 'ended') {
    return (
      <EndGame
        game={game}
        myRole={myRole}
        myUid={user?.uid}
        isHost={game.hostUid === user?.uid}
        hostInGame={(game.players ?? []).some((p: Player) => p.uid === game.hostUid)}
        winners={game.winners ?? null}
        winMessage={game.winMessage ?? ''}
        onPlayAgain={() => router.push('/')}
        onPlayAgainSameRoom={async () => {
          if (!user) return;
          const amHost = game.hostUid === user.uid;
          const hostStillHere = (game.players ?? []).some((p: Player) => p.uid === game.hostUid);
          // Only allow if I'm the host, OR the host has left
          if (!amHost && hostStillHere) return;

          const newHostUid = user.uid;
          const newHostName = user.displayName || user.email?.split('@')[0] || me?.name || 'Jugador';

          // Restore all players to alive; give crown to new host
          const resetPlayers = (game.players ?? []).map((p: Player) => ({
            ...p,
            isAlive: true,
            role: null,
            isHost: p.uid === newHostUid,
          }));

          await updateDoc(doc(db, 'games', gameId), {
            phase: 'lobby',
            roundNumber: 0,
            hostUid: newHostUid,
            hostName: newHostName,
            roles: {},
            nightActions: {},
            nightSubmissions: {},
            dayVotes: {},
            eliminatedHistory: [],
            winners: null,
            winMessage: '',
            lastVictim: null,
            bearGrowl: false,
            profetaReveal: null,
            players: resetPlayers,
          });

          // Push notification to all non-host real players
          const playerUids = (game.players ?? [])
            .filter((p: Player) => !p.isAI && p.uid !== newHostUid)
            .map((p: Player) => p.uid);
          if (playerUids.length > 0) {
            sendPushToMany(playerUids, {
              title: '⚔️ ¡Revancha en El Pueblo Duerme!',
              body: `${newHostName} ha iniciado una nueva partida. ¡Vuelve y venga!`,
              url: `/game/${gameId}`,
              tag: `rematch-${gameId}`,
            }).catch(() => {});
          }
        }}
      />
    );
  }

  if (game.phase === 'night') {
    if (showDayTransition) {
      return (
        <DayTransition
          game={game}
          gameId={gameId}
          userId={user.uid}
          userName={user.displayName || user.email?.split('@')[0] || me?.name || 'Jugador'}
          eliminatedName={dayTransitionData.eliminatedName}
          eliminatedRole={dayTransitionData.eliminatedRole}
          eliminatedUid={dayTransitionData.eliminatedUid}
          onDone={() => { setShowDayTransition(false); nightStartedAtRef.current = Date.now(); }}
        />
      );
    }
    return (
      <div className="relative">
        {hostAbsent && (
          <div className="fixed top-0 inset-x-0 z-50 bg-red-900/90 border-b border-red-600 text-white text-sm text-center py-2 px-4">
            ⚠️ El anfitrión se ha desconectado. La partida avanzará automáticamente o se reasignará el anfitrión en breve.
          </div>
        )}
        <NightPhase
          game={game} gameId={gameId}
          myRole={myRole ?? 'Aldeano'} me={me}
          userId={user.uid}
          userName={user.displayName || user.email?.split('@')[0] || me?.name || 'Jugador'}
          isHost={game.hostUid === user.uid}
          onSubmitAction={submitNightAction}
        />
      </div>
    );
  }

  if (game.phase === 'day') {
    if (showNightReveal) {
      return (
        <NightTransition
          game={game}
          gameId={gameId}
          userId={user.uid}
          userName={user.displayName || user.email?.split('@')[0] || me?.name || 'Jugador'}
          victimName={nightRevealData.victimName}
          victimRole={nightRevealData.victimRole}
          victimUid={nightRevealData.victimUid}
          onDone={() => {
            setShowNightReveal(false);
            if (!game.currentEvent) {
              if (game.hostUid === user.uid) {
                updateDoc(doc(db, 'games', gameId), { dayStartedAt: Date.now() }).catch(() => {});
              }
              interruptWith(AUDIO_FILES.debatesOpen, AUDIO_FILES.debateAmbient);
            }
          }}
        />
      );
    }
    if (showChaosEvent && game.currentEvent) {
      return (
        <ChaosEventScreen
          event={game.currentEvent}
          round={game.roundNumber ?? 1}
          onDone={() => {
            setShowChaosEvent(false);
            if (game.hostUid === user.uid) {
              updateDoc(doc(db, 'games', gameId), { dayStartedAt: Date.now() }).catch(() => {});
            }
            interruptWith(AUDIO_FILES.debatesOpen, AUDIO_FILES.debateAmbient);
          }}
        />
      );
    }
    return (
      <div className="relative">
        <NarratorBroadcast broadcast={game.narratorBroadcast ?? null} />
        {deathQueue.length > 0 && (
          <DeathOverlay deaths={deathQueue} onDone={() => setDeathQueue([])} />
        )}
        <MomentBanner moment={currentMoment} onDone={() => { setCurrentMoment(null); showNextMoment(); }} />
        {hostAbsent && (
          <div className="fixed top-0 inset-x-0 z-50 bg-red-900/90 border-b border-red-600 text-white text-sm text-center py-2 px-4">
            ⚠️ El anfitrión se ha desconectado. La partida avanzará automáticamente o se reasignará el anfitrión en breve.
          </div>
        )}
        <DayPhase
          game={game} gameId={gameId}
          myRole={myRole ?? 'Aldeano'} me={me}
          userId={user.uid}
          userName={user.displayName || user.email?.split('@')[0] || me?.name || 'Jugador'}
          isHost={game.hostUid === user.uid}
          onVote={submitDayVote}
          onJuezSecondVote={juezCallSecondVote}
          onAlborotadoraFight={alborotadoraChooseFight}
          votesFromSub={votesFromSub}
          onTimerEnd={() => {
            if (game.hostUid === user.uid) {
              processDayVotes(votesFromSub);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f] text-white">
      <Loader2 className="h-8 w-8 animate-spin text-white/40" />
    </div>
  );
}
