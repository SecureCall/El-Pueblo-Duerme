'use client';

import Image from 'next/image';
import { GameState } from '@/lib/game/types';
import { RoleConfig, ROLES } from '@/lib/game/roles';

interface Props {
  game: GameState;
  me: any;
  myRole: RoleConfig | null;
  remaining: number;
  [key: string]: any;
}

const TEAM_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  aldeanos: { bg: 'from-blue-900/60 to-blue-800/40', text: 'text-blue-300', label: 'Equipo Aldeanos' },
  lobos:    { bg: 'from-red-900/60 to-red-800/40',  text: 'text-red-300',  label: 'Equipo Lobos' },
  neutral:  { bg: 'from-purple-900/60 to-purple-800/40', text: 'text-purple-300', label: 'Neutral' },
};

export function RoleReveal({ me, myRole, remaining }: Props) {
  const style = TEAM_STYLE[myRole?.team ?? 'neutral'];

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <div className="text-white/40 text-sm uppercase tracking-widest">Tu rol esta partida</div>

      <div className={`bg-gradient-to-b ${style.bg} border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-5 max-w-sm w-full`}>
        <div className="w-36 h-36 rounded-2xl overflow-hidden ring-4 ring-white/10">
          {myRole?.image && (
            <Image src={myRole.image} alt={myRole.name} width={144} height={144} className="w-full h-full object-cover" />
          )}
        </div>
        <h1 className={`font-headline text-4xl font-bold ${style.text}`}>{myRole?.name ?? '???'}</h1>
        <p className={`text-xs font-semibold uppercase tracking-widest ${style.text}`}>{style.label}</p>
        <p className="text-white/70 text-sm text-center leading-relaxed">{myRole?.description}</p>
      </div>

      <div className="text-white/30 text-sm">
        El juego empieza en <span className="text-white font-bold">{Math.round(remaining)}s</span>
      </div>
      <p className="text-white/20 text-xs">¡No reveles tu rol a nadie!</p>
    </div>
  );
}
