'use client';

/**
 * ShareMomentCard
 * Tarjeta de "clip" que aparece tras cada momento dramático del juego.
 * Permite compartir por Web Share API o simplemente hacer screenshot.
 */
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
    bg: 'from-red-950 via-black to-gray-950',
    border: 'border-red-700/50',
    glow: 'shadow-red-900/60',
    icon: '💀',
    label: 'ELIMINADO POR LOS LOBOS',
    tagline: (name: string, role: string | null) =>
      `${name} ha muerto. Era ${role ?? 'aldeano'}.`,
  },
  exile: {
    bg: 'from-amber-950 via-black to-gray-950',
    border: 'border-amber-700/50',
    glow: 'shadow-amber-900/60',
    icon: '⚖️',
    label: 'DESTERRADO POR EL PUEBLO',
    tagline: (name: string, role: string | null, wasWolf?: boolean) =>
      wasWolf
        ? `${name} era ${role ?? 'aldeano'}. ¡El pueblo acertó!`
        : `${name} era inocente. El pueblo se equivocó.`,
  },
  safe: {
    bg: 'from-emerald-950 via-black to-gray-950',
    border: 'border-emerald-700/50',
    glow: 'shadow-emerald-900/60',
    icon: '🌙',
    label: 'EL PUEBLO SOBREVIVIÓ ESTA NOCHE',
    tagline: () => 'Los lobos descansaron. Por ahora.',
  },
  chaos: {
    bg: 'from-purple-950 via-black to-gray-950',
    border: 'border-purple-700/50',
    glow: 'shadow-purple-900/60',
    icon: '🌪️',
    label: 'EVENTO DE CAOS',
    tagline: () => 'Las reglas ya no aplican.',
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

  // Auto-continúa tras countdown
  useEffect(() => {
    if (countdown <= 0) { onContinue(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onContinue]);

  const shareUrl = gameUrl ?? (typeof window !== 'undefined' ? `${window.location.origin}` : 'https://elpuebloduerme.com');
  const shareText = victimName
    ? `"${cfg.tagline(victimName, victimRole ?? null, wasWolf)}" — Ronda ${round}. ${survivorsCount} jugadores sobreviven. #ElPuebloDuerme`
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
      className={`fixed inset-0 z-[70] flex items-center justify-center p-4 transition-all duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Tarjeta principal — diseñada para screenshot */}
      <div
        className={`relative w-full max-w-sm rounded-3xl border ${cfg.border} bg-gradient-to-b ${cfg.bg} shadow-2xl ${cfg.glow} overflow-hidden`}
        style={{ aspectRatio: '9/14' }}
      >
        {/* Ruido de textura */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
        }} />

        <div className="relative z-10 flex flex-col items-center justify-between h-full px-6 py-8 text-center">
          {/* Header */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-[9px] uppercase tracking-[0.35em] text-white/30 font-mono">
              El Pueblo Duerme · Ronda {round}
            </p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/20">
              {survivorsCount} jugadores sobreviven
            </p>
          </div>

          {/* Icono central */}
          <div className="flex flex-col items-center gap-4 flex-1 justify-center">
            <div className="text-6xl animate-bounce" style={{ animationDuration: '3s' }}>
              {cfg.icon}
            </div>

            {/* Label del evento */}
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              {cfg.label}
            </p>

            {/* Nombre de la víctima */}
            {victimName && (
              <div className="flex flex-col items-center gap-2">
                {victimRole && (
                  <img
                    src={getRoleIcon(victimRole)}
                    alt={victimRole}
                    className="w-12 h-12 rounded-full object-cover border border-white/20 shadow-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <h2 className="text-4xl font-bold text-white font-headline leading-none">
                  {victimName}
                </h2>
                {victimRole && (
                  <p className="text-white/50 text-xs">
                    Era <span className="text-white/80 font-semibold">{victimRole}</span>
                    {type === 'exile' && (
                      <span className={wasWolf ? ' text-emerald-400' : ' text-red-400'}>
                        {wasWolf ? ' · Lobo detectado' : ' · Inocente'}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Últimas conversaciones del pueblo */}
            {lastMessages && lastMessages.length > 0 && (
              <div className="w-full mt-2 flex flex-col gap-1.5 px-1">
                {lastMessages.slice(-3).map((m, i) => (
                  <div key={i} className={`flex items-start gap-1.5 text-left rounded-lg px-2.5 py-1.5
                    ${m.type === 'lastWords'
                      ? 'bg-red-900/40 border border-red-600/30'
                      : 'bg-white/5 border border-white/10'}`}>
                    <span className="text-white/40 text-[9px] font-semibold shrink-0 pt-0.5">
                      {m.type === 'lastWords' ? '⚰️' : '💬'} {m.senderName}:
                    </span>
                    <span className="text-white/70 text-[9px] italic leading-relaxed">{m.text.slice(0, 60)}{m.text.length > 60 ? '…' : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tagline */}
            <p className="text-white/60 text-xs leading-relaxed italic font-serif max-w-[200px]">
              "{victimName
                ? cfg.tagline(victimName, victimRole ?? null, wasWolf)
                : cfg.tagline('', null)}"
            </p>
          </div>

          {/* Footer — CTA viral */}
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-[10px] text-white/30 font-mono">elpuebloduerme.com</p>
            <div className="flex items-center gap-1 text-[9px] text-white/20">
              <span>#ElPuebloDuerme</span>
              <span>·</span>
              <span>#JuegoSocial</span>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de acción — fuera de la tarjeta */}
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-3 px-8">
        <button
          onClick={handleShare}
          className="w-full max-w-xs bg-white text-black font-bold py-3 rounded-2xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform shadow-xl"
        >
          {shared ? '✓ ¡Copiado!' : '📱 Compartir momento'}
        </button>
        <button
          onClick={onContinue}
          className="text-white/40 hover:text-white/70 text-xs transition-colors"
        >
          Continuar ({countdown}s)
        </button>
      </div>
    </div>
  );
}
