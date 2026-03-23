'use client';

import { useState, useEffect } from 'react';
import { ROLES } from './roles';
import { GameState, Player } from './GamePlay';
import { Eye, EyeOff, Check } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

interface Props {
  game: GameState;
  myRole?: string;
  me?: Player;
  isHost: boolean;
  onReady: () => void;
  gameId: string;
  userId: string;
}

export function RoleReveal({ game, myRole, me, isHost, onReady, gameId, userId }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const roleInfo = myRole ? ROLES[myRole] : null;
  const myWolfTeam = myRole === 'Lobo'
    ? (game.players ?? []).filter(p => game.roles?.[p.uid] === 'Lobo' && p.uid !== userId)
    : [];

  const myLovers = game.lovers
    ? (game.players ?? []).filter(p => game.lovers!.includes(p.uid) && p.uid !== userId)
    : [];

  const handleReady = () => {
    setIsReady(true);
    if (isHost) {
      setTimeout(onReady, 1500);
    }
  };

  const totalPlayers = (game.players ?? []).filter(p => !p.isAI).length;

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col items-center justify-center px-4"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative z-10 w-full max-w-md">
        <p className="text-center text-white/40 text-sm mb-6 tracking-widest uppercase">La noche cae sobre el pueblo</p>
        <h2 className="text-center font-headline text-3xl font-bold mb-8">Tu Rol</h2>

        <div
          className="bg-black/60 border border-white/15 rounded-2xl p-8 text-center cursor-pointer select-none transition-all hover:border-white/30"
          onClick={() => setRevealed(r => !r)}
        >
          {!revealed ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center">
                <EyeOff className="h-8 w-8 text-white/30" />
              </div>
              <p className="text-white/50 text-sm">Toca para revelar tu rol en secreto</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="text-7xl mb-2">{roleInfo?.emoji ?? '🧑'}</div>
              <h3 className="font-headline text-4xl font-bold">{myRole ?? 'Aldeano'}</h3>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mt-1"
                style={{
                  background: roleInfo?.team === 'wolves' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                  color: roleInfo?.team === 'wolves' ? '#f87171' : '#4ade80',
                  border: `1px solid ${roleInfo?.team === 'wolves' ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
                }}
              >
                {roleInfo?.team === 'wolves' ? '🐺 Bando de los Lobos' : '🌾 Bando del Pueblo'}
              </div>
              <p className="text-white/60 text-sm leading-relaxed mt-2">{roleInfo?.description}</p>

              {myWolfTeam.length > 0 && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-xl w-full">
                  <p className="text-red-400 text-xs font-semibold mb-2 uppercase tracking-wide">Tus compañeros lobos:</p>
                  {myWolfTeam.map(p => (
                    <div key={p.uid} className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-red-900/40 flex items-center justify-center text-xs">{p.name[0]}</div>
                      <span className="text-red-300 text-sm">{p.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {myLovers.length > 0 && (
                <div className="mt-3 p-3 bg-pink-900/20 border border-pink-500/30 rounded-xl w-full">
                  <p className="text-pink-400 text-xs font-semibold mb-1 uppercase tracking-wide">💘 Estás enamorado/a de:</p>
                  {myLovers.map(p => <p key={p.uid} className="text-pink-300 text-sm">{p.name}</p>)}
                  <p className="text-pink-400/60 text-xs mt-1">Si tu amado/a muere, tú también.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {revealed && !isReady && (
          <button
            onClick={handleReady}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all text-lg"
          >
            <Check className="h-5 w-5" />
            Listo, comenzar la noche
          </button>
        )}

        {isReady && (
          <div className="mt-6 text-center text-white/40 text-sm animate-pulse">
            Esperando al anfitrión para comenzar...
          </div>
        )}

        <p className="text-center text-white/20 text-xs mt-6">
          ⚠️ No muestres tu pantalla a otros jugadores
        </p>
      </div>
    </div>
  );
}
