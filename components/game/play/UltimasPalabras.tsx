'use client';

/**
 * UltimasPalabras
 * Mecánica "firma": el jugador que muere tiene 7 segundos para decir su última palabra.
 * Los demás ven el contador en tiempo real.
 * Tras enviar (o que expire), opcionalmente se abre VenganzaModal.
 *
 * La escritura de la última palabra es server-authoritative: el cliente nunca
 * escribe directamente en games/{gameId} ni publicChat.
 */

import { useEffect, useRef, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Skull, Send } from 'lucide-react';

interface Props {
  isVictim: boolean;
  victimName: string;
  victimUid: string;
  gameId: string;
  userId: string;
  round: number;
  onDone: (didSend: boolean) => void;
}

const TIMER_SECS = 7;
const MAX_MESSAGE_LENGTH = 120;

export function UltimasPalabras({ isVictim, victimName, victimUid, gameId, userId, round, onDone }: Props) {
  const [timeLeft, setTimeLeft] = useState(TIMER_SECS);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [visible, setVisible] = useState(false);
  const sentRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (sentRef.current) return;
    if (timeLeft <= 0) {
      if (!sentRef.current) {
        sentRef.current = true;
        onDoneRef.current(false);
      }
      return;
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const handleSend = async () => {
    const message = msg.trim();
    if (!isVictim || sentRef.current || !message || message.length > MAX_MESSAGE_LENGTH) return;
    if (!userId || userId !== victimUid) return;

    try {
      const currentUser = getAuth().currentUser;
      const token = await currentUser?.getIdToken();
      if (!token || sentRef.current) return;

      const response = await fetch('/api/last-words', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ gameId, message, round }),
      });

      if (response.ok) {
        sentRef.current = true;
        setSent(true);
        onDoneRef.current(true);
        return;
      }

      if (response.status === 409) {
        const data = await response.json().catch(() => null);
        if (data?.error === 'Las últimas palabras ya fueron enviadas') {
          sentRef.current = true;
          setSent(true);
          onDoneRef.current(false);
        }
      }
    } catch (_) {
      // Conservamos el intento si falla la red para permitir reintentar antes
      // de que expire el contador.
    }
  };

  const pct = timeLeft / TIMER_SECS;

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="absolute inset-0 bg-red-950/20 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center gap-6">
        <div className="relative">
          <Skull className="h-14 w-14 text-red-400/80" />
          <div className="absolute inset-0 blur-2xl bg-red-600/20 rounded-full" />
        </div>

        <div className="text-center">
          {isVictim ? (
            <>
              <p className="text-red-400/60 text-xs uppercase tracking-widest mb-1">Tus últimas palabras</p>
              <h2 className="text-2xl font-bold text-red-100/90 font-headline">¿Tienes algo que decir?</h2>
            </>
          ) : (
            <>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Últimas palabras</p>
              <h2 className="text-2xl font-bold text-white/80 font-headline">{victimName} habla por última vez…</h2>
            </>
          )}
        </div>

        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#ffffff10" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke={pct > 0.4 ? '#ef4444' : '#ff8800'}
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white/90">{timeLeft}</span>
          </div>
        </div>

        {isVictim && !sent && (
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="w-full flex flex-col gap-3">
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              placeholder="Escribe tu última verdad…"
              autoFocus
              rows={3}
              maxLength={MAX_MESSAGE_LENGTH}
              className="w-full bg-white/5 border border-red-900/40 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-red-600/60"
            />
            <div className="flex items-center justify-between">
              <span className="text-white/25 text-xs">{msg.length}/{MAX_MESSAGE_LENGTH}</span>
              <button
                type="submit"
                disabled={!msg.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-red-700/80 hover:bg-red-600/90 disabled:opacity-30 rounded-xl text-white text-sm font-semibold transition-all"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </div>
          </form>
        )}

        {isVictim && sent && (
          <p className="text-green-400/70 text-sm animate-fade-in">Mensaje enviado. El pueblo lo recuerda.</p>
        )}

        {!isVictim && (
          <p className="text-white/30 text-sm text-center italic">El silencio del pueblo espera sus palabras…</p>
        )}
      </div>
    </div>
  );
}
