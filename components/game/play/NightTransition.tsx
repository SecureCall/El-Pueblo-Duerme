'use client';

import { useEffect, useState, useRef } from 'react';
import { GameState } from './GamePlay';
import { getRoleIcon } from './roleIcons';
import { ROLES } from './roles';
import { useNarrator } from '@/hooks/useNarrator';
import { Skull, Shield, Music } from 'lucide-react';

interface Props {
  game: GameState;
  victimName: string | null;
  victimRole: string | null;
  onDone: () => void;
  autoSeconds?: number;
}

export function NightTransition({ game, victimName, victimRole, onDone, autoSeconds = 10 }: Props) {
  const [countdown, setCountdown] = useState(autoSeconds);
  const { playSequence, play, AUDIO_FILES } = useNarrator();
  const played = useRef(false);

  useEffect(() => {
    if (!played.current) {
      played.current = true;
      if (victimName) {
        playSequence([AUDIO_FILES.deathAnnounce, AUDIO_FILES.rip]);
      } else {
        play(AUDIO_FILES.dayWakeup);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          onDone();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDone]);

  const bearGrowl = (game as any).bearGrowl;
  const profetaReveal = (game as any).profetaReveal;
  const profetaTarget = profetaReveal
    ? (game.players ?? []).find((p: any) => p.uid === profetaReveal.targetUid)
    : null;

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col items-center justify-center px-4 relative"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative z-10 w-full max-w-md space-y-6 text-center">

        <div className="text-5xl mb-2 animate-pulse">🌄</div>
        <h2 className="font-headline text-3xl font-bold">El pueblo despierta</h2>

        {victimName ? (
          <div className="bg-red-950/60 border border-red-500/30 rounded-2xl p-6 text-center">
            <Skull className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-300/70 text-sm uppercase tracking-widest mb-2">Esta noche murió</p>
            <p className="font-headline text-2xl font-bold text-red-200">{victimName}</p>
            {victimRole && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <img
                  src={getRoleIcon(victimRole)}
                  alt={victimRole}
                  className="w-8 h-8 rounded-full object-cover opacity-80"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-white/50 text-sm">
                  Era {victimRole} — {ROLES[victimRole]?.description ?? ''}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-green-950/40 border border-green-500/20 rounded-2xl p-6 text-center">
            <Shield className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-green-300 text-lg font-semibold">¡Nadie murió esta noche!</p>
            <p className="text-white/40 text-sm mt-1">El guardián o la bruja protegieron al pueblo</p>
          </div>
        )}

        {bearGrowl && (
          <div className="bg-amber-950/40 border border-amber-500/20 rounded-xl p-4 text-center">
            <span className="text-2xl">🐻</span>
            <p className="text-amber-300 text-sm mt-1">¡El oso gruñe! Hay un lobo entre los vecinos del domador de osos.</p>
          </div>
        )}

        {profetaTarget && (
          <div className="bg-cyan-950/40 border border-cyan-500/20 rounded-xl p-4 text-center">
            <span className="text-2xl">🔮</span>
            <p className="text-cyan-300 text-sm mt-1">
              La profeta revela: <strong>{profetaTarget.name}</strong> es {profetaReveal.isWolf ? '🐺 un LOBO' : '👤 inocente'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <div className="text-white/30 text-xs">El debate comienza en {countdown}s...</div>
          <button
            onClick={onDone}
            className="text-white/50 hover:text-white text-xs underline transition-colors"
          >
            Continuar ahora
          </button>
        </div>

        <div className="w-full bg-white/5 rounded-full h-1">
          <div
            className="bg-white/30 h-1 rounded-full transition-all"
            style={{ width: `${(countdown / autoSeconds) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
