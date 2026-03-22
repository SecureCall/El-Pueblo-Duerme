'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { GameState } from '@/lib/game/types';
import { ROLES } from '@/lib/game/roles';
import { useAudio } from '@/app/providers/AudioProvider';
import { Loader2 } from 'lucide-react';
import { RoleReveal } from './phases/RoleReveal';
import { NightPhase } from './phases/NightPhase';
import { NightResult } from './phases/NightResult';
import { DayPhase } from './phases/DayPhase';
import { VotePhase } from './phases/VotePhase';
import { VoteResult } from './phases/VoteResult';
import { GameEnded } from './phases/GameEnded';
import { advanceToNight, advanceNightRole, advanceToDay, advanceToVote, resolveVote } from '@/lib/game/engine';

export function GamePlay({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const { playVoice, nightSequence, daySequence, playMusic } = useAudio();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPhase, setLastPhase] = useState<string>('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), snap => {
      if (!snap.exists()) { router.push('/'); return; }
      setGame({ id: snap.id, ...snap.data() } as GameState);
      setLoading(false);
    });
    return () => unsub();
  }, [gameId, router]);

  // Play audio on phase changes
  useEffect(() => {
    if (!game || game.phase === lastPhase) return;
    setLastPhase(game.phase);

    switch (game.phase) {
      case 'night': nightSequence(); break;
      case 'night-result': break;
      case 'day': daySequence(); break;
      case 'vote': playVoice('inicio-votacion'); break;
      case 'ended':
        if (game.winner === 'lobos') playVoice('victoria-lobos');
        else if (game.winner === 'aldeanos') playVoice('victoria-aldeanos');
        else if (game.winner === 'hombre_ebrio') playVoice('ganador-el-ebrio');
        else if (game.winner === 'vampiro') playVoice('el-vampiro-ha-ganado');
        else if (game.winner === 'verdugo') playVoice('victoria-el-berdugo');
        break;
    }
  }, [game?.phase, game?.winner]);

  // Auto-advance phases (host is the conductor)
  const autoAdvance = useCallback(async () => {
    if (!game || !user || game.hostUid !== user.uid) return;

    const elapsed = (Date.now() - game.phaseStartedAt) / 1000;
    if (elapsed < game.phaseDuration) return;

    switch (game.phase) {
      case 'role-reveal': await advanceToNight(gameId, game); break;
      case 'night':
        await advanceNightRole(gameId, game);
        break;
      case 'night-result': await advanceToDay(gameId, game); break;
      case 'day': await advanceToVote(gameId); break;
      case 'vote': await resolveVote(gameId, game); break;
      case 'vote-result': await advanceToNight(gameId, { ...game, round: game.round + 1 }); break;
    }
  }, [game, user, gameId]);

  useEffect(() => {
    const interval = setInterval(autoAdvance, 1000);
    return () => clearInterval(interval);
  }, [autoAdvance]);

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f]">
      <Loader2 className="h-10 w-10 animate-spin text-white/40" />
    </div>
  );

  if (!game) return null;

  const me = game.players?.find(p => p.uid === user.uid);
  const myRole = me?.role ? ROLES[me.role] : null;
  const isHost = game.hostUid === user.uid;

  const elapsed = (Date.now() - game.phaseStartedAt) / 1000;
  const remaining = Math.max(0, game.phaseDuration - elapsed);

  const sharedProps = { game, gameId, me, myRole, user, remaining, isHost };

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative z-10 h-screen flex flex-col">
        {game.phase === 'role-reveal' && <RoleReveal {...sharedProps} />}
        {game.phase === 'night' && <NightPhase {...sharedProps} />}
        {game.phase === 'night-result' && <NightResult {...sharedProps} />}
        {game.phase === 'day' && <DayPhase {...sharedProps} />}
        {game.phase === 'vote' && <VotePhase {...sharedProps} />}
        {game.phase === 'vote-result' && <VoteResult {...sharedProps} />}
        {game.phase === 'ended' && <GameEnded {...sharedProps} />}
      </div>
    </div>
  );
}
