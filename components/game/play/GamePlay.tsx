'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import {
  doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp,
  query, orderBy, limit,
} from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { assignRoles, checkWinCondition, ROLES, ROLE_SUBMISSION_KEY } from './roles';
import { RoleReveal } from './RoleReveal';
import { NightPhase } from './NightPhase';
import { DayPhase } from './DayPhase';
import { EndGame } from './EndGame';
import { NightTransition } from './NightTransition';
import { DayTransition } from './DayTransition';
import { useNarrator, NARRATIONS } from '@/hooks/useNarrator';

export interface Player {
  uid: string;
  name: string;
  photoURL: string;
  isHost: boolean;
  isAlive: boolean;
  role: string | null;
  isAI?: boolean;
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
}

export function GamePlay({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleRevealDone, setRoleRevealDone] = useState(false);
  const [showNightReveal, setShowNightReveal] = useState(false);
  const [nightRevealData, setNightRevealData] = useState<{ victimName: string | null; victimRole: string | null }>({ victimName: null, victimRole: null });
  const [showDayTransition, setShowDayTransition] = useState(false);
  const [dayTransitionData, setDayTransitionData] = useState<{ eliminatedName: string | null; eliminatedRole: string | null }>({ eliminatedName: null, eliminatedRole: null });
  const [fantasmaMsg, setFantasmaMsg] = useState('');
  const [fantasmaTarget, setFantasmaTarget] = useState('');
  const aiChatSentRound = useRef<number>(-1);
  const aiNightSubmittedRound = useRef<number>(-1);
  const aiDayVotedRound = useRef<number>(-1);
  const wolfChatLastProcessed = useRef<string>('');
  const prevPhase = useRef<string | null>(null);
  const processingDayRef = useRef(false);
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
    return () => unsub();
  }, [gameId, router]);

  useEffect(() => {
    if (!game) return;
    const phase = game.phase;

    if (prevPhase.current === null && phase === 'roleReveal') {
      play(AUDIO_FILES.introEpic);
    }
    if (prevPhase.current === 'roleReveal' && phase === 'night') {
      interruptWith(AUDIO_FILES.gameStart, AUDIO_FILES.nightStart);
    }
    if (prevPhase.current === 'night' && phase === 'day') {
      processingNightRef.current = false;
      const victimUid = (game as any).dayEliminatedUid ?? null;
      const victim = victimUid ? (game.players ?? []).find((p: any) => p.uid === victimUid) : null;
      const victimRole = victim ? (game.roles?.[victim.uid] ?? null) : null;
      setNightRevealData({ victimName: victim?.name ?? null, victimRole });
      setShowNightReveal(true);
    }
    if (prevPhase.current === 'day' && phase === 'night') {
      processingDayRef.current = false;
      const history = game.eliminatedHistory ?? [];
      const lastElim = history[history.length - 1];
      setDayTransitionData({ eliminatedName: lastElim?.name ?? null, eliminatedRole: lastElim?.role ?? null });
      setShowDayTransition(true);
    }
    if (prevPhase.current === 'roleReveal' && phase === 'night') {
      nightStartedAtRef.current = Date.now();
    }
    prevPhase.current = phase ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber]);

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

    updateDoc(doc(db, 'games', gameId), {
      roles: assigned,
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
    }).catch((e: any) => console.error('assignRoles error:', e));
  }, [game, user, gameId]);

  const advanceFromRoleReveal = useCallback(async () => {
    if (!game) return;
    setRoleRevealDone(true);
    if (game.hostUid !== user?.uid) return;
    try {
      await updateDoc(doc(db, 'games', gameId), { phase: 'night', nightActions: {}, nightSubmissions: {} });
    } catch (e) { console.error('advanceFromRoleReveal error:', e); }
  }, [game, user, gameId]);

  const submitNightAction = useCallback(async (action: Record<string, unknown>) => {
    if (!game || !user) return;
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
        const target = notWolf.filter(p => !p.isAI)[0] ?? notWolf[0];
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
      done('hadabuscadora', has('Hada Buscadora') && !game.hadaLinked);

    if (allDone && !processingNightRef.current) {
      processingNightRef.current = true;
      processNight();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.nightSubmissions, game?.phase]);

  async function processNight() {
    if (!game) return;
    const actions = game.nightActions ?? {};
    const roles = game.roles ?? {};
    let players = [...(game.players ?? [])];
    const aliveBeforeNight = new Set(players.filter(p => p.isAlive).map(p => p.uid));
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

    // ── Determine protection ───────────────────────────────────────────────

    const ancianaExiledUid = actions.ancianaTarget ?? null;
    const guardianProtects = actions.guardianTarget ?? null;
    const sacerdoteProtects = actions.sacerdoteTarget ?? null;
    const doctorProtects = actions.doctorTarget ?? null;

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
    let wolfTarget2: string | null = game.criaLoboRage ? (actions.wolfTarget2 ?? null) : null;

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
    if (actions.brujaTarget && !brujaFoundVidente) {
      const brujaPlayer = players.find(p => newRoles[p.uid] === 'Bruja');
      const target = players.find(p => p.uid === actions.brujaTarget);
      if (target && newRoles[actions.brujaTarget] === 'Vidente') {
        brujaFoundVidente = true;
        brujaProtectedUid = brujaPlayer?.uid ?? null;
        // wolves will be notified via brujaFoundVidente in GameState
      }
    }

    // ── Hada Buscadora finds Hada Durmiente ──────────────────────────────
    if (actions.hadaBuscadoraTarget && !hadaLinked) {
      if (newRoles[actions.hadaBuscadoraTarget] === 'Hada Durmiente') {
        hadaLinked = true;
        // Now their win condition is "last ones standing together"
      }
    }

    // ── Anciana Líder exile info (used during night processing - ability blocked) ──
    // (Already stored in ancianaExiledUid; any role whose uid === ancianaExiledUid
    //  had their action blocked — we skip processing it in the done check)

    // ── Doctor / Ángel Resucitador ─────────────────────────────────────────
    if (actions.angelResucitarTarget && !angelResucitadorUsed) {
      const dead = players.find(p => p.uid === actions.angelResucitarTarget && !p.isAlive);
      if (dead) {
        players = players.map(p => p.uid === actions.angelResucitarTarget ? { ...p, isAlive: true } : p);
        history = history.filter(h => h.uid !== actions.angelResucitarTarget);
        if (dayEliminatedUid === actions.angelResucitarTarget) dayEliminatedUid = null;
        angelResucitadorUsed = true;
      }
    }

    // ── Silenciadora ───────────────────────────────────────────────────────
    if (actions.silenciadoraTarget && players.find(p => p.uid === actions.silenciadoraTarget && p.isAlive)) {
      silencedPlayers.push(actions.silenciadoraTarget);
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
    if (actions.flautistaTargets?.length) {
      for (const uid of actions.flautistaTargets) {
        if (!enchanted.includes(uid)) enchanted.push(uid);
      }
    }

    // ── Seer reveal ───────────────────────────────────────────────────────
    let seerReveal = game.seerReveal ?? null;
    if (actions.seerTarget) {
      const targetRole = newRoles[actions.seerTarget];
      seerReveal = {
        targetUid: actions.seerTarget,
        isWolf: targetRole === 'Lobo' || targetRole === 'Lobo Blanco' || targetRole === 'Cría de Lobo' || targetRole === 'Licántropo',
      };
    }

    // Profeta reveal
    let profetaReveal = null;
    if (actions.profetaTarget) {
      profetaReveal = {
        targetUid: actions.profetaTarget,
        isWolf: newRoles[actions.profetaTarget] === 'Lobo' || newRoles[actions.profetaTarget] === 'Lobo Blanco' || newRoles[actions.profetaTarget] === 'Licántropo',
      };
    }

    // ── Vigía spy ────────────────────────────────────────────────────────
    if (actions.vigiaActivate && !vigiaUsed) {
      vigiaUsed = true;
      // If wolves attacked vigía tonight → vigía dies; otherwise → vigía knows wolves
      const vigiaPlayer = players.find(p => newRoles[p.uid] === 'Vigía');
      if (vigiaPlayer) {
        const vigiaWasKilledThisNight = !players.find(p => p.uid === vigiaPlayer.uid)?.isAlive &&
          aliveBeforeNight.has(vigiaPlayer.uid);
        if (vigiaWasKilledThisNight) {
          // Vigía already dead - failed
          vigiaKnowsWolves = false;
        } else {
          vigiaKnowsWolves = true;
        }
      }
    }

    // ── Banshee points ─────────────────────────────────────────────────────
    if (actions.bansheePrediction) {
      const predictedDead = !players.find(p => p.uid === actions.bansheePrediction)?.isAlive &&
        aliveBeforeNight.has(actions.bansheePrediction);
      if (predictedDead) {
        bansheePoints += 1;
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

    // ── Lovers cascade ────────────────────────────────────────────────────
    const lovers = game.lovers;
    if (lovers) {
      const [l1, l2] = lovers;
      const l1Dead = !players.find(p => p.uid === l1)?.isAlive && aliveBeforeNight.has(l1);
      const l2Dead = !players.find(p => p.uid === l2)?.isAlive && aliveBeforeNight.has(l2);
      if (l1Dead && players.find(p => p.uid === l2 && p.isAlive)) { applyDeath(l2); }
      if (l2Dead && players.find(p => p.uid === l1 && p.isAlive)) { applyDeath(l1); }
    }

    // ── Gemela cascade ────────────────────────────────────────────────────
    const gemelas = players.filter(p => newRoles[p.uid] === 'Gemela' || newRoles[p.uid] === 'Gemelas');
    if (gemelas.length === 2) {
      const [g1, g2] = gemelas;
      const g1Dead = !players.find(p => p.uid === g1.uid)?.isAlive;
      const g2Dead = !players.find(p => p.uid === g2.uid)?.isAlive;
      if (g1Dead && aliveBeforeNight.has(g1.uid) && players.find(p => p.uid === g2.uid && p.isAlive)) { applyDeath(g2.uid); }
      if (g2Dead && aliveBeforeNight.has(g2.uid) && players.find(p => p.uid === g1.uid && p.isAlive)) { applyDeath(g1.uid); }
    }

    // ── Virginia Woolf fate cascade ───────────────────────────────────────
    for (const [woolUid, linkedUid] of Object.entries(virginiawoolFate)) {
      const woolDead = !players.find(p => p.uid === woolUid)?.isAlive;
      if (woolDead && aliveBeforeNight.has(woolUid) && players.find(p => p.uid === linkedUid && p.isAlive)) {
        applyDeath(linkedUid);
      }
    }

    // ── Ladrón: steal role (round 1) ─────────────────────────────────────
    if (actions.ladronTarget && round === 1) {
      const ladron = players.find(p => newRoles[p.uid] === 'Ladrón' && p.isAlive);
      const target = players.find(p => p.uid === actions.ladronTarget && p.isAlive);
      if (ladron && target) {
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
    if (actions.espiaActivate && !espiaUsed) espiaUsed = true;

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

    // ── Win check ─────────────────────────────────────────────────────────
    const winResult = checkWinCondition(players, newRoles, {
      enchanted, round, perroLoboChoices,
      cultMembers, vampiroKills, pescadorBoat, hadaLinked,
    });

    // Banshee wins at 2 points
    const bansheeWin = bansheePoints >= 2;
    const finalWinner = bansheeWin ? 'banshee' : winResult.winner;
    const finalMsg = bansheeWin ? '¡La Banshee predijo 2 muertes correctamente y gana sola!' : winResult.message;

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
        hechiceraLifeUsed,
        hechiceraPoisonUsed,
        fantasmaPending,
        fantasmaUsed,
        phase: finalWinner ? 'ended' : 'day',
        winners: finalWinner ?? null,
        winMessage: finalMsg ?? null,
        nightActions: {},
        nightSubmissions: {},
        dayVotes: {},
        dayStartedAt: Date.now(),
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
    // Sirena: if voter is sirena-linked, force vote to sirena's target
    let actualTarget = targetUid;
    if (game.sirenaLinked === user.uid && game.sirenaUid) {
      // Sirena-linked player must vote same as Sirena
      actualTarget = (game.dayVotes ?? {})[game.sirenaUid] ?? targetUid;
    }
    try {
      await updateDoc(doc(db, 'games', gameId), { [`dayVotes.${user.uid}`]: actualTarget });
    } catch (e) { console.error('submitDayVote error:', e); }
  }, [user, game, gameId]);

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

  // Host auto-votes for AI players during day
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;

    const round = game.roundNumber ?? 1;
    if (aiDayVotedRound.current === round) return;

    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const aiAlive = alivePlayers.filter(p => p.isAI);
    if (aiAlive.length === 0) return;

    const MIN_DEBATE_DELAY = 30000;
    const elapsed = game.dayStartedAt ? Date.now() - game.dayStartedAt : 0;
    const waitMs = Math.max(500, MIN_DEBATE_DELAY - elapsed);

    const dayTimer = setTimeout(() => {
      if (aiDayVotedRound.current === round) return;
      aiDayVotedRound.current = round;

      const currentAlivePlayers = (game.players ?? []).filter(p => p.isAlive);
      const currentAiAlive = currentAlivePlayers.filter(p => p.isAI);
      const currentDayVotes = (game.dayVotes ?? {}) as Record<string, string>;
      const voteBanned = game.voteBanned ?? [];
      const updates: Record<string, unknown> = {};
      let needsUpdate = false;

      for (const ai of currentAiAlive) {
        if (currentDayVotes[ai.uid] || voteBanned.includes(ai.uid)) continue;
        const candidates = currentAlivePlayers.filter(p => p.uid !== ai.uid);
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          updates[`dayVotes.${ai.uid}`] = pick.uid;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        updateDoc(doc(db, 'games', gameId), updates).catch((e: any) => console.error('AI day vote error:', e));
      }
    }, waitMs);

    return () => clearTimeout(dayTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, game?.dayStartedAt]);

  // Host processes day votes when all alive players voted
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;

    const dayVotes = (game.dayVotes ?? {}) as Record<string, string>;
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const voteBanned = game.voteBanned ?? [];
    const eligible = alivePlayers.filter(p => !voteBanned.includes(p.uid));
    const votedCount = eligible.filter(p => !!dayVotes[p.uid]).length;

    if (votedCount >= eligible.length && eligible.length > 0) {
      processDayVotes(dayVotes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.dayVotes, game?.phase]);

  async function processDayVotes(dayVotes: Record<string, string>) {
    if (!game) return;
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

    // Apply vote ban
    const voteBanned = game.voteBanned ?? [];
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

    let maxVotes = 0;
    let eliminated: string | null = null;
    let isTie = false;
    for (const [uid, count] of Object.entries(tally)) {
      if (count > maxVotes) { maxVotes = count; eliminated = uid; isTie = false; }
      else if (count === maxVotes && maxVotes > 0) { isTie = true; }
    }
    if (isTie) eliminated = null;

    // Chivo Expiatorio: dies on tie
    let chivoPendingChoice: string | null = null;
    let players = [...(game.players ?? [])];
    const history = [...(game.eliminatedHistory ?? [])];
    const enchanted = [...(game.enchanted ?? [])];

    if (isTie) {
      const chivoPlayer = players.find(p => p.isAlive && newRoles[p.uid] === 'Chivo Expiatorio');
      if (chivoPlayer) { eliminated = chivoPlayer.uid; chivoPendingChoice = chivoPlayer.uid; }
    }

    // Alborotadora fight: both fighters die
    const alborotadoraFight = game.alborotadoraFight;
    if (alborotadoraFight) {
      for (const fightUid of alborotadoraFight) {
        const fighter = players.find(p => p.uid === fightUid && p.isAlive);
        if (fighter) {
          players = players.map(p => p.uid === fightUid ? { ...p, isAlive: false } : p);
          history.push({ uid: fighter.uid, name: fighter.name, role: newRoles[fighter.uid] ?? 'Aldeano', round });
          if (newRoles[fightUid] === 'Fantasma' && !fantasmaUsed.includes(fightUid)) {
            fantasmaPending.push(fightUid);
          }
        }
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
      eliminatedByVote: true,
      perroLoboChoices,
      cultMembers: game.cultMembers ?? [],
      vampiroKills: game.vampiroKills ?? 0,
      pescadorBoat: game.pescadorBoat ?? [],
      hadaLinked: game.hadaLinked ?? false,
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

    const finalWinner = verdugosWin ? 'verdugo' : winResult.winner;
    const finalMsg = verdugosWin ? verdugosWinMsg : winResult.message;

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

  // Juez: calls a second vote during day phase
  const juezCallSecondVote = useCallback(async () => {
    if (!game) return;
    await updateDoc(doc(db, 'games', gameId), { dayVotes: {}, juezUsed: true })
      .catch((e: unknown) => console.error('juezSecondVote error:', e));
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
    for (const ghostUid of pending) {
      const ghostPlayer = (game.players ?? []).find(p => p.uid === ghostUid);
      if (!ghostPlayer?.isAI) continue;
      const alive = (game.players ?? []).filter(p => p.isAlive);
      if (alive.length > 0) {
        const target = alive[Math.floor(Math.random() * alive.length)];
        setTimeout(() => {
          fantasmaSendMessage(ghostUid, target.uid, 'Soy un fantasma. Confiad en el pueblo y eliminad a los lobos.');
        }, 3000);
      }
    }
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
        game={game} myRole={myRole} myUid={user?.uid}
        winners={game.winners ?? null}
        winMessage={game.winMessage ?? ''}
        onPlayAgain={() => router.push('/')}
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
          onDone={() => { setShowDayTransition(false); nightStartedAtRef.current = Date.now(); }}
        />
      );
    }
    return (
      <NightPhase
        game={game} gameId={gameId}
        myRole={myRole ?? 'Aldeano'} me={me}
        userId={user.uid}
        userName={user.displayName || user.email?.split('@')[0] || me?.name || 'Jugador'}
        isHost={game.hostUid === user.uid}
        onSubmitAction={submitNightAction}
      />
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
          onDone={() => {
            setShowNightReveal(false);
            if (game.hostUid === user.uid) {
              updateDoc(doc(db, 'games', gameId), { dayStartedAt: Date.now() }).catch(() => {});
            }
            interruptWith(AUDIO_FILES.debatesOpen, AUDIO_FILES.debateAmbient);
          }}
        />
      );
    }
    return (
      <DayPhase
        game={game} gameId={gameId}
        myRole={myRole ?? 'Aldeano'} me={me}
        userId={user.uid}
        userName={user.displayName || user.email?.split('@')[0] || me?.name || 'Jugador'}
        isHost={game.hostUid === user.uid}
        onVote={submitDayVote}
        onJuezSecondVote={juezCallSecondVote}
        onAlborotadoraFight={alborotadoraChooseFight}
        onTimerEnd={() => {
          if (game.hostUid === user.uid) {
            processDayVotes((game.dayVotes ?? {}) as Record<string, string>);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f] text-white">
      <Loader2 className="h-8 w-8 animate-spin text-white/40" />
    </div>
  );
}
