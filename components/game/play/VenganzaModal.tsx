'use client';

/**
 * VenganzaModal
 * Mecánica "firma": el jugador que muere elige a alguien para maldecir.
 * La maldición agrega +1 voto simbólico en la siguiente ronda de votación
 * y aparece en el narratorBroadcast con drama máximo.
 */

import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { Flame } from 'lucide-react';

interface Player { uid: string; name: string; isAlive: boolean; isBot?: boolean; }

interface Props {
  gameId: string;
  victimName: string;
  victimUid: string;
  round: number;
  alivePlayers: Player[];
  onDone: () => void;
}

const TIMER_SECS = 10;

export function VenganzaModal({ gameId, victimName, victimUid, round, alivePlayers, onDone }: Props) {
  const [timeLeft, setTimeLeft] = useState(TIMER_SECS);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [visible, setVisible] = useState(false);
  const sentRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const candidates = alivePlayers.filter(p => p.uid !== victimUid && p.isAlive);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (sentRef.current) return;
    if (timeLeft <= 0) {
      if (!sentRef.current) { sentRef.current = true; onDoneRef.current(); }
      return;
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const handleConfirm = async () => {
    if (sentRef.current || !selected) return;
    sentRef.current = true;
    setConfirmed(true);

    const target = candidates.find(p => p.uid === selected);
    if (target) {
      // Guardar maldición en el juego: el procesador de votos sumará +1 a este jugador
      await setDoc(doc(db, 'games', gameId), {
        cursed: { uid: target.uid, byName: victimName, byUid: victimUid, round },
        narratorBroadcast: {
          text: `Con su último aliento, ${victimName} lanza su maldición sobre ${target.name}. El destino ya está escrito.`,
          style: 'chaos',
          ts: Date.now(),
        },
      }, { merge: true }).catch(() => {});
    }

    setTimeout(() => onDoneRef.current(), 1800);
  };

  const pct = timeLeft / TIMER_SECS;

  return (
    <div
      className={`fixed inset-0 z-60 flex flex-col items-center justify-center bg-black/96 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="absolute inset-0 bg-purple-950/20 animate-pulse pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center gap-5">

        {/* Ícono */}
        <div className="relative">
          <Flame className="h-14 w-14 text-purple-400 animate-bounce" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 blur-2xl bg-purple-600/30 rounded-full" />
        </div>

        {/* Título */}
        <div className="text-center">
          <p className="text-purple-400/60 text-xs uppercase tracking-widest mb-1">Poder final</p>
          <h2 className="text-2xl font-bold text-purple-100 font-headline">¿A quién maldices?</h2>
          <p className="text-white/35 text-sm mt-1">Tu maldición pesará en la próxima votación</p>
        </div>

        {/* Timer */}
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#ffffff10" strokeWidth="5" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              stroke="#a855f7"
              strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white/80">{timeLeft}</span>
          </div>
        </div>

        {/* Lista de jugadores */}
        {!confirmed ? (
          <>
            <div className="w-full flex flex-col gap-2 max-h-52 overflow-y-auto">
              {candidates.map(p => (
                <button
                  key={p.uid}
                  onClick={() => setSelected(p.uid)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                    ${selected === p.uid
                      ? 'bg-purple-800/40 border-purple-500/60 text-purple-100'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                >
                  <span className="text-xl">{selected === p.uid ? '🔱' : '👤'}</span>
                  <span className="font-medium">{p.name}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => { sentRef.current = true; onDoneRef.current(); }}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/50 text-sm transition-all"
              >
                Perdonar a todos
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selected}
                className="flex-1 py-2.5 bg-purple-700/70 hover:bg-purple-600/80 disabled:opacity-30 border border-purple-500/40 rounded-xl text-white font-semibold text-sm transition-all"
              >
                Maldecir
              </button>
            </div>
          </>
        ) : (
          <div className="text-center animate-fade-in">
            <p className="text-purple-300 text-lg font-bold">🔱 Maldición lanzada</p>
            <p className="text-white/40 text-sm mt-1">El pueblo pagará el precio de su decisión.</p>
          </div>
        )}
      </div>
    </div>
  );
}
