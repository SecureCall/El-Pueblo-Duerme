'use client';

import { useState, useEffect } from 'react';
import { GameState, Player } from '@/lib/game/types';
import { submitVote } from '@/lib/game/engine';
import { Check, Vote } from 'lucide-react';

interface Props {
  game: GameState; gameId: string; me: any; user: any; remaining: number; isHost: boolean;
}

export function VotePhase({ game, gameId, me, user, remaining }: Props) {
  const [localRemaining, setLocalRemaining] = useState(remaining);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const alivePlayers = (game.players ?? []).filter(p => p.isAlive && p.uid !== user.uid);
  const votes = game.currentVotes ?? {};
  const voterCount = Object.keys(votes).length;
  const totalVoters = (game.players ?? []).filter(p => p.isAlive).length;

  useEffect(() => {
    const myExistingVote = votes[user.uid];
    if (myExistingVote) setMyVote(myExistingVote);
  }, [votes, user.uid]);

  useEffect(() => {
    const start = game.phaseStartedAt;
    const dur = game.phaseDuration;
    const tick = () => setLocalRemaining(Math.max(0, dur - (Date.now() - start) / 1000));
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [game.phaseStartedAt, game.phaseDuration]);

  const castVote = async (targetUid: string) => {
    if (myVote || voting || !me?.isAlive) return;
    setVoting(true);
    setMyVote(targetUid);
    await submitVote(gameId, user.uid, targetUid);
    setVoting(false);
  };

  const getVoteCount = (uid: string) => Object.values(votes).filter(v => v === uid).length;

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <div className="flex items-center gap-2">
        <Vote className="h-5 w-5 text-red-400" />
        <h2 className="font-headline text-2xl font-bold text-red-300">Juicio del Pueblo</h2>
      </div>

      <p className="text-white/50 text-sm text-center">
        {me?.isAlive ? 'Vota a quien crees que es el lobo. El más votado será ejecutado.' : 'Observas el juicio desde el más allá.'}
      </p>

      <div className="w-full max-w-sm">
        <div className="flex justify-between text-xs text-white/40 mb-2">
          <span>Votos emitidos: {voterCount}/{totalVoters}</span>
          <span className="font-mono">{Math.round(localRemaining)}s</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${(1 - localRemaining / game.phaseDuration) * 100}%` }} />
        </div>

        <div className="space-y-2">
          {alivePlayers.map(p => {
            const voteCount = getVoteCount(p.uid);
            const isMyVote = myVote === p.uid;
            return (
              <button
                key={p.uid}
                onClick={() => castVote(p.uid)}
                disabled={!!myVote || !me?.isAlive}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isMyVote ? 'bg-red-900/40 border-red-500/50' : 'bg-black/30 border-white/10 hover:border-white/30 hover:bg-white/5'
                } disabled:cursor-not-allowed`}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
                  {p.photoURL ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="w-full h-full flex items-center justify-center font-bold">{p.name[0]}</span>}
                </div>
                <span className="flex-1 text-left font-medium">{p.name}</span>
                {voteCount > 0 && (
                  <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full">
                    {voteCount} voto{voteCount > 1 ? 's' : ''}
                  </span>
                )}
                {isMyVote && <Check className="h-4 w-4 text-red-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {myVote && <p className="text-white/30 text-sm">Has votado. Esperando a los demás...</p>}
      {!me?.isAlive && <p className="text-white/20 text-sm italic">Los muertos no pueden votar.</p>}
    </div>
  );
}
