'use client';

import { useEffect, useState } from 'react';
import { getRoleIcon } from './roleIcons';

interface ChatSnippet {
  senderName: string;
  text: string;
  type?: string;
}

interface Props {
  type: 'death' | 'exile' | 'safe' | 'chaos';
  victimName?: string | null;
  victimRole?: string | null;
  wasWolf?: boolean;
  round: number;
  survivorsCount: number;
  gameUrl?: string;
  lastMessages?: ChatSnippet[];
  onContinue: () => void;
}

const TYPE_CONFIG = {
  death: {
    accent: '#dc2626',
    accentDim: 'rgba(220,38,38,0.15)',
    icon: '💀',
    label: 'ELIMINADO POR LOS LOBOS',
    tagline: (name: string, role: string | null) =>
      `"${name} ha muerto. Era ${role ?? 'aldeano'}."`,
  },
  exile: {
    accent: '#d97706',
    accentDim: 'rgba(217,119,6,0.15)',
    icon: '⚖️',
    label: 'DESTERRADO POR EL PUEBLO',
    tagline: (name: string, role: string | null, wasWolf?: boolean) =>
      wasWolf
        ? `"${name} era ${role ?? 'aldeano'}. ¡El pueblo acertó!"`
        : `"${name} era inocente. El pueblo se equivocó."`,
  },
  safe: {
    accent: '#16a34a',
    accentDim: 'rgba(22,163,74,0.15)',
    icon: '🌙',
    label: 'EL PUEBLO SOBREVIVIÓ',
    tagline: () => '"Los lobos descansaron. Por ahora."',
  },
  chaos: {
    accent: '#9333ea',
    accentDim: 'rgba(147,51,234,0.15)',
    icon: '🌪️',
    label: 'EVENTO DE CAOS',
    tagline: () => '"Las reglas ya no aplican."',
  },
};

export function ShareMomentCard({
  type, victimName, victimRole, wasWolf, round, survivorsCount, gameUrl, lastMessages, onContinue,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [shared, setShared] = useState(false);
  const [countdown, setCountdown] = useState(7);
  const cfg = TYPE_CONFIG[type];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) { onContinue(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onContinue]);

  const shareUrl = gameUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}` : 'https://elpuebloduerme.com');
  const shareText = victimName
    ? `${cfg.tagline(victimName, victimRole ?? null, wasWolf)} Ronda ${round}. ${survivorsCount} jugadores sobreviven. #ElPuebloDuerme`
    : `¡Jugando El Pueblo Duerme! Ronda ${round}. ${survivorsCount} jugadores vivos. #ElPuebloDuerme`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'El Pueblo Duerme', text: shareText, url: shareUrl });
        setShared(true);
      } catch { /* usuario canceló */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } catch { /* sin clipboard */ }
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center transition-all duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: 'linear-gradient(180deg, #050505 0%, #0d0d0d 100%)' }}
    >
      {/* Resplandor de color según tipo */}
      <div
        className="absolute inset-x-0 top-0 h-64 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${cfg.accentDim}, transparent)` }}
      />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-8 text-center gap-6">

        {/* Ronda */}
        <p className="text-[9px] uppercase tracking-[0.4em] font-mono" style={{ color: cfg.accent, opacity: 0.6 }}>
          El Pueblo Duerme · Ronda {round}
        </p>

        {/* Ícono */}
        <div className="text-6xl">{cfg.icon}</div>

        {/* Etiqueta evento */}
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
          {cfg.label}
        </p>

        {/* Nombre víctima */}
        {victimName && (
          <div className="flex flex-col items-center gap-3">
            {victimRole && (
              <img
                src={getRoleIcon(victimRole)}
                alt={victimRole}
                className="w-16 h-16 rounded-full object-cover border-2 shadow-xl"
                style={{ borderColor: cfg.accent }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <h2 className="text-4xl font-bold text-white font-headline leading-none">
              {victimName}
            </h2>
            {victimRole && (
              <p className="text-white/40 text-sm">
                Era <span className="text-white/70 font-semibold">{victimRole}</span>
                {type === 'exile' && (
                  <span style={{ color: wasWolf ? '#4ade80' : '#f87171' }}>
                    {wasWolf ? ' · Lobo detectado' : ' · Inocente'}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Últimas palabras */}
        {lastMessages && lastMessages.length > 0 && (
          <div className="w-full flex flex-col gap-1.5">
            {lastMessages.slice(-3).map((m, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-left rounded-lg px-3 py-2"
                style={{
                  background: m.type === 'lastWords'
                    ? 'rgba(220,38,38,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${m.type === 'lastWords' ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <span className="text-white/30 text-[9px] font-semibold shrink-0 pt-0.5">
                  {m.type === 'lastWords' ? '⚰️' : '💬'} {m.senderName}:
                </span>
                <span className="text-white/50 text-[9px] italic leading-relaxed">
                  {m.text.slice(0, 60)}{m.text.length > 60 ? '…' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tagline */}
        <p className="text-white/35 text-sm leading-relaxed italic font-serif">
          {victimName
            ? cfg.tagline(victimName, victimRole ?? null, wasWolf)
            : cfg.tagline('', null)}
        </p>

        {/* Divisor */}
        <div className="w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${cfg.accent}40, transparent)` }} />

        {/* Botones */}
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            onClick={handleShare}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {shared ? '✓ ¡Copiado!' : '📤 Compartir momento'}
          </button>
          <button
            onClick={onContinue}
            className="text-white/25 hover:text-white/50 text-xs transition-colors"
          >
            Continuar ({countdown}s)
          </button>
        </div>

        {/* Watermark */}
        <p className="text-white/10 text-[9px] font-mono tracking-widest mt-2">
          elpuebloduerme.com · #ElPuebloDuerme
        </p>
      </div>
    </div>
  );
}
