'use client';

import { useEffect, useState, useRef } from 'react';
import type { RandomEvent } from './roles';

interface Props {
  event: RandomEvent;
  round: number;
  onDone: () => void;
}

const EVENT_THEMES: Record<string, { bg: string; glow: string; textColor: string }> = {
  noExile:       { bg: 'from-slate-950 to-slate-900',    glow: '#475569', textColor: '#94a3b8' },
  doubleKill:    { bg: 'from-red-950 to-black',          glow: '#ef4444', textColor: '#fca5a5' },
  eclipse:       { bg: 'from-red-950 to-black',          glow: '#ef4444', textColor: '#fca5a5' },
  revealDead:    { bg: 'from-cyan-950 to-black',         glow: '#06b6d4', textColor: '#a5f3fc' },
  healWitch:     { bg: 'from-emerald-950 to-black',      glow: '#10b981', textColor: '#6ee7b7' },
  anonymousVotes:{ bg: 'from-purple-950 to-black',       glow: '#8b5cf6', textColor: '#c4b5fd' },
  extraTime:     { bg: 'from-blue-950 to-black',         glow: '#3b82f6', textColor: '#93c5fd' },
  halfTime:      { bg: 'from-orange-950 to-black',       glow: '#f97316', textColor: '#fdba74' },
  doubleSeer:    { bg: 'from-indigo-950 to-black',       glow: '#6366f1', textColor: '#a5b4fc' },
  roleSwap:      { bg: 'from-fuchsia-950 to-black',      glow: '#d946ef', textColor: '#f0abfc' },
  inverterVotes: { bg: 'from-yellow-950 to-black',       glow: '#eab308', textColor: '#fde047' },
  aiEliminate:   { bg: 'from-rose-950 to-black',         glow: '#f43f5e', textColor: '#fda4af' },
};

const DEFAULT_THEME = { bg: 'from-gray-950 to-black', glow: '#6b7280', textColor: '#d1d5db' };

const AUTO_SECONDS = 7;

export function ChaosEventScreen({ event, round, onDone }: Props) {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_SECONDS);
  const [typewritten, setTypewritten] = useState('');
  const doneFired = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const theme = EVENT_THEMES[event.mechanical] ?? DEFAULT_THEME;

  // ── Entrance ──────────────────────────────────────────────────────
  useEffect(() => {
    if ('vibrate' in navigator) navigator.vibrate([200, 80, 200, 80, 400]);
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // ── Typewriter de la descripción ──────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    let idx = 0;
    setTypewritten('');
    const tick = () => {
      idx++;
      setTypewritten(event.description.slice(0, idx));
      if (idx < event.description.length) setTimeout(tick, 22);
    };
    const t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [visible, event.description]);

  // ── Countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (countdown === 0 && !doneFired.current) {
      doneFired.current = true;
      onDoneRef.current();
    }
  }, [countdown]);

  const skip = () => {
    if (doneFired.current) return;
    doneFired.current = true;
    onDoneRef.current();
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-b ${theme.bg} transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={skip}
    >
      {/* Fondo pulsante de color */}
      <div
        className="absolute inset-0 pointer-events-none animate-pulse"
        style={{ background: `radial-gradient(ellipse at center, ${theme.glow}22 0%, transparent 70%)` }}
      />

      {/* Partículas decorativas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20 animate-ping"
            style={{
              width: `${8 + (i % 3) * 6}px`,
              height: `${8 + (i % 3) * 6}px`,
              background: theme.glow,
              left: `${10 + i * 11}%`,
              top: `${20 + (i % 4) * 15}%`,
              animationDuration: `${1.5 + i * 0.4}s`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Contenido central */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 max-w-lg text-center">

        {/* Badge de ronda */}
        <div
          className="text-xs uppercase tracking-[0.3em] px-3 py-1 rounded-full border"
          style={{ color: theme.textColor, borderColor: `${theme.glow}44` }}
        >
          Ronda {round} — Evento Especial
        </div>

        {/* Emoji gigante */}
        <div
          className="text-8xl animate-bounce select-none"
          style={{ animationDuration: '2s', filter: `drop-shadow(0 0 30px ${theme.glow})` }}
        >
          {event.emoji}
        </div>

        {/* Nombre del evento */}
        <h1
          className="text-4xl font-bold font-headline leading-tight"
          style={{ color: theme.textColor, textShadow: `0 0 40px ${theme.glow}` }}
        >
          {event.name}
        </h1>

        {/* Descripción con typewriter */}
        <div
          className="rounded-2xl p-5 w-full border"
          style={{ background: 'rgba(0,0,0,0.6)', borderColor: `${theme.glow}33` }}
        >
          <p
            className="text-base leading-relaxed font-serif italic"
            style={{ color: theme.textColor, opacity: 0.9 }}
          >
            {typewritten}
            {typewritten.length < event.description.length && (
              <span
                className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle"
                style={{ background: theme.glow }}
              />
            )}
          </p>
        </div>

        {/* Countdown + skip */}
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <div className="w-full bg-white/5 rounded-full h-1">
            <div
              className="h-1 rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / AUTO_SECONDS) * 100}%`, background: theme.glow }}
            />
          </div>
          <button
            onClick={skip}
            className="text-white/30 hover:text-white/60 text-xs transition-colors mt-1"
          >
            Toca para continuar → ({countdown}s)
          </button>
        </div>
      </div>
    </div>
  );
}
