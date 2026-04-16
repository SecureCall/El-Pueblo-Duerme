'use client';

import { useEffect, useRef, useState } from 'react';
import { GameState } from './GamePlay';
import { ROLES } from './roles';
import { getRoleIcon } from './roleIcons';
import { Trophy, Skull, Home, RefreshCw, Clock, Star, Share2, Users, BookOpen, Swords } from 'lucide-react';
import { useNarrator, NARRATIONS } from '@/hooks/useNarrator';
import { AdBanner } from '@/components/ads/AdBanner';
import { RewardedAd } from '@/components/ads/RewardedAd';
import { xpToLevel, levelEmoji, awardXP, type XPResult } from '@/lib/firebase/xp';
import { recordGameResult } from '@/lib/bots/playerStats';

interface Props {
  game: GameState;
  myRole?: string;
  myUid?: string;
  isHost?: boolean;
  hostInGame?: boolean;
  winners: string | null;
  winMessage: string;
  onPlayAgain: () => void;
  onPlayAgainSameRoom?: () => void;
}

function getWinnerDisplay(winners: string | null): { emoji: string; title: string; bg: string } {
  switch (winners) {
    case 'village':   return { emoji: '🏆', title: '¡Victoria del Pueblo!',              bg: 'from-yellow-900/60 to-black' };
    case 'wolves':    return { emoji: '🐺', title: '¡Los Lobos Han Ganado!',             bg: 'from-red-900/60 to-black' };
    case 'flautista': return { emoji: '🪈', title: '¡El Flautista Ha Hechizado al Pueblo!', bg: 'from-purple-900/60 to-black' };
    case 'angel':     return { emoji: '😇', title: '¡El Ángel Ha Ganado!',              bg: 'from-blue-900/60 to-black' };
    case 'picaro':    return { emoji: '🃏', title: '¡El Pícaro Ha Ganado!',             bg: 'from-green-900/60 to-black' };
    case 'vampiro':   return { emoji: '🧛', title: '¡El Vampiro Ha Ganado!',            bg: 'from-red-950/60 to-black' };
    case 'ebrio':     return { emoji: '🍺', title: '¡El Ebrio Se Ha Llevado la Victoria!', bg: 'from-orange-900/60 to-black' };
    case 'verdugo':   return { emoji: '🪓', title: '¡El Verdugo Ha Triunfado!',         bg: 'from-stone-900/60 to-black' };
    case 'culto':     return { emoji: '🕯️', title: '¡El Culto Ha Tomado el Pueblo!',  bg: 'from-violet-900/60 to-black' };
    case 'pescador':  return { emoji: '🎣', title: '¡El Pescador Ha Ganado!',           bg: 'from-cyan-900/60 to-black' };
    default:          return { emoji: '⚖️', title: 'Partida Terminada',                 bg: 'from-gray-900/60 to-black' };
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
  if (winners === 'ebrio')     return myRole === 'Hombre Ebrio';
  if (winners === 'verdugo')   return myRole === 'Verdugo';
  if (winners === 'culto')     return myRole === 'Líder del Culto';
  if (winners === 'pescador')  return myRole === 'Pescador';
  return false;
}

function buildShareText(game: GameState, winners: string | null, winMessage: string): string {
  const { title } = getWinnerDisplay(winners);
  const players = game.players ?? [];
  const eliminated = game.eliminatedHistory ?? [];
  const rounds = game.roundNumber ?? eliminated.length;

  const wolfTeamUids = new Set(Object.keys(game.wolfTeam ?? {}));
  const wolves = players.filter(p => wolfTeamUids.has(p.uid));
  const village = players.filter(p => !wolfTeamUids.has(p.uid));

  let text = `🌙 El Pueblo Duerme\n`;
  text += `${title}\n`;
  text += `"${winMessage}"\n\n`;

  if (wolves.length) {
    text += `🐺 Lobos:\n`;
    wolves.forEach(p => {
      const role = game.roles?.[p.uid] ?? 'Lobo';
      text += `  ${p.isAlive ? '✅' : '💀'} ${p.name} (${role})\n`;
    });
    text += `\n`;
  }

  text += `👥 Pueblo:\n`;
  village.forEach(p => {
    const role = game.roles?.[p.uid] ?? 'Aldeano';
    text += `  ${p.isAlive ? '✅' : '💀'} ${p.name} (${role})\n`;
  });

  if (eliminated.length) {
    text += `\n📜 Eliminados:\n`;
    eliminated.forEach((e, i) => {
      text += `  ${i + 1}. ${e.name} (${e.role}) — Ronda ${e.round}\n`;
    });
  }

  text += `\n📊 ${rounds} rondas · ${players.length} jugadores\n`;
  text += `🎮 elpuebloduermevercel.app`;
  return text;
}

type Tab = 'resumen' | 'roles' | 'historia';

export function EndGame({ game, myRole, myUid, isHost, hostInGame = true, winners, winMessage, onPlayAgain, onPlayAgainSameRoom }: Props) {
  const { emoji, title, bg } = getWinnerDisplay(winners);
  const iWon = didIWin(winners, myRole);
  const { interruptWith } = useNarrator();
  const xpAwarded = useRef(false);
  const [xpResult, setXpResult] = useState<XPResult | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [entered, setEntered] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      interruptWith(NARRATIONS.winMessage(winners));
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winners]);

  useEffect(() => {
    if (!myUid || xpAwarded.current) return;
    xpAwarded.current = true;

    const roleInfo = myRole ? ROLES[myRole] : null;
    const hasSpecialRole = !!roleInfo && roleInfo.team !== 'village' && myRole !== 'Aldeano' && myRole !== 'Lobo';

    if (myRole) recordGameResult(myUid, iWon, myRole).catch(() => {});

    const tryServer = () =>
      fetch('/api/award-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: myUid, isWin: iWon, hasSpecialRole }),
      }).then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: XPResult = await r.json();
        if (data.newTotalXp === undefined) throw new Error('respuesta inválida');
        return data;
      });

    const tryClient = () => awardXP(myUid, { isWin: iWon, hasSpecialRole });

    tryServer()
      .then(data => setXpResult(data))
      .catch(() => {
        tryClient()
          .then(data => setXpResult(data))
          .catch(err => console.error('[EndGame] award-xp client fallback falló:', err));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUid]);

  const allPlayers = game.players ?? [];
  const eliminated = game.eliminatedHistory ?? [];
  const survivors = allPlayers.filter(p => p.isAlive);
  const wolfTeamUids = new Set(Object.keys(game.wolfTeam ?? {}));
  const rounds = game.roundNumber ?? eliminated.length;

  const handleShare = async () => {
    const text = buildShareText(game, winners, winMessage);
    try {
      if (navigator.share) {
        await navigator.share({ title: '🌙 El Pueblo Duerme', text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch { /* cancelled */ }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'resumen',  label: 'Resumen',  icon: <Trophy className="h-3.5 w-3.5" /> },
    { id: 'roles',    label: 'Roles',    icon: <Users className="h-3.5 w-3.5" /> },
    { id: 'historia', label: 'Historia', icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col items-center justify-start pb-10"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/85" />

      {/* Hero */}
      <div
        className={`relative z-10 w-full bg-gradient-to-b ${bg} py-10 px-4 text-center border-b border-white/10`}
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0)' : 'translateY(-20px)',
          transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
        }}
      >
        <div
          className="text-7xl mb-3"
          style={{ animation: entered ? 'bounceIn 0.6s 0.3s both' : 'none' }}
        >
          {emoji}
        </div>
        <h1 className="font-headline text-3xl font-bold mb-1">{title}</h1>
        <p className="text-white/50 text-sm mb-3 italic">"{winMessage}"</p>

        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
          iWon
            ? 'bg-green-500/20 text-green-300 border border-green-500/40'
            : 'bg-red-500/20 text-red-300 border border-red-500/40'
        }`}>
          {iWon ? <Trophy className="h-4 w-4" /> : <Skull className="h-4 w-4" />}
          {iWon ? `¡Has ganado como ${myRole}!` : `Has perdido como ${myRole}`}
        </div>

        {/* Stats row */}
        <div className="flex justify-center gap-6 mt-5 text-center">
          {[
            { val: allPlayers.length, label: 'Jugadores' },
            { val: rounds,            label: 'Rondas' },
            { val: survivors.length,  label: 'Supervivientes' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-2xl font-black text-white">{s.val}</p>
              <p className="text-white/40 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="relative z-10 w-full max-w-md px-4"
        style={{
          opacity: entered ? 1 : 0,
          transition: 'opacity 0.6s ease-out 0.3s',
        }}
      >
        {/* XP gained */}
        {xpResult !== null && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mt-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Star className="h-5 w-5 text-yellow-400" />
              <span className="text-yellow-300 font-bold text-lg">+{xpResult.xpGained} XP</span>
            </div>
            <p className="text-yellow-400/60 text-xs">
              {iWon ? '🏆 Bonus de victoria incluido' : '🎮 XP por participar'}
              {' · '}Nivel {xpResult.newLevel} {levelEmoji(xpResult.newLevel)}
            </p>
            <p className="text-yellow-400/40 text-[10px] mt-1">{xpResult.newTotalXp.toLocaleString()} XP total</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-white/5 rounded-xl p-1 border border-white/10">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t.id ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: RESUMEN ───────────────────────────────────────── */}
        {tab === 'resumen' && (
          <div className="mt-3 space-y-3">
            {/* Wolf team */}
            <div className="bg-red-950/40 border border-red-700/40 rounded-2xl p-4">
              <p className="text-red-400 text-xs uppercase tracking-wide font-semibold mb-2 flex items-center gap-1.5">
                <Swords className="h-3.5 w-3.5" /> Equipo Lobo
              </p>
              <div className="space-y-2">
                {allPlayers.filter(p => wolfTeamUids.has(p.uid)).map(p => {
                  const role = game.roles?.[p.uid] ?? 'Lobo';
                  return (
                    <div key={p.uid} className="flex items-center gap-2">
                      <img src={getRoleIcon(role)} alt={role} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-100">{p.name}</p>
                        <p className="text-xs text-red-400/70">{role}</p>
                      </div>
                      {p.isAlive
                        ? <span className="text-xs text-green-400 font-medium">Superviviente</span>
                        : <Skull className="h-4 w-4 text-red-400/50" />}
                    </div>
                  );
                })}
                {allPlayers.filter(p => wolfTeamUids.has(p.uid)).length === 0 && (
                  <p className="text-red-400/50 text-sm">No hubo lobos identificados</p>
                )}
              </div>
            </div>

            {/* Village survivors */}
            <div className="bg-yellow-950/30 border border-yellow-700/30 rounded-2xl p-4">
              <p className="text-yellow-400 text-xs uppercase tracking-wide font-semibold mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Supervivientes del Pueblo
              </p>
              <div className="space-y-2">
                {survivors.filter(p => !wolfTeamUids.has(p.uid)).map(p => {
                  const role = game.roles?.[p.uid] ?? 'Aldeano';
                  return (
                    <div key={p.uid} className="flex items-center gap-2">
                      <img src={getRoleIcon(role)} alt={role} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-white/40">{role}</p>
                      </div>
                      <span className="text-xs text-green-400 font-medium">✓ Vivo</span>
                    </div>
                  );
                })}
                {survivors.filter(p => !wolfTeamUids.has(p.uid)).length === 0 && (
                  <p className="text-white/30 text-sm">Ningún aldeano sobrevivió</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: ROLES ─────────────────────────────────────────── */}
        {tab === 'roles' && (
          <div className="mt-3 bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2">
            {allPlayers.map(p => {
              const role = game.roles?.[p.uid] ?? 'Aldeano';
              const roleInfo = ROLES[role];
              const teamColor = roleInfo?.team === 'wolves'
                ? 'bg-red-900/40 text-red-300'
                : roleInfo?.team === 'solo'
                  ? 'bg-cyan-900/40 text-cyan-300'
                  : 'bg-green-900/40 text-green-300';
              const isWolf = wolfTeamUids.has(p.uid);
              return (
                <div key={p.uid} className={`flex items-center gap-3 py-1 ${!p.isAlive ? 'opacity-50' : ''}`}>
                  <div className="relative flex-shrink-0">
                    <img src={getRoleIcon(role)} alt={role} className="w-8 h-8 rounded object-cover" />
                    {isWolf && <span className="absolute -top-1 -right-1 text-xs">🐺</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm">{p.name}</span>
                      {p.uid === game.hostUid && <span className="text-yellow-400 text-xs">👑</span>}
                      {myUid && p.uid === myUid && <span className="text-blue-400 text-xs">(tú)</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${teamColor}`}>{role}</span>
                  {!p.isAlive && <Skull className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: HISTORIA ──────────────────────────────────────── */}
        {tab === 'historia' && (
          <div className="mt-3 space-y-2">
            {eliminated.length === 0 && (
              <p className="text-white/30 text-sm text-center py-8">No hubo eliminaciones registradas.</p>
            )}
            {eliminated.map((e, i) => {
              const roleInfo = ROLES[e.role];
              const teamColor = roleInfo?.team === 'wolves' ? 'text-red-400' : roleInfo?.team === 'solo' ? 'text-cyan-400' : 'text-green-400';
              const isLast = i === eliminated.length - 1;
              return (
                <div
                  key={`${e.uid}-${i}`}
                  className={`flex items-center gap-3 bg-black/40 border rounded-xl p-3 ${isLast ? 'border-yellow-500/30' : 'border-white/10'}`}
                >
                  <div className="flex-shrink-0 w-7 text-center">
                    <span className="text-white/30 text-sm font-mono">{i + 1}</span>
                  </div>
                  <img src={getRoleIcon(e.role)} alt={e.role} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{e.name}</p>
                    <p className={`text-xs ${teamColor}`}>{e.role}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white/30 text-xs">Ronda {e.round}</p>
                    {isLast && <p className="text-yellow-400 text-xs font-semibold">Último caído</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Share button */}
        <button
          onClick={handleShare}
          className="w-full mt-4 flex items-center justify-center gap-2 bg-white/8 border border-white/20 text-white/80 font-semibold py-3 rounded-xl hover:bg-white/15 active:bg-white/20 transition-all"
        >
          <Share2 className="h-4 w-4" />
          {copied ? '¡Copiado al portapapeles! ✓' : 'Compartir resultado'}
        </button>

        {/* Rewarded Ad */}
        {myUid && (
          <div className="mt-3">
            <RewardedAd userId={myUid} coinsReward={50} />
          </div>
        )}

        {/* AdSense banner */}
        <AdBanner format="horizontal" className="mt-3" />

        {/* Play again buttons */}
        <div className="mt-4 space-y-3">
          {onPlayAgainSameRoom && (
            <>
              {isHost && (
                <button
                  onClick={onPlayAgainSameRoom}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-400 text-black font-bold py-4 rounded-xl transition-all text-lg shadow-lg shadow-yellow-900/30"
                >
                  <RefreshCw className="h-5 w-5" />
                  Volver a jugar en esta sala
                </button>
              )}
              {!isHost && hostInGame && (
                <div className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white/50 py-4 rounded-xl text-sm">
                  <Clock className="h-4 w-4" />
                  Esperando al anfitrión para jugar de nuevo…
                </div>
              )}
              {!isHost && !hostInGame && (
                <button
                  onClick={onPlayAgainSameRoom}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-400 text-black font-bold py-4 rounded-xl transition-all text-lg shadow-lg shadow-yellow-900/30"
                >
                  <RefreshCw className="h-5 w-5" />
                  👑 Ser anfitrión y volver a jugar
                </button>
              )}
            </>
          )}
          <button
            onClick={onPlayAgain}
            className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/20 text-white font-semibold py-3 rounded-xl transition-all border border-white/20"
          >
            <Home className="h-5 w-5" />
            Volver al inicio
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounceIn {
          0%   { transform: scale(0.3); opacity: 0; }
          50%  { transform: scale(1.1); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
