'use client';

import { GameState } from '@/lib/game/types';
import { ROLES } from '@/lib/game/roles';
import { resolveHunterShot } from '@/lib/game/engine';
import { useState } from 'react';

interface Props {
  game: GameState; gameId: string; me: any; user: any; remaining: number; isHost: boolean;
}

export function VoteResult({ game, gameId, me, user, remaining }: Props) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  const isHunterPending = game.hunterPendingDeath === user.uid;
  const alivePlayers = (game.players ?? []).filter(p => p.isAlive && p.uid !== user.uid);

  const fireShot = async () => {
    if (!selectedTarget || firing) return;
    setFiring(true);
    await resolveHunterShot(gameId, game, selectedTarget);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <h2 className="font-headline text-3xl font-bold text-red-300">Veredicto</h2>

      {(game.dayAnnouncements ?? []).map((ann, i) => (
        <div key={i} className={`bg-black/30 border rounded-xl px-6 py-4 text-center max-w-sm ${i === 0 ? 'border-red-500/30' : 'border-white/10'}`}>
          <p className={i === 0 ? 'text-white font-semibold' : 'text-yellow-300/80 text-sm'}>{ann}</p>
        </div>
      ))}

      {isHunterPending && (
        <div className="bg-orange-900/30 border border-orange-500/30 rounded-2xl p-5 max-w-sm w-full">
          <p className="text-orange-300 font-bold text-center mb-1">🔫 Última bala</p>
          <p className="text-white/60 text-sm text-center mb-4">Eres el Cazador. Elige a quién te llevas contigo.</p>
          <div className="space-y-2">
            {alivePlayers.map(p => (
              <button
                key={p.uid}
                onClick={() => setSelectedTarget(p.uid)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                  selectedTarget === p.uid ? 'border-orange-500 bg-orange-900/30' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                  {p.photoURL ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="w-full h-full flex items-center justify-center text-xs font-bold">{p.name[0]}</span>}
                </div>
                <span className="flex-1 text-left text-sm">{p.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={fireShot}
            disabled={!selectedTarget || firing}
            className="mt-4 w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            {firing ? 'Disparando...' : '💥 Disparar'}
          </button>
        </div>
      )}

      {!isHunterPending && (
        <p className="text-white/20 text-sm">Continúa en {Math.round(remaining)}s...</p>
      )}
    </div>
  );
}
