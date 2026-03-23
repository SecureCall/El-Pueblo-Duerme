'use client';

import { useEffect, useState, useRef } from 'react';
import { GameState } from './GamePlay';
import { getRoleIcon } from './roleIcons';
import { ROLES } from './roles';
import { useNarrator, waitForAudio } from '@/hooks/useNarrator';
import { Skull, Shield, Volume2 } from 'lucide-react';

interface Props {
  game: GameState;
  victimName: string | null;
  victimRole: string | null;
  onDone: () => void;
  autoSeconds?: number;
}

export function NightTransition({ game, victimName, victimRole, onDone, autoSeconds = 4 }: Props) {
  const [narratorDone, setNarratorDone] = useState(false);
  const [countdown, setCountdown] = useState(autoSeconds);
  const { playSequence, AUDIO_FILES } = useNarrator();
  const played = useRef(false);
  const doneFired = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Play narrator audio once, then signal when done
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (victimName) {
      playSequence([AUDIO_FILES.deathAnnounce, AUDIO_FILES.rip]);
    } else {
      playSequence([AUDIO_FILES.miracle, AUDIO_FILES.dayWakeup]);
    }
    waitForAudio().then(() => setNarratorDone(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown starts only AFTER narrator finishes
  useEffect(() => {
    if (!narratorDone) return;
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown(c => {
        const next = Math.max(0, c - 1);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [narratorDone, countdown]);

  // Advance when countdown hits 0 (after narrator)
  useEffect(() => {
    if (!narratorDone) return;
    if (countdown === 0 && !doneFired.current) {
      doneFired.current = true;
      onDoneRef.current();
    }
  }, [countdown, narratorDone]);

  const bearGrowl = (game as any).bearGrowl;
  const profetaReveal = (game as any).profetaReveal;
  const profetaTarget = profetaReveal
    ? (game.players ?? []).find((p: any) => p.uid === profetaReveal.targetUid)
    : null;

  const canContinue = narratorDone;

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

        {/* Narrator status & continue */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {!narratorDone ? (
            <div className="flex items-center gap-2 text-white/40 text-sm animate-pulse">
              <Volume2 className="h-4 w-4" />
              <span>El narrador está hablando...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-white/30 text-xs">
                El debate comienza en {countdown}s...
              </span>
              <button
                onClick={() => {
                  if (!doneFired.current) {
                    doneFired.current = true;
                    onDoneRef.current();
                  }
                }}
                className="text-white/60 hover:text-white text-xs underline transition-colors"
              >
                Continuar ahora
              </button>
            </div>
          )}
        </div>

        {/* Progress bar — only visible after narrator */}
        {narratorDone && (
          <div className="w-full bg-white/5 rounded-full h-1">
            <div
              className="bg-white/30 h-1 rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / autoSeconds) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
