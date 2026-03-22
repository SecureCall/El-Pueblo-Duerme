'use client';

import { GameState } from '@/lib/game/types';
import { ROLES } from '@/lib/game/roles';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Props { game: GameState; me: any; user: any; [key: string]: any; }

const WIN_STYLES: Record<string, { emoji: string; title: string; subtitle: string; bg: string; border: string }> = {
  aldeanos: { emoji: '🏆', title: '¡El pueblo ha triunfado!', subtitle: 'Los lobos han sido eliminados. El pueblo sobrevive.', bg: 'from-blue-900/60 to-blue-800/30', border: 'border-blue-500/30' },
  lobos:    { emoji: '🐺', title: '¡Los lobos han ganado!', subtitle: 'El pueblo no pudo descubrirlos. Los lobos dominan la aldea.', bg: 'from-red-900/60 to-red-800/30', border: 'border-red-500/30' },
  vampiro:  { emoji: '🧛', title: '¡El vampiro ha ganado!', subtitle: 'La oscuridad se apoderó del pueblo.', bg: 'from-purple-900/60 to-purple-800/30', border: 'border-purple-500/30' },
  hombre_ebrio: { emoji: '🍺', title: '¡El Hombre Ebrio ha ganado!', subtitle: 'Logró lo imposible: ¡ser eliminado!', bg: 'from-yellow-900/60 to-yellow-800/30', border: 'border-yellow-500/30' },
  verdugo:  { emoji: '⚔️', title: '¡El Verdugo ha ganado!', subtitle: 'Sus predicciones resultaron ser correctas.', bg: 'from-gray-900/60 to-gray-800/30', border: 'border-gray-500/30' },
  default:  { emoji: '🎭', title: '¡Partida terminada!', subtitle: 'Ha concluido la noche más larga.', bg: 'from-gray-900/60 to-gray-800/30', border: 'border-white/10' },
};

export function GameEnded({ game, me, user }: Props) {
  const router = useRouter();
  const style = WIN_STYLES[game.winner ?? 'default'] ?? WIN_STYLES.default;
  const myRole = me?.role ? ROLES[me.role] : null;
  const myTeam = myRole?.team;
  const didIWin = game.winnerTeam === myTeam || game.winner === me?.role;

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6 overflow-y-auto">
      <div className={`bg-gradient-to-b ${style.bg} border ${style.border} rounded-3xl p-8 flex flex-col items-center gap-4 max-w-md w-full`}>
        <div className="text-6xl">{style.emoji}</div>
        <h1 className="font-headline text-3xl font-bold text-white text-center">{style.title}</h1>
        <p className="text-white/60 text-sm text-center">{style.subtitle}</p>

        <div className={`mt-2 px-4 py-2 rounded-full border text-sm font-bold ${didIWin ? 'bg-green-900/40 border-green-500/40 text-green-300' : 'bg-red-900/40 border-red-500/40 text-red-300'}`}>
          {didIWin ? '🎉 ¡Has ganado!' : '💀 Has perdido'}
        </div>
      </div>

      {/* Players revealed */}
      <div className="w-full max-w-md">
        <p className="text-white/40 text-xs uppercase tracking-widest text-center mb-3">Roles revelados</p>
        <div className="grid grid-cols-2 gap-2">
          {game.players.map(p => {
            const role = p.role ? ROLES[p.role] : null;
            return (
              <div key={p.uid} className={`flex items-center gap-2 p-2.5 rounded-xl border ${p.isAlive ? 'border-white/10 bg-white/5' : 'border-white/5 bg-black/20 opacity-60'}`}>
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
                  {p.photoURL ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="w-full h-full flex items-center justify-center text-xs font-bold">{p.name[0]}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-white/40 truncate">{role?.name ?? '???'}</p>
                </div>
                {!p.isAlive && <span className="ml-auto text-xs">⚰️</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => router.push('/')} className="bg-white text-black font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors">
          Volver al inicio
        </button>
        <button onClick={() => router.push('/create')} className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl hover:bg-white/20 transition-colors">
          Nueva partida
        </button>
      </div>
    </div>
  );
}
