'use client';

/**
 * NarratorBroadcast
 * Muestra mensajes dramáticos del narrador IA durante el debate.
 * El anfitrión escribe en games/{gameId}.narratorBroadcast y
 * todos los jugadores ven el mensaje aparecer.
 */
import { useEffect, useState, useRef } from 'react';

interface BroadcastData {
  text: string;
  type: 'warning' | 'suspicion' | 'chaos' | 'irony' | 'accusation';
  triggeredAt: number;
}

interface Props {
  broadcast: BroadcastData | null;
}

const TYPE_STYLE = {
  warning:    { border: 'border-red-500/60',    bg: 'bg-red-950/90',    icon: '⚠️', label: 'ALERTA' },
  suspicion:  { border: 'border-purple-500/60', bg: 'bg-purple-950/90', icon: '🔮', label: 'SOSPECHA' },
  chaos:      { border: 'border-orange-500/60', bg: 'bg-orange-950/90', icon: '🌪️', label: 'CAOS' },
  irony:      { border: 'border-gray-500/60',   bg: 'bg-gray-900/95',   icon: '🎭', label: 'NARRADOR' },
  accusation: { border: 'border-yellow-500/60', bg: 'bg-yellow-950/90', icon: '👁️', label: 'ACUSACIÓN' },
};

function useTypewriter(text: string, speed = 25) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) return;
    setDisplayed('');
    setDone(false);
    let idx = 0;
    const tick = () => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) { setDone(true); return; }
      setTimeout(tick, speed);
    };
    const t = setTimeout(tick, 200);
    return () => clearTimeout(t);
  }, [text, speed]);

  return { displayed, done };
}

export function NarratorBroadcast({ broadcast }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState<BroadcastData | null>(null);
  const lastSeenAt = useRef<number>(0);

  useEffect(() => {
    if (!broadcast) return;
    if (broadcast.triggeredAt === lastSeenAt.current) return;
    lastSeenAt.current = broadcast.triggeredAt;

    // Resetear y mostrar nuevo mensaje
    setExiting(false);
    setCurrentBroadcast(broadcast);
    setVisible(false);
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

    const tIn = setTimeout(() => setVisible(true), 50);
    const tOut = setTimeout(() => {
      setExiting(true);
      setTimeout(() => { setVisible(false); setExiting(false); }, 600);
    }, 9000);

    return () => { clearTimeout(tIn); clearTimeout(tOut); };
  }, [broadcast?.triggeredAt]);

  if (!currentBroadcast || !visible) return null;

  const style = TYPE_STYLE[currentBroadcast.type] ?? TYPE_STYLE.irony;
  const { displayed, done } = useTypewriter(currentBroadcast.text);

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[55] w-full max-w-sm px-4 transition-all duration-500 ${
        visible && !exiting ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className={`${style.bg} ${style.border} border rounded-2xl px-5 py-4 shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{style.icon}</span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-semibold">
            {style.label} — El Narrador
          </span>
          {/* Indicador activo */}
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        </div>

        {/* Texto con typewriter */}
        <p className="text-white text-sm leading-relaxed font-serif italic">
          "{displayed}
          {!done && (
            <span className="inline-block w-0.5 h-3.5 bg-white/60 ml-0.5 animate-pulse align-middle" />
          )}"
        </p>
      </div>
    </div>
  );
}
