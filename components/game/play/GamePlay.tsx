'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import {
  doc, onSnapshot, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { assignRoles, checkWinCondition, ROLES } from './roles';
import { RoleReveal } from './RoleReveal';
import { NightPhase } from './NightPhase';
import { DayPhase } from './DayPhase';
import { EndGame } from './EndGame';

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
  };
  nightSubmissions?: Record<string, boolean>;
  dayEliminatedUid?: string | null;
  seerReveal?: { targetUid: string; isWolf: boolean } | null;
  lovers?: [string, string] | null;
  winners?: 'wolves' | 'village' | null;
  winMessage?: string;
  eliminatedHistory?: { uid: string; name: string; role: string; round: number }[];
}

export function GamePlay({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleRevealDone, setRoleRevealDone] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'games', gameId),
      snap => {
        if (!snap.exists()) { router.push('/'); return; }
        setGame(snap.data() as GameState);
        setLoading(false);
      },
      _err => {
        // Permission denied or network error — go home
        router.push('/');
      }
    );
    return () => unsub();
  }, [gameId, router]);

  // Host assigns roles on game start
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.roles && Object.keys(game.roles).length > 0) return;
    if (game.status !== 'playing') return;

    const assigned = assignRoles(
      game.players,
      game.wolves,
      game.specialRoles ?? []
    );

    const updatedPlayers = game.players.map(p => ({
      ...p,
      role: assigned[p.uid] ?? 'Aldeano',
    }));

    const hasCupido = Object.values(assigned).includes('Cupido');

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
      lovers: null,
      winners: null,
      eliminatedHistory: [],
    }).catch(e => console.error('assignRoles error:', e));
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
    const myRole = game.roles?.[user.uid];
    const submissionKey = myRole === 'Lobo' ? 'wolves' : (myRole?.toLowerCase() ?? user.uid);

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(action)) {
      updates[`nightActions.${k}`] = v;
    }
    updates[`nightSubmissions.${submissionKey}`] = true;

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

    const aiWolves = aiPlayers.filter(p => roles[p.uid] === 'Lobo');
    if (aiWolves.length > 0 && !subs['wolves']) {
      const targets = alivePlayers.filter(p => roles[p.uid] !== 'Lobo' && !p.isAI);
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        updates['nightActions.wolfTarget'] = target.uid;
      }
      updates['nightSubmissions.wolves'] = true;
      needsUpdate = true;
    }

    const aiSeer = aiPlayers.find(p => roles[p.uid] === 'Vidente');
    if (aiSeer && !subs['vidente']) {
      updates['nightSubmissions.vidente'] = true;
      needsUpdate = true;
    }

    const aiWitch = aiPlayers.find(p => roles[p.uid] === 'Bruja');
    if (aiWitch && !subs['bruja']) {
      updates['nightSubmissions.bruja'] = true;
      needsUpdate = true;
    }

    const aiCupido = aiPlayers.find(p => roles[p.uid] === 'Cupido');
    if (aiCupido && !subs['cupido'] && (game.roundNumber ?? 1) === 1) {
      const candidates = alivePlayers.filter(p => !p.isAI).slice(0, 2);
      if (candidates.length >= 2) updates['nightActions.cupidTargets'] = [candidates[0].uid, candidates[1].uid];
      updates['nightSubmissions.cupido'] = true;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updateDoc(doc(db, 'games', gameId), updates);
    }
  }, [game?.phase, game?.roundNumber]);

  // Host processes night when all required submissions received
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'night') return;

    const subs = game.nightSubmissions ?? {};
    const roles = game.roles ?? {};
    const activePlayers = (game.players ?? []).filter(p => p.isAlive);

    const hasWolves = activePlayers.some(p => roles[p.uid] === 'Lobo');
    const hasSeer = activePlayers.some(p => roles[p.uid] === 'Vidente');
    const hasWitch = activePlayers.some(p => roles[p.uid] === 'Bruja');
    const hasCupido = activePlayers.some(p => roles[p.uid] === 'Cupido') && (game.roundNumber ?? 1) === 1;

    const wolfDone = !hasWolves || subs['wolves'];
    const seerDone = !hasSeer || subs['vidente'];
    const witchDone = !hasWitch || subs['bruja'];
    const cupidoDone = !hasCupido || subs['cupido'];

    if (wolfDone && seerDone && witchDone && cupidoDone) {
      processNight();
    }
  }, [game?.nightSubmissions, game?.phase]);

  async function processNight() {
    if (!game) return;
    const actions = game.nightActions ?? {};
    const roles = game.roles ?? {};
    let players = [...(game.players ?? [])];
    const history = [...(game.eliminatedHistory ?? [])];
    const round = game.roundNumber ?? 1;

    let wolfTarget = actions.wolfTarget;
    let dayEliminatedUid: string | null = null;

    if (wolfTarget && !(actions.witchSave)) {
      const victim = players.find(p => p.uid === wolfTarget);
      if (victim) {
        players = players.map(p =>
          p.uid === wolfTarget ? { ...p, isAlive: false } : p
        );
        history.push({ uid: victim.uid, name: victim.name, role: roles[victim.uid] ?? 'Aldeano', round });
        dayEliminatedUid = wolfTarget;
      }
    }

    if (actions.witchPoison) {
      const poisoned = players.find(p => p.uid === actions.witchPoison);
      if (poisoned) {
        players = players.map(p =>
          p.uid === actions.witchPoison ? { ...p, isAlive: false } : p
        );
        history.push({ uid: poisoned.uid, name: poisoned.name, role: roles[poisoned.uid] ?? 'Aldeano', round });
      }
    }

    if (actions.cupidTargets?.length === 2 && !game.lovers) {
      await updateDoc(doc(db, 'games', gameId), { lovers: actions.cupidTargets });
    }

    let seerReveal = null;
    if (actions.seerTarget) {
      const target = players.find(p => p.uid === actions.seerTarget);
      if (target) {
        seerReveal = { targetUid: actions.seerTarget, isWolf: roles[actions.seerTarget] === 'Lobo' };
      }
    }

    const winner = checkWinCondition(players, roles);

    try {
      await updateDoc(doc(db, 'games', gameId), {
        players,
        eliminatedHistory: history,
        dayEliminatedUid,
        seerReveal,
        phase: winner ? 'ended' : 'day',
        winners: winner ?? null,
        winMessage: winner === 'wolves' ? '¡Los lobos han devorado al pueblo!' : winner === 'village' ? '¡El pueblo ha eliminado a todos los lobos!' : null,
        nightActions: {},
        nightSubmissions: {},
        dayVotes: {},
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

  // Host auto-votes for AI players during day
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;

    const roles = game.roles ?? {};
    const dayVotes = (game as any).dayVotes ?? {};
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
      updateDoc(doc(db, 'games', gameId), updates);
    }
  }, [game?.phase]);

  // Host processes day votes when all alive players voted
  useEffect(() => {
    if (!game || !user || game.hostUid !== user.uid) return;
    if (game.phase !== 'day') return;

    const dayVotes = (game as any).dayVotes ?? {};
    const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
    const voteCount = Object.keys(dayVotes).length;

    if (voteCount >= alivePlayers.length && alivePlayers.length > 0) {
      processDayVotes(dayVotes);
    }
  }, [(game as any)?.dayVotes, game?.phase]);

  async function processDayVotes(dayVotes: Record<string, string>) {
    if (!game) return;
    const tally: Record<string, number> = {};
    for (const target of Object.values(dayVotes)) {
      tally[target] = (tally[target] ?? 0) + 1;
    }

    let maxVotes = 0;
    let eliminated: string | null = null;
    for (const [uid, count] of Object.entries(tally)) {
      if (count > maxVotes) { maxVotes = count; eliminated = uid; }
    }

    const roles = game.roles ?? {};
    let players = [...(game.players ?? [])];
    const history = [...(game.eliminatedHistory ?? [])];
    const round = game.roundNumber ?? 1;

    if (eliminated) {
      const victim = players.find(p => p.uid === eliminated);
      if (victim) {
        players = players.map(p => p.uid === eliminated ? { ...p, isAlive: false } : p);
        history.push({ uid: victim.uid, name: victim.name, role: roles[victim.uid] ?? 'Aldeano', round });
      }
    }

    const winner = checkWinCondition(players, roles);

    try {
      await updateDoc(doc(db, 'games', gameId), {
        players,
        eliminatedHistory: history,
        phase: winner ? 'ended' : 'night',
        winners: winner ?? null,
        winMessage: winner === 'wolves' ? '¡Los lobos han devorado al pueblo!' : winner === 'village' ? '¡El pueblo ha eliminado a todos los lobos!' : null,
        roundNumber: (game.roundNumber ?? 1) + 1,
        dayVotes: {},
        dayEliminatedUid: null,
        seerReveal: null,
        nightActions: {},
        nightSubmissions: {},
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
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f] text-white">
      <Loader2 className="h-8 w-8 animate-spin text-white/40" />
    </div>
  );
}
