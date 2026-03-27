'use client';

import { useEffect } from 'react';
import { GameState } from './GamePlay';
import { ROLES } from './roles';
import { getRoleIcon } from './roleIcons';
import { Trophy, Skull, Home, RefreshCw, Clock } from 'lucide-react';
import { useNarrator, NARRATIONS } from '@/hooks/useNarrator';
import { AdBanner } from '@/components/ads/AdBanner';
import { RewardedAd } from '@/components/ads/RewardedAd';

interface Props {
  game: GameState;
  myRole?: string;
  myUid?: string;
  isHost?: boolean;
  winners: string | null;
  winMessage: string;
  onPlayAgain: () => void;
  onPlayAgainSameRoom?: () => void;
}

function getWinnerDisplay(winners: string | null): { emoji: string; title: string } {
  switch (winners) {
    case 'village':   return { emoji: '🏆', title: '¡Victoria del Pueblo!' };
    case 'wolves':    return { emoji: '🐺', title: '¡Los Lobos Han Ganado!' };
    case 'flautista': return { emoji: '🪈', title: '¡El Flautista Ha Hechizado al Pueblo!' };
    case 'angel':     return { emoji: '😇', title: '¡El Ángel Ha Ganado!' };
    case 'picaro':    return { emoji: '🃏', title: '¡El Pícaro Ha Ganado!' };
    case 'vampiro':   return { emoji: '🧛', title: '¡El Vampiro Ha Ganado!' };
    case 'ebrio':     return { emoji: '🍺', title: '¡El Ebrio Se Ha Llevado la Victoria!' };
    case 'verdugo':   return { emoji: '🪓', title: '¡El Verdugo Ha Triunfado!' };
    case 'culto':     return { emoji: '🕯️', title: '¡El Culto Ha Tomado el Pueblo!' };
    case 'pescador':  return { emoji: '🎣', title: '¡El Pescador Ha Ganado!' };
    default:          return { emoji: '⚖️', title: 'Partida Terminada' };
  }
}

function didIWin(winners: string | null, myRole?: string): boolean {
  if (!myRole || !winners) return false;
  const roleInfo = ROLES[myRole];
  if (!roleInfo) return false;

  if (winners === 'village')   return roleInfo.team === 'village';
  if (winners === 'wolves')    return roleInfo.team === 'wolves';
  if (winners === 'flautista') return myRole === 'Flautista';
  if (winners === 'angel')     return myRole === 'Ángel';
  if (winners === 'picaro')    return myRole === 'Pícaro';
  if (winners === 'vampiro')   return myRole === 'Vampiro';
  if (winners === 'ebrio')     return myRole === 'Ebrio';
  if (winners === 'verdugo')   return myRole === 'Verdugo';
  if (winners === 'culto')     return myRole === 'Líder del Culto';
  if (winners === 'pescador')  return myRole === 'Pescador';
  return false;
}

export function EndGame({ game, myRole, myUid, isHost, winners, winMessage, onPlayAgain, onPlayAgainSameRoom }: Props) {
  const { emoji, title } = getWinnerDisplay(winners);
  const iWon = didIWin(winners, myRole);
  const { interruptWith } = useNarrator();

  useEffect(() => {
    // Cut through any lingering audio (debate ambient, night sounds, etc.)
    // and play the victory narration cleanly.
    const timer = setTimeout(() => {
      interruptWith(NARRATIONS.winMessage(winners));
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winners]);

  const allPlayers = game.players ?? [];
  const eliminated = game.eliminatedHistory ?? [];

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col items-center justify-center px-4"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative z-10 w-full max-w-md text-center">

        <div className="text-8xl mb-4 animate-bounce">{emoji}</div>

        <h1 className="font-headline text-4xl font-bold mb-2">{title}</h1>

        <p className="text-white/60 mb-2">{winMessage}</p>

        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-8 ${
          iWon
            ? 'bg-green-500/20 text-green-400 border border-green-500/40'
            : 'bg-red-500/20 text-red-400 border border-red-500/40'
        }`}>
          {iWon ? <Trophy className="h-4 w-4" /> : <Skull className="h-4 w-4" />}
          {iWon ? `¡Has ganado como ${myRole}!` : `Has perdido como ${myRole}`}
        </div>

        {/* Roles revealed */}
        <div className="bg-black/50 border border-white/10 rounded-2xl p-5 mb-4 text-left">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-3">Roles revelados</p>
          <div className="space-y-2">
            {allPlayers.map(p => {
              const role = game.roles?.[p.uid] ?? 'Aldeano';
              const roleInfo = ROLES[role];
              const teamColor = roleInfo?.team === 'wolves'
                ? 'bg-red-900/40 text-red-300'
                : roleInfo?.team === 'solo'
                  ? 'bg-cyan-900/40 text-cyan-300'
                  : 'bg-green-900/40 text-green-300';
              return (
                <div key={p.uid} className={`flex items-center gap-3 ${!p.isAlive ? 'opacity-50' : ''}`}>
                  <img src={getRoleIcon(role)} alt={role} className="w-6 h-6 object-cover rounded flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{p.name}</span>
                    {p.uid === game.hostUid && <span className="text-yellow-400 text-xs ml-1">👑</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${teamColor}`}>
                    {role}
                  </span>
                  {!p.isAlive && <Skull className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Elimination order */}
        {eliminated.length > 0 && (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-6 text-left">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-3">Orden de eliminación</p>
            <div className="space-y-1">
              {eliminated.map((e, i) => {
                const roleInfo = ROLES[e.role];
                return (
                  <div key={`${e.uid}-${i}`} className="flex items-center gap-2 text-sm">
                    <span className="text-white/30 w-4 text-right flex-shrink-0">{i + 1}.</span>
                    <img src={getRoleIcon(e.role)} alt={e.role} className="w-6 h-6 object-cover rounded flex-shrink-0" />
                    <span className="text-white/70">{e.name}</span>
                    <span className="text-white/30 text-xs ml-auto">Ronda {e.round}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Anuncio recompensado — gana monedas viendo un anuncio */}
        {myUid && (
          <div className="mb-4">
            <RewardedAd userId={myUid} coinsReward={50} />
          </div>
        )}

        {/* Banner de AdSense */}
        <AdBanner format="horizontal" className="mb-4" />

        {/* Play again in same room */}
        <div className="space-y-3">
          {onPlayAgainSameRoom && isHost && (
            <button
              onClick={onPlayAgainSameRoom}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-400 text-black font-bold py-4 rounded-xl transition-all text-lg shadow-lg shadow-yellow-900/30"
            >
              <RefreshCw className="h-5 w-5" />
              Volver a jugar en esta sala
            </button>
          )}
          {onPlayAgainSameRoom && !isHost && (
            <div className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white/50 py-4 rounded-xl text-sm">
              <Clock className="h-4 w-4" />
              Esperando al anfitrión para jugar de nuevo…
            </div>
          )}
          <button
            onClick={onPlayAgain}
            className="w-full flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 active:bg-white/25 text-white font-semibold py-3 rounded-xl transition-all border border-white/20"
          >
            <Home className="h-5 w-5" />
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
