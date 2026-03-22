'use client';

import { GameState } from '@/lib/game/types';
import { ROLES } from '@/lib/game/roles';
import Image from 'next/image';

interface Props { game: GameState; remaining: number; [key: string]: any; }

export function NightResult({ game, remaining }: Props) {
  const deaths = (game.nightDeaths ?? []).map(uid => game.players.find(p => p.uid === uid)).filter(Boolean);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <div className="text-yellow-400/60 text-xs uppercase tracking-widest">El amanecer llega al pueblo</div>
      <h2 className="font-headline text-3xl text-white font-bold">Esta noche...</h2>

      {deaths.length === 0 ? (
        <div className="bg-green-900/30 border border-green-500/20 rounded-2xl px-8 py-6 text-center">
          <div className="text-4xl mb-3">🌙</div>
          <p className="text-green-300 font-semibold">El pueblo pasó la noche en paz</p>
          <p className="text-white/40 text-sm mt-1">Nadie murió esta noche.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {deaths.map((p: any) => (
            <div key={p.uid} className="bg-black/50 border border-red-500/20 rounded-xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-red-500/30">
                {p.photoURL
                  ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover grayscale" />
                  : <div className="w-full h-full bg-white/10 flex items-center justify-center text-lg font-bold">{p.name[0]}</div>
                }
              </div>
              <div>
                <p className="font-bold text-white">{p.name}</p>
                <p className="text-red-400 text-sm">Ha fallecido</p>
                {p.role && (
                  <p className="text-white/40 text-xs mt-0.5">Era: {ROLES[p.role]?.name ?? p.role}</p>
                )}
              </div>
              <div className="ml-auto text-2xl">⚰️</div>
            </div>
          ))}
        </div>
      )}

      {(game.dayAnnouncements ?? []).slice(1).map((ann, i) => (
        <p key={i} className="text-yellow-300/70 text-sm text-center">{ann}</p>
      ))}

      <p className="text-white/20 text-sm">El debate comienza en {Math.round(remaining)}s...</p>
    </div>
  );
}
