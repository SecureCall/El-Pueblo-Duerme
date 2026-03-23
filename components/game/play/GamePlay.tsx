'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import {
  doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp,
} from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { assignRoles, checkWinCondition, ROLES, ROLE_SUBMISSION_KEY } from './roles';
import { RoleReveal } from './RoleReveal';
import { NightPhase } from './NightPhase';
import { DayPhase } from './DayPhase';
import { EndGame } from './EndGame';
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
  antiguoHit?: string[];
  perroLoboChoices?: Record<string, 'wolves' | 'village'>;
  salvajeMentors?: Record<string, string>;
  bearGrowl?: boolean;
}

export function GamePlay({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleRevealDone, setRoleRevealDone] = useState(false);
  const aiChatSentRound = useRef<number>(-1);
  const prevPhase = useRef<string | null>(null);
  const { speak } = useNarrator();

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

  // Narrate vote results when transitioning from day back to night
  useEffect(() => {
    if (!game) return;
    const phase = game.phase;
    if (prevPhase.current === 'day' && phase === 'night') {
      const history = game.eliminatedHistory ?? [];
      const lastElim = history[history.length - 1];
      if (lastElim) {
        setTimeout(() => {
          speak(NARRATIONS.voteResult(lastElim.name), { rate: 0.82, pitch: 0.7 });
        }, 400);
      }
    }
    prevPhase.current = phase ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase]);

  // Host assigns roles on game start
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.roles && Object.keys(game.roles).length > 0) return;
    if (game.status !== 'playing') return;

    const assigned = assignRoles(game.players, game.wolves, game.specialRoles ?? []);
    const updatedPlayers = game.players.map(p => ({
      ...p,
      role: assigned[p.uid] ?? 'Aldeano',
    }));

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
      antiguoHit: [],
      perroLoboChoices: {},
      salvajeMentors: {},
    }).catch((e: any) => console.error('assignRoles error:', e));
  }, [game, user, gameId]);

  const advanceFromRoleReveal = useCallback(async () => {
    if (!game) return;
    setRoleRevealDone(true);
    if (game.hostUid !== user?.uid) return;
    try {
      await updateDoc(doc(db, 'games', gameId), {
        phase: 'night',
        nightActions: {},
        nightSubmissions: {},
      });
    } catch (e) {
      console.error('advanceFromRoleReveal error:', e);
    }
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

    // Lobo Blanco on even rounds also needs loboblanco submission
    if (myRole === 'Lobo Blanco' && (game.roundNumber ?? 1) % 2 === 0) {
      updates[`nightSubmissions.loboblanco`] = true;
    }

    try {
      await updateDoc(doc(db, 'games', gameId), updates);
    } catch (e) {
      console.error('submitNightAction error:', e);
    }
  }, [game, user, gameId]);

  // Host auto-submits AI players' night actions
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'night') return;

    const roles = game.roles ?? {};
    const subs = game.nightSubmissions ?? {};
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const aiPlayers = alivePlayers.filter(p => p.isAI);
    if (aiPlayers.length === 0) return;

    const updates: Record<string, unknown> = {};
    let needsUpdate = false;
    const round = game.roundNumber ?? 1;

    // AI Wolves
    const aiWolves = aiPlayers.filter(p => roles[p.uid] === 'Lobo' || roles[p.uid] === 'Lobo Blanco');
    if (aiWolves.length > 0 && !subs['wolves']) {
      const targets = alivePlayers.filter(p => roles[p.uid] !== 'Lobo' && roles[p.uid] !== 'Lobo Blanco' && !p.isAI);
      if (targets.length > 0) {
        updates['nightActions.wolfTarget'] = targets[Math.floor(Math.random() * targets.length)].uid;
      }
      updates['nightSubmissions.wolves'] = true;
      needsUpdate = true;
    }

    // AI Lobo Blanco (special action every 2 rounds)
    const aiLoboBlanco = aiPlayers.find(p => roles[p.uid] === 'Lobo Blanco');
    if (aiLoboBlanco && round % 2 === 0 && !subs['loboblanco']) {
      updates['nightSubmissions.loboblanco'] = true;
      needsUpdate = true;
    }

    // AI Vidente
    const aiSeer = aiPlayers.find(p => roles[p.uid] === 'Vidente');
    if (aiSeer && !subs['vidente']) {
      updates['nightSubmissions.vidente'] = true;
      needsUpdate = true;
    }

    // AI Profeta
    const aiProfeta = aiPlayers.find(p => roles[p.uid] === 'Profeta');
    if (aiProfeta && !subs['profeta']) {
      updates['nightSubmissions.profeta'] = true;
      needsUpdate = true;
    }

    // AI Bruja
    const aiWitch = aiPlayers.find(p => roles[p.uid] === 'Bruja');
    if (aiWitch && !subs['bruja']) {
      updates['nightSubmissions.bruja'] = true;
      needsUpdate = true;
    }

    // AI Cupido (night 1)
    const aiCupido = aiPlayers.find(p => roles[p.uid] === 'Cupido');
    if (aiCupido && !subs['cupido'] && round === 1) {
      const candidates = alivePlayers.filter(p => !p.isAI).slice(0, 2);
      if (candidates.length >= 2) updates['nightActions.cupidTargets'] = [candidates[0].uid, candidates[1].uid];
      updates['nightSubmissions.cupido'] = true;
      needsUpdate = true;
    }

    // AI Guardián
    const aiGuardian = aiPlayers.find(p => roles[p.uid] === 'Guardián');
    if (aiGuardian && !subs['guardian']) {
      const candidates = alivePlayers.filter(p => p.uid !== (game.guardianLastTarget ?? ''));
      if (candidates.length > 0) {
        updates['nightActions.guardianTarget'] = candidates[Math.floor(Math.random() * candidates.length)].uid;
      }
      updates['nightSubmissions.guardian'] = true;
      needsUpdate = true;
    }

    // AI Flautista
    const aiFlautista = aiPlayers.find(p => roles[p.uid] === 'Flautista');
    if (aiFlautista && !subs['flautista']) {
      const candidates = alivePlayers.filter(p => p.uid !== aiFlautista.uid && !(game.enchanted ?? []).includes(p.uid));
      const picks = candidates.sort(() => Math.random() - 0.5).slice(0, 2).map(p => p.uid);
      if (picks.length > 0) updates['nightActions.flautistaTargets'] = picks;
      updates['nightSubmissions.flautista'] = true;
      needsUpdate = true;
    }

    // AI Perro Lobo (night 1)
    const aiPerroLobo = aiPlayers.find(p => roles[p.uid] === 'Perro Lobo');
    if (aiPerroLobo && !subs['perrolo'] && round === 1) {
      const choice = Math.random() > 0.5 ? 'wolves' : 'village';
      updates['nightActions.perroLoboSide'] = choice;
      updates[`perroLoboChoices.${aiPerroLobo.uid}`] = choice;
      updates['nightSubmissions.perrolo'] = true;
      needsUpdate = true;
    }

    // AI Niño Salvaje (night 1)
    const aiSalvaje = aiPlayers.find(p => roles[p.uid] === 'Niño Salvaje');
    if (aiSalvaje && !subs['salvaje'] && round === 1) {
      const candidates = alivePlayers.filter(p => p.uid !== aiSalvaje.uid);
      if (candidates.length > 0) {
        const mentor = candidates[Math.floor(Math.random() * candidates.length)];
        updates['nightActions.salvajeMentor'] = mentor.uid;
        updates[`salvajeMentors.${aiSalvaje.uid}`] = mentor.uid;
      }
      updates['nightSubmissions.salvaje'] = true;
      needsUpdate = true;
    }

    // AI Sacerdote
    const aiSacerdote = aiPlayers.find(p => roles[p.uid] === 'Sacerdote');
    if (aiSacerdote && !subs['sacerdote']) {
      const candidates = alivePlayers.filter(p => p.uid !== aiSacerdote.uid);
      if (candidates.length > 0) {
        updates['nightActions.sacerdoteTarget'] = candidates[Math.floor(Math.random() * candidates.length)].uid;
      }
      updates['nightSubmissions.sacerdote'] = true;
      needsUpdate = true;
    }

    // AI Ladrón (night 1)
    const aiLadron = aiPlayers.find(p => roles[p.uid] === 'Ladrón');
    if (aiLadron && !subs['ladron'] && round === 1) {
      updates['nightSubmissions.ladron'] = true;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updateDoc(doc(db, 'games', gameId), updates).catch((e: any) => console.error('AI auto-submit error:', e));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.roundNumber, game?.nightSubmissions]);

  // Host processes night when all required submissions received
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'night') return;

    const subs = game.nightSubmissions ?? {};
    const roles = game.roles ?? {};
    const activePlayers = (game.players ?? []).filter(p => p.isAlive);
    const round = game.roundNumber ?? 1;

    const hasWolves = activePlayers.some(p => roles[p.uid] === 'Lobo');
    const hasSeer = activePlayers.some(p => roles[p.uid] === 'Vidente');
    const hasWitch = activePlayers.some(p => roles[p.uid] === 'Bruja');
    const hasCupido = activePlayers.some(p => roles[p.uid] === 'Cupido') && round === 1;
    const hasGuardian = activePlayers.some(p => roles[p.uid] === 'Guardián');
    const hasFlautista = activePlayers.some(p => roles[p.uid] === 'Flautista');
    const hasLoboBlanco = activePlayers.some(p => roles[p.uid] === 'Lobo Blanco');
    const hasPerroLobo = activePlayers.some(p => roles[p.uid] === 'Perro Lobo') && round === 1;
    const hasSalvaje = activePlayers.some(p => roles[p.uid] === 'Niño Salvaje') && round === 1;
    const hasProfeta = activePlayers.some(p => roles[p.uid] === 'Profeta');
    const hasSacerdote = activePlayers.some(p => roles[p.uid] === 'Sacerdote');
    const hasLadron = activePlayers.some(p => roles[p.uid] === 'Ladrón') && round === 1;

    const wolfDone = !hasWolves || subs['wolves'];
    const seerDone = !hasSeer || subs['vidente'];
    const witchDone = !hasWitch || subs['bruja'];
    const cupidoDone = !hasCupido || subs['cupido'];
    const guardianDone = !hasGuardian || subs['guardian'];
    const flautistaDone = !hasFlautista || subs['flautista'];
    const loboblancoDone = !hasLoboBlanco || subs['loboblanco'];
    const perroLoboDone = !hasPerroLobo || subs['perrolo'];
    const salvajeDone = !hasSalvaje || subs['salvaje'];
    const profetaDone = !hasProfeta || subs['profeta'];
    const sacerdoteDone = !hasSacerdote || subs['sacerdote'];
    const ladronDone = !hasLadron || subs['ladron'];

    if (wolfDone && seerDone && witchDone && cupidoDone && guardianDone &&
      flautistaDone && loboblancoDone && perroLoboDone && salvajeDone &&
      profetaDone && sacerdoteDone && ladronDone) {
      processNight();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.nightSubmissions, game?.phase]);

  async function processNight() {
    if (!game) return;
    const actions = game.nightActions ?? {};
    const roles = game.roles ?? {};
    let players = [...(game.players ?? [])];
    const history = [...(game.eliminatedHistory ?? [])];
    const round = game.roundNumber ?? 1;
    let enchanted = [...(game.enchanted ?? [])];
    const antiguoHit = [...(game.antiguoHit ?? [])];
    const perroLoboChoices = { ...(game.perroLoboChoices ?? {}) };
    let salvajeMentors = { ...(game.salvajeMentors ?? {}) };
    let newRoles = { ...roles };

    // Perro Lobo chose their side this night (round 1)
    if (actions.perroLoboSide) {
      const perroLoboPlayer = players.find(p => roles[p.uid] === 'Perro Lobo');
      if (perroLoboPlayer) {
        perroLoboChoices[perroLoboPlayer.uid] = actions.perroLoboSide;
        if (actions.perroLoboSide === 'wolves') {
          newRoles[perroLoboPlayer.uid] = 'Lobo';
        }
      }
    }

    // Niño Salvaje chose mentor (round 1)
    if (actions.salvajeMentor) {
      const salvaje = players.find(p => roles[p.uid] === 'Niño Salvaje');
      if (salvaje) {
        salvajeMentors[salvaje.uid] = actions.salvajeMentor;
      }
    }

    // Cupido links lovers (round 1)
    if (actions.cupidTargets?.length === 2 && !game.lovers) {
      await updateDoc(doc(db, 'games', gameId), {
        lovers: actions.cupidTargets,
        perroLoboChoices,
        salvajeMentors,
      }).catch(() => {});
    }

    // Guardian protection
    const guardianProtects = actions.guardianTarget ?? null;

    // Sacerdote protection (one-time, treated same as guardian for this night)
    const sacerdoteProtects = actions.sacerdoteTarget ?? null;

    // Determine wolf target
    let wolfTarget = actions.wolfTarget ?? null;

    // Antiguo: survives first wolf attack
    if (wolfTarget) {
      const targetRole = newRoles[wolfTarget];
      if (targetRole === 'Antiguo' && !antiguoHit.includes(wolfTarget)) {
        antiguoHit.push(wolfTarget);
        wolfTarget = null; // survives
      }
    }

    // Guardian blocks wolf kill
    if (wolfTarget && (wolfTarget === guardianProtects || wolfTarget === sacerdoteProtects)) {
      wolfTarget = null;
    }

    // Apply wolf kill
    let dayEliminatedUid: string | null = null;
    if (wolfTarget && !actions.witchSave) {
      const victim = players.find(p => p.uid === wolfTarget);
      if (victim) {
        players = players.map(p => p.uid === wolfTarget ? { ...p, isAlive: false } : p);
        history.push({ uid: victim.uid, name: victim.name, role: newRoles[victim.uid] ?? 'Aldeano', round });
        dayEliminatedUid = wolfTarget;
      }
    }

    // Witch poison
    if (actions.witchPoison) {
      const poisoned = players.find(p => p.uid === actions.witchPoison && p.isAlive);
      if (poisoned) {
        players = players.map(p => p.uid === actions.witchPoison ? { ...p, isAlive: false } : p);
        history.push({ uid: poisoned.uid, name: poisoned.name, role: newRoles[poisoned.uid] ?? 'Aldeano', round });
      }
    }

    // Lobo Blanco kills a wolf (every 2 rounds)
    if (actions.loboBlancoCide && round % 2 === 0) {
      const target = players.find(p => p.uid === actions.loboBlancoCide && p.isAlive);
      if (target && (newRoles[target.uid] === 'Lobo' || newRoles[target.uid] === 'Lobo Blanco')) {
        players = players.map(p => p.uid === actions.loboBlancoCide ? { ...p, isAlive: false } : p);
        history.push({ uid: target.uid, name: target.name, role: newRoles[target.uid], round });
      }
    }

    // Flautista enchants 2 players
    if (actions.flautistaTargets?.length) {
      for (const uid of actions.flautistaTargets) {
        if (!enchanted.includes(uid)) enchanted.push(uid);
      }
    }

    // Seer reveal
    let seerReveal = game.seerReveal ?? null;
    if (actions.seerTarget) {
      const target = players.find(p => p.uid === actions.seerTarget);
      if (target) {
        seerReveal = {
          targetUid: actions.seerTarget,
          isWolf: newRoles[actions.seerTarget] === 'Lobo' || newRoles[actions.seerTarget] === 'Lobo Blanco',
        };
      }
    }

    // Profeta reveal (same as seer but public)
    let profetaReveal = null;
    if (actions.profetaTarget) {
      profetaReveal = {
        targetUid: actions.profetaTarget,
        isWolf: newRoles[actions.profetaTarget] === 'Lobo' || newRoles[actions.profetaTarget] === 'Lobo Blanco',
      };
    }

    // Niño Salvaje: if mentor is now dead, convert to wolf
    for (const [salvajeUid, mentorUid] of Object.entries(salvajeMentors)) {
      const mentor = players.find(p => p.uid === mentorUid);
      if (mentor && !mentor.isAlive && newRoles[salvajeUid] === 'Niño Salvaje') {
        newRoles[salvajeUid] = 'Lobo';
        players = players.map(p => p.uid === salvajeUid ? { ...p, role: 'Lobo' } : p);
      }
    }

    // Lovers cascade death
    const lovers = game.lovers;
    if (lovers) {
      const [l1, l2] = lovers;
      const l1Dead = players.find(p => p.uid === l1 && !p.isAlive);
      const l2Dead = players.find(p => p.uid === l2 && !p.isAlive);
      if (l1Dead && players.find(p => p.uid === l2 && p.isAlive)) {
        players = players.map(p => p.uid === l2 ? { ...p, isAlive: false } : p);
        const p2 = players.find(p => p.uid === l2);
        if (p2) history.push({ uid: l2, name: p2.name, role: newRoles[l2] ?? 'Aldeano', round });
      }
      if (l2Dead && players.find(p => p.uid === l1 && p.isAlive)) {
        players = players.map(p => p.uid === l1 ? { ...p, isAlive: false } : p);
        const p1 = players.find(p => p.uid === l1);
        if (p1) history.push({ uid: l1, name: p1.name, role: newRoles[l1] ?? 'Aldeano', round });
      }
    }

    // Bear Growl: check if active player's neighbors include a wolf
    let bearGrowl = false;
    const bearTamer = players.find(p => newRoles[p.uid] === 'Oso' && p.isAlive);
    if (bearTamer) {
      const alivePlayers = players.filter(p => p.isAlive);
      const bearIdx = alivePlayers.findIndex(p => p.uid === bearTamer.uid);
      const leftNeighbor = alivePlayers[(bearIdx - 1 + alivePlayers.length) % alivePlayers.length];
      const rightNeighbor = alivePlayers[(bearIdx + 1) % alivePlayers.length];
      bearGrowl = [leftNeighbor, rightNeighbor].some(n =>
        n && (newRoles[n.uid] === 'Lobo' || newRoles[n.uid] === 'Lobo Blanco')
      );
    }

    const winResult = checkWinCondition(players, newRoles, {
      enchanted,
      round,
      perroLoboChoices,
    });

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
        perroLoboChoices,
        salvajeMentors,
        bearGrowl,
        phase: winResult.winner ? 'ended' : 'day',
        winners: winResult.winner ?? null,
        winMessage: winResult.message ?? null,
        nightActions: {},
        nightSubmissions: {},
        dayVotes: {},
        dayStartedAt: Date.now(),
      });
    } catch (e) {
      console.error('processNight updateDoc error:', e);
    }
  }

  const submitDayVote = useCallback(async (targetUid: string) => {
    if (!user || !game) return;
    try {
      await updateDoc(doc(db, 'games', gameId), {
        [`dayVotes.${user.uid}`]: targetUid,
      });
    } catch (e) {
      console.error('submitDayVote error:', e);
    }
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
    const eliminatedPlayer = game.dayEliminatedUid
      ? game.players?.find(p => p.uid === game.dayEliminatedUid)
      : null;

    const payload = {
      aiPlayers: aiPlayers.map(p => ({
        uid: p.uid,
        name: p.name,
        role: roles[p.uid] ?? 'Aldeano',
        isWolf: (roles[p.uid] === 'Lobo' || roles[p.uid] === 'Lobo Blanco'),
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
            senderId: m.uid,
            senderName: m.name,
            text: m.text,
            createdAt: serverTimestamp(),
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

    const dayVotes = (game.dayVotes ?? {}) as Record<string, string>;
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const aiAlive = alivePlayers.filter(p => p.isAI);
    if (aiAlive.length === 0) return;

    const updates: Record<string, unknown> = {};
    let needsUpdate = false;

    for (const ai of aiAlive) {
      if (dayVotes[ai.uid]) continue;
      const candidates = alivePlayers.filter(p => p.uid !== ai.uid);
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        updates[`dayVotes.${ai.uid}`] = pick.uid;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updateDoc(doc(db, 'games', gameId), updates).catch((e: any) => console.error('AI day vote error:', e));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase]);

  // Host processes day votes when all alive players voted
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;

    const dayVotes = (game.dayVotes ?? {}) as Record<string, string>;
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const voteCount = Object.keys(dayVotes).length;

    if (voteCount >= alivePlayers.length && alivePlayers.length > 0) {
      processDayVotes(dayVotes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.dayVotes, game?.phase]);

  async function processDayVotes(dayVotes: Record<string, string>) {
    if (!game) return;
    const roles = game.roles ?? {};
    const newRoles = { ...roles };
    const salvajeMentors = game.salvajeMentors ?? {};
    const perroLoboChoices = game.perroLoboChoices ?? {};
    const round = game.roundNumber ?? 1;

    // Tally votes (Alcalde gets double vote)
    const tally: Record<string, number> = {};
    for (const [voterUid, target] of Object.entries(dayVotes)) {
      const multiplier = newRoles[voterUid] === 'Alcalde' ? 2 : 1;
      tally[target] = (tally[target] ?? 0) + multiplier;
    }

    let maxVotes = 0;
    let eliminated: string | null = null;
    for (const [uid, count] of Object.entries(tally)) {
      if (count > maxVotes) { maxVotes = count; eliminated = uid; }
    }

    let players = [...(game.players ?? [])];
    const history = [...(game.eliminatedHistory ?? [])];
    const enchanted = [...(game.enchanted ?? [])];

    if (eliminated) {
      const victim = players.find(p => p.uid === eliminated);
      if (victim) {
        // Antiguo: if eliminated by village, all special roles lose powers
        if (newRoles[eliminated] === 'Antiguo') {
          for (const uid of Object.keys(newRoles)) {
            const role = newRoles[uid];
            if (role !== 'Lobo' && role !== 'Lobo Blanco' && role !== 'Aldeano') {
              newRoles[uid] = 'Aldeano';
            }
          }
        }

        players = players.map(p => p.uid === eliminated ? { ...p, isAlive: false } : p);
        history.push({ uid: victim.uid, name: victim.name, role: newRoles[victim.uid] ?? 'Aldeano', round });
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

    const winResult = checkWinCondition(players, newRoles, {
      enchanted,
      round,
      dayEliminatedUid: eliminated,
      eliminatedByVote: true,
      perroLoboChoices,
    });

    try {
      await updateDoc(doc(db, 'games', gameId), {
        players,
        roles: newRoles,
        eliminatedHistory: history,
        enchanted,
        phase: winResult.winner ? 'ended' : 'night',
        winners: winResult.winner ?? null,
        winMessage: winResult.message ?? null,
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
    }
  }

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

  if (game.phase === 'roleReveal' || !game.roles) {
    return (
      <RoleReveal
        game={game}
        myRole={myRole}
        me={me}
        onReady={advanceFromRoleReveal}
        isHost={game.hostUid === user.uid}
        gameId={gameId}
        userId={user.uid}
      />
    );
  }

  if (game.phase === 'ended') {
    return (
      <EndGame
        game={game}
        myRole={myRole}
        winners={game.winners ?? null}
        winMessage={game.winMessage ?? ''}
        onPlayAgain={() => router.push('/')}
      />
    );
  }

  if (game.phase === 'night') {
    return (
      <NightPhase
        game={game}
        gameId={gameId}
        myRole={myRole ?? 'Aldeano'}
        me={me}
        userId={user.uid}
        isHost={game.hostUid === user.uid}
        onSubmitAction={submitNightAction}
      />
    );
  }

  if (game.phase === 'day') {
    return (
      <DayPhase
        game={game}
        gameId={gameId}
        myRole={myRole ?? 'Aldeano'}
        me={me}
        userId={user.uid}
        isHost={game.hostUid === user.uid}
        onVote={submitDayVote}
        onTimerEnd={() => {
          if (game.hostUid === user.uid) {
            const votes = (game.dayVotes ?? {}) as Record<string, string>;
            processDayVotes(votes);
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
