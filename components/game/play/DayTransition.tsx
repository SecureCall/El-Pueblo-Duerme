'use client';

import { useEffect, useState, useRef } from 'react';
import { GameState } from './GamePlay';
import { getRoleIcon } from './roleIcons';
import { ROLES } from './roles';
import { useNarrator, waitForAudio } from '@/hooks/useNarrator';
import { Moon, Volume2, UserX } from 'lucide-react';

interface Props {
  game: GameState;
  eliminatedName: string | null;
  eliminatedRole: string | null;
  onDone: () => void;
  autoSeconds?: number;
}

export function DayTransition({ game, eliminatedName, eliminatedRole, onDone, autoSeconds = 4 }: Props) {
  const [narratorDone, setNarratorDone] = useState(false);
  const [countdown, setCountdown] = useState(autoSeconds);
  const { interruptWith, AUDIO_FILES } = useNarrator();
  const played = useRef(false);
  const doneFired = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (eliminatedName) {
      interruptWith(AUDIO_FILES.exiledAnnounce, AUDIO_FILES.exiled, AUDIO_FILES.nightStart);
    } else {
      interruptWith(AUDIO_FILES.nightStart);
    }
    waitForAudio().then(() => setNarratorDone(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!narratorDone) return;
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [narratorDone, countdown]);

  useEffect(() => {
    if (!narratorDone) return;
    if (countdown === 0 && !doneFired.current) {
      doneFired.current = true;
      onDoneRef.current();
    }
  }, [countdown, narratorDone]);

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col items-center justify-center px-4 relative"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative z-10 w-full max-w-md space-y-6 text-center">

        <div className="text-5xl mb-2 animate-pulse">🌙</div>
        <h2 className="font-headline text-3xl font-bold">El pueblo duerme</h2>

        {eliminatedName ? (
          <div className="bg-amber-950/60 border border-amber-500/30 rounded-2xl p-6 text-center">
            <UserX className="h-10 w-10 text-amber-400 mx-auto mb-3" />
            <p className="text-amber-300/70 text-sm uppercase tracking-widest mb-2">El pueblo ha desterrado a</p>
            <p className="font-headline text-2xl font-bold text-amber-200">{eliminatedName}</p>
            {eliminatedRole && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <img
                  src={getRoleIcon(eliminatedRole)}
                  alt={eliminatedRole}
                  className="w-8 h-8 rounded-full object-cover opacity-80"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-white/50 text-sm">
                  Era {eliminatedRole} — {ROLES[eliminatedRole]?.description ?? ''}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 text-center">
            <Moon className="h-10 w-10 text-blue-300 mx-auto mb-3" />
            <p className="text-white/70 text-lg font-semibold">El pueblo no llegó a un acuerdo</p>
            <p className="text-white/30 text-sm mt-1">Nadie fue desterrado esta votación</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mt-4">
          {!narratorDone ? (
            <div className="flex items-center gap-2 text-white/40 text-sm animate-pulse">
              <Volume2 className="h-4 w-4" />
              <span>El narrador está hablando...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-white/30 text-xs">
                La noche comienza en {countdown}s...
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

        {narratorDone && (
          <div className="w-full bg-white/5 rounded-full h-1">
            <div
              className="bg-blue-400/40 h-1 rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / autoSeconds) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
