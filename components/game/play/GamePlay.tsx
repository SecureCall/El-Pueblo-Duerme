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
import { type BotType, FALLBACK_BOT_MESSAGES, BOT_NARRATOR_SPOTLIGHTS } from '@/lib/bots/botSystem';
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
import { requestNightAction } from '@/lib/game/nightActions';
import { requestResolveNight } from '@/lib/game/resolveNight';
import { requestResolveDay } from '@/lib/game/resolveDay';
import { requestStartNight } from '@/lib/game/startNight';
import { requestNarratorBroadcast } from '@/lib/game/narratorBroadcast';
import { requestHostTakeover } from '@/lib/game/hostTakeover';

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
    seerTarget2?: string;
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
  seerReveal2?: { targetUid: string; isWolf: boolean } | null;
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
  revealDeadResult?: { uid: string; name: string; role: string } | null;
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
  const wolfChatLastProcessed = useRef<string>('');
  const prevPhase = useRef<string | null>(null);
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
      const myRole = game.roles?.[myUid ?? ''];
      const wolfTeamUids = new Set(Object.keys(game.wolfTeam ?? {}));
      const isWolfSide = myUid ? wolfTeamUids.has(myUid) : false;
      const w = game.winners ?? null;
      const iWon = myUid && myRole && w ? (() => {
        if (w === 'village') return !isWolfSide;
        if (w === 'wolves') return isWolfSide;
        if (w === 'flautista') return myRole === 'Flautista';
        if (w === 'angel') return myRole === 'Ángel';
        if (w === 'picaro') return myRole === 'Pícaro';
        if (w === 'vampiro') return myRole === 'Vampiro';
        if (w === 'ebrio') return myRole === 'Hombre Ebrio';
        if (w === 'verdugo') return myRole === 'Verdugo';
        if (w === 'lider_culto') return myRole === 'Líder del Culto';
        if (w === 'pescador') return myRole === 'Pescador';
        if (w === 'lobo_blanco') return myRole === 'Lobo Blanco';
        if (w === 'banshee') return myRole === 'Banshee';
        if (w === 'hadas') return myRole === 'Hada Buscadora' || myRole === 'Hada Durmiente';
        if (w === 'lovers') return (game.lovers ?? []).includes(myUid);
        return false;
      })() : false;
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

  // ── Server-authoritative day resolver trigger ───────────────────────────
  const dayResolveInFlightRef = useRef(false);
  useEffect(() => {
    if (!game || !user || game.phase !== 'day') return;
    const me = (game.players ?? []).find(p => p.uid === user.uid);
    if (!me?.isAlive) return;
    const attempt = async () => {
      if (dayResolveInFlightRef.current) return;
      dayResolveInFlightRef.current = true;
      try {
        await requestResolveDay(gameId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message !== 'INCOMPLETE_DAY') console.warn('[DayResolution] server trigger did not commit:', message);
      } finally {
        dayResolveInFlightRef.current = false;
      }
    };
    void attempt();
    const timer = setInterval(() => { void attempt(); }, 2000);
    return () => clearInterval(timer);
  }, [game?.phase, game?.roundNumber, game?.phaseEndsAt, game?.players, user?.uid, gameId]);

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

        console.warn('[Host absent] Requesting server-authoritative host takeover');
        await requestHostTakeover(gameId);
      } catch { /* ignore */ }
    };

    const id = setInterval(check, 30000);
    check();
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.hostUid, game?.phase, user?.uid]);


  const advanceFromRoleReveal = useCallback(async () => {
    if (!game) return;
    setRoleRevealDone(true);
    if (game.hostUid !== user?.uid) return;
    if (!isValidTransition(game.phase, 'night')) { console.warn(`[FSM] Blocked roleReveal→night (current: ${game.phase})`); return; }
    try {
      await requestStartNight(gameId);
    } catch (e) { console.error('advanceFromRoleReveal error:', e); }
  }, [game, user, gameId]);

  const submitNightAction = useCallback(async (action: Record<string, unknown>) => {
    if (!game || !user) return;
    if (game.phase !== 'night') { console.warn('[FSM] submitNightAction rejected — not night phase'); return; }
    const me = game.players?.find(p => p.uid === user.uid);
    if (!me?.isAlive) { console.warn('[FSM] submitNightAction rejected — player not alive'); return; }

    try {
      await requestNightAction(gameId, action);
    } catch (e) { console.error('submitNightAction error:', e); }
  }, [game, user, gameId]);

  // AI night decisions are generated and persisted by the server. The browser only triggers the server endpoint.
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid || game.phase !== 'night') return;

    const timer = setTimeout(async () => {
      try {
        const idToken = await user.getIdToken();
        await fetch('/api/ai-night', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ gameId }),
        });
      } catch (error) {
        console.warn('[AI night] server trigger failed:', error);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [game?.phase, game?.roundNumber, game?.hostUid, user?.uid, gameId]);

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
        const data: { messages?: { uid: string; name: string; text: string }[]; submitted?: boolean; resolved?: boolean } = await res.json();

        const msgs = data.messages ?? [];
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i];
          await new Promise(r => setTimeout(r, 1500 + i * (1000 + Math.random() * 2000)));
          // AI wolf messages are persisted by the server endpoint; never trust the browser with bot identity.
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
      // Mínimo 20s de noche desde nightStartedAt (los lobos tienen el chat para coordinarse)
      const MIN_NIGHT_MS = 20000;
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

  // ── Anti-softlock: force processNight when 55s night timer expires ────────
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'night') return;
    const NIGHT_MS = 58000; // 55s night + 3s grace
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
    if (!game || game.phase !== 'night' || processingNightRef.current === false) {
      processingNightRef.current = false;
      return;
    }
    try {
      await requestResolveNight(gameId);
    } catch (e) {
      processingNightRef.current = false;
      console.error('processNight error:', e);
    }
  }

  const submitDayVote = useCallback(async (targetUid: string) => {
    if (!user || !game) return;
    if (game.phase !== 'day' && game.phase !== 'voting') { console.warn('[FSM] submitDayVote rejected — not day/voting phase'); return; }
    const me = game.players?.find(p => p.uid === user.uid);
    if (!me?.isAlive) { console.warn('[FSM] submitDayVote rejected — player not alive'); return; }
    const round = game.roundNumber ?? 1;
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/day-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ gameId, uid: user.uid, target: targetUid, round }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `day-vote ${response.status}`);
      }
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
    const payload = { gameId };
    fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(payload),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber]);


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

        const interruptTypes: Array<'warning' | 'suspicion' | 'chaos' | 'irony' | 'accusation'> =
          ['warning', 'suspicion', 'chaos', 'irony', 'accusation'];
        const interruptType = interruptTypes[Math.floor(Math.random() * interruptTypes.length)];

        try {
          const idToken = await user.getIdToken();
          const res = await fetch('/api/narrator', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ gameId, event: 'day_interrupt', interruptType }),
          });
          const data = await res.json();
          if (data.narration) {
            requestNarratorBroadcast(gameId, data.narration, interruptType).catch(() => {});
          }
        } catch { /* silencioso */ }
      }, waitMs);
    };

    const timer = schedule();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, game?.dayStartedAt]);



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

  // Cazador fires last shot
  const applyCazadorShot = useCallback(async (targetUid: string) => {
    if (!user) return;
    try { await requestCazadorShot(user, gameId, targetUid); }
    catch (e) { console.error('cazadorShot error:', e); }
  }, [user, gameId, interruptWith]);

  // Chivo Expiatorio: after dying in tie, chooses who can't vote next round
  const applyChivoChoice = useCallback(async (bannedUid: string | null) => {
    if (!user || !bannedUid) return;
    try { await requestChivoChoice(user, gameId, bannedUid); }
    catch (e) { console.error('chivoChoice error:', e); }
  }, [user, gameId]);

  // Juez: calls a second vote during day phase (reset timer to give 30s to re-vote)
  const juezCallSecondVote = useCallback(async () => {
    if (!user) return;
    try { await requestJuezSecondVote(user, gameId); }
    catch (e) { console.error('juezSecondVote error:', e); }
  }, [user, gameId]);

  // Alborotadora: choose 2 players to fight
  const alborotadoraChooseFight = useCallback(async (p1: string, p2: string) => {
    if (!user) return;
    try { await requestAlborotadoraFight(user, gameId, p1, p2); }
    catch (e) { console.error('alborotadoraFight error:', e); }
  }, [user, gameId]);

  // Fantasma: send anonymous message
  const fantasmaSendMessage = useCallback(async (senderUid: string, targetUid: string, message: string) => {
    if (!user || !message.trim() || !targetUid) return;
    try { await requestFantasmaMessage(user, gameId, targetUid, message); }
    catch (e) { console.error('fantasmaMessage error:', e); }
  }, [user, gameId]);

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
        return;
      }
    }, 2500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.cazadorPendingShot]);

  // Anti-softlock: Cazador humano desconectado → auto-disparo al azar tras 90s
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (!game.cazadorPendingShot) return;
    const cazadorUid = game.cazadorPendingShot;
    const cazador = (game.players ?? []).find(p => p.uid === cazadorUid);
    if (cazador?.isAI) return; // los AI ya tienen su propio handler
    const timer = setTimeout(() => {
      const alive = (game.players ?? []).filter(p => p.isAlive && p.uid !== cazadorUid);
      if (alive.length > 0) {
        applyCazadorShot(alive[Math.floor(Math.random() * alive.length)].uid);
      } else {
        return;
      }
    }, 90_000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.cazadorPendingShot]);

  // Anti-softlock: Chivo Expiatorio humano desconectado → auto-resuelve sin banear a nadie tras 60s
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (!game.chivoPendingChoice) return;
    const chivoUid = game.chivoPendingChoice;
    const chivo = (game.players ?? []).find(p => p.uid === chivoUid);
    if (chivo?.isAI) return; // los AI ya tienen su propio handler
    const timer = setTimeout(() => {
      applyChivoChoice(null);
    }, 60_000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.chivoPendingChoice]);

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
          <button
            onClick={() => {
              // Passing is resolved by the authoritative server endpoint.
              requestFantasmaMessage(user, gameId, fantasmaTarget, ' ').catch(() => {});
            }}
            className="mt-2 w-full bg-transparent border border-white/15 text-white/40 hover:text-white/60 text-sm py-2 rounded-xl transition-colors"
          >
            Pasar (no enviar mensaje)
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
            // Limpiar todos los estados de rol de la partida anterior
            loversUids: null,
            twinUids: null,
            enchanted: [],
            cursed: [],
            vampirizados: [],
            liderCultoMembers: [],
            virginiawoolTarget: null,
            vigiaUsed: false,
            angelResucitadorUsed: false,
            hadaLinked: false,
            fantasmaPending: [],
            fantasmaUsed: [],
            voteBanned: [],
            noExileActive: false,
            currentEvent: null,
            nightKilledUids: [],
            espiaUsed: false,
            doubleSeerActive: false,
            doubleExecution: false,
            bansheePredictionUid: null,
            cazadorPendingShot: null,
            chivoPendingChoice: null,
            silverwolf: false,
            criaLoboRage: false,
            narratorBroadcast: null,
            phaseEndsAt: null,
            dayStartedAt: null,
            nightStartedAt: null,
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
          onTimerEnd={() => {}}
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
