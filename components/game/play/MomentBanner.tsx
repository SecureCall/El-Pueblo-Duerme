'use client';

import { useEffect, useState } from 'react';

export interface Moment {
  id: string;
  emoji: string;
  headline: string;
  subtext: string;
  color: 'red' | 'gold' | 'blue' | 'purple' | 'green';
}

interface Props {
  moment: Moment | null;
  onDone: () => void;
}

const COLORS = {
  red:    'from-red-950/95 via-red-900/90 to-black/95 border-red-500/50',
  gold:   'from-yellow-950/95 via-yellow-900/90 to-black/95 border-yellow-500/50',
  blue:   'from-blue-950/95 via-blue-900/90 to-black/95 border-blue-500/50',
  purple: 'from-purple-950/95 via-purple-900/90 to-black/95 border-purple-500/50',
  green:  'from-green-950/95 via-green-900/90 to-black/95 border-green-500/50',
};

const TEXT_COLORS = {
  red:    'text-red-300',
  gold:   'text-yellow-300',
  blue:   'text-blue-300',
  purple: 'text-purple-300',
  green:  'text-green-300',
};

export function MomentBanner({ moment, onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!moment) return;
    setVisible(false);
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => setVisible(false), 3800);
    const t3 = setTimeout(onDone, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?.id]);

  if (!moment) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[150] flex justify-center px-4 pt-4 pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-24px)',
        transition: visible
          ? 'opacity 0.45s ease-out, transform 0.45s ease-out'
          : 'opacity 0.55s ease-in, transform 0.55s ease-in',
      }}
    >
      <div
        className={`w-full max-w-md rounded-2xl border bg-gradient-to-br ${COLORS[moment.color]} px-5 py-4 shadow-2xl`}
        style={{ backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl flex-shrink-0 drop-shadow-lg">{moment.emoji}</span>
          <div className="min-w-0">
            <p className={`font-black text-base leading-tight ${TEXT_COLORS[moment.color]} drop-shadow`}>
              {moment.headline}
            </p>
            <p className="text-white/60 text-sm mt-0.5 leading-snug">{moment.subtext}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function buildMoment(
  type: string,
  data: Record<string, string | number> = {}
): Moment {
  const id = `${type}-${Date.now()}`;
  switch (type) {
    case 'last_wolf':
      return { id, emoji: '🐺', headline: '¡Solo queda un lobo!', subtext: `${data.name} lucha solo contra el pueblo.`, color: 'red' };
    case 'wolf_eliminated':
      return { id, emoji: '🎯', headline: `¡${data.name} era un lobo!`, subtext: 'El pueblo ha eliminado a un hombre lobo.', color: 'gold' };
    case 'solo_close':
      return { id, emoji: '⚠️', headline: '¡Un rol solitario está a punto de ganar!', subtext: `${data.name} ejecuta su plan maestro.`, color: 'purple' };
    case 'tie_vote':
      return { id, emoji: '⚖️', headline: 'Empate en la votación', subtext: 'El destino del pueblo pende de un hilo.', color: 'blue' };
    case 'unexpected_death':
      return { id, emoji: '💀', headline: `¡${data.name} ha caído!`, subtext: `Nadie esperaba perder al ${data.role}.`, color: 'red' };
    case 'seer_reveal':
      return { id, emoji: '🔮', headline: 'La vidente ha actuado', subtext: 'Alguien conoce la verdad esta noche.', color: 'purple' };
    case 'witch_save':
      return { id, emoji: '🧪', headline: '¡Milagro en el pueblo!', subtext: 'La hechicera ha salvado una vida esta noche.', color: 'green' };
    case 'final_battle':
      return { id, emoji: '⚔️', headline: '¡Batalla final!', subtext: 'El destino de El Pueblo se decide ahora.', color: 'gold' };
    case 'wolves_winning':
      return { id, emoji: '🐺', headline: 'Los lobos están ganando', subtext: 'El pueblo debe actuar con urgencia.', color: 'red' };
    default:
      return { id, emoji: '🌙', headline: data.headline as string ?? 'Algo ha ocurrido', subtext: data.subtext as string ?? '', color: 'blue' };
  }
}
