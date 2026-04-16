'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameState } from './GamePlay';
import { ROLES } from './roles';
import { getRoleIcon } from './roleIcons';
import { Trophy, Skull, Home, RefreshCw, Clock, Star, Share2, Users, BookOpen, Swords, Flame, ImageIcon } from 'lucide-react';
import { useNarrator, NARRATIONS } from '@/hooks/useNarrator';
import { AdBanner } from '@/components/ads/AdBanner';
import { RewardedAd } from '@/components/ads/RewardedAd';
import { xpToLevel, levelEmoji, awardXP, getPlayerTitle, type XPResult } from '@/lib/firebase/xp';
import { recordGameResult } from '@/lib/bots/playerStats';

/** Genera un mensaje de drama personalizado al terminar la partida */
function buildDramaMessage(
  myUid: string | undefined,
  myRole: string | undefined,
  winners: string | null,
  game: GameState,
  iWon: boolean,
): string {
  if (!myUid || !myRole) return '';
  const players = game.players ?? [];
  const wolfTeamUids = new Set(Object.keys(game.wolfTeam ?? {}));
  const eliminated = game.eliminatedHistory ?? [];
  const isWolfSide = wolfTeamUids.has(myUid);
  const myPlayer = players.find(p => p.uid === myUid);
  const survived = myPlayer?.isAlive ?? false;
  const elim = eliminated.find(e => e.uid === myUid);
  const elimPos = elim ? eliminated.indexOf(elim) + 1 : null;

  // Lobo ganador
  if (isWolfSide && iWon) {
    if (survived) return `Sobreviviste como ${myRole} y llevaste al equipo lobo a la victoria. El pueblo nunca lo vio venir.`;
    return `Caíste como ${myRole}, pero los lobos terminaron ganando. Tu sacrificio no fue en vano.`;
  }
  // Lobo perdedor
  if (isWolfSide && !iWon) {
    if (elimPos === 1) return `Te eliminaron primero. El pueblo olía al lobo desde el principio.`;
    return `El pueblo te descubrió y venció. La próxima vez, menos sospechoso.`;
  }
  // Pueblo: vidente/doctor/cazador que ganó
  if (!isWolfSide && iWon && survived) {
    if (myRole === 'Vidente') return `Tu clarividencia fue clave. Sobreviviste y guiaste al pueblo a la victoria.`;
    if (myRole === 'Cazador') return `Tu disparo final fue lo que necesitaba el pueblo. Sobreviviste.`;
    if (myRole === 'Doctor') return `Tus curas salvaron vidas. El pueblo no habría ganado sin ti.`;
    return `Sobreviviste hasta el final y el pueblo ganó. Eres un pilar del pueblo.`;
  }
  // Pueblo: ganó pero murió
  if (!isWolfSide && iWon && !survived) {
    return `Caíste en el camino, pero el pueblo terminó venciendo. Tu voto importó.`;
  }
  // Pueblo: perdió y murió temprano
  if (!isWolfSide && !iWon && elimPos !== null && elimPos <= 2) {
    const wolfNames = players.filter(p => wolfTeamUids.has(p.uid)).map(p => p.name).join(' y ');
    return `Fuiste eliminado demasiado pronto. ${wolfNames ? `Los lobos (${wolfNames}) te tenían en el punto de mira.` : 'El lobo te tenía en el punto de mira.'}`;
  }
  // Pueblo: perdió sobreviviendo
  if (!isWolfSide && !iWon && survived) {
    return `Sobreviviste, pero los lobos ganaron de todas formas. Algo salió mal en las votaciones.`;
  }
  // Default pueblo perdedor
  if (!isWolfSide && !iWon) {
    return `Los lobos os engañaron perfectamente. La próxima vez, confía menos en los demás.`;
  }
  return '';
}

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

function buildShareText(
  game: GameState,
  winners: string | null,
  winMessage: string,
  myUid?: string,
  myRole?: string,
  iWon?: boolean,
): string {
  const { title } = getWinnerDisplay(winners);
  const players = game.players ?? [];
  const eliminated = game.eliminatedHistory ?? [];
  const rounds = game.roundNumber ?? eliminated.length;
  const wolfTeamUids = new Set(Object.keys(game.wolfTeam ?? {}));
  const wolves = players.filter(p => wolfTeamUids.has(p.uid));
  const villageCount = players.filter(p => !wolfTeamUids.has(p.uid)).length;
  const myPlayer = players.find(p => p.uid === myUid);
  const survived = myPlayer?.isAlive ?? false;
  const isWolfSide = myUid ? wolfTeamUids.has(myUid) : false;

  // ── Gancho viral personalizado ──────────────────────────────────────────
  let hook = '';
  if (myRole && iWon !== undefined) {
    if (isWolfSide && iWon && survived) {
      hook = `Engañé a ${villageCount} personas y no se dieron cuenta 🐺\n`;
    } else if (isWolfSide && iWon && !survived) {
      hook = `Me eliminaron, pero mis lobos ganaron igual 🐺 No lo ven venir.\n`;
    } else if (isWolfSide && !iWon) {
      hook = `El pueblo me descubrió como ${myRole}... necesito revancha 😤\n`;
    } else if (!isWolfSide && iWon && survived) {
      hook = `Sobreviví ${rounds} rondas como ${myRole} y el pueblo ganó 🏆\n`;
    } else if (!isWolfSide && iWon && !survived) {
      hook = `Me mataron, pero voté bien antes de caer 💀 El pueblo ganó.\n`;
    } else if (!isWolfSide && !iWon) {
      hook = `Los lobos nos engañaron a todos. ${wolves.map(w => w.name).join(' y ')} eran lobos y nadie lo sospechó 😱\n`;
    }
  }
  if (!hook) hook = `${title}\n`;

  let text = `🌙 El Pueblo Duerme\n${hook}\n`;

  if (wolves.length) {
    text += `🐺 Equipo lobo: ${wolves.map(w => `${w.name} (${game.roles?.[w.uid] ?? 'Lobo'})`).join(', ')}\n`;
  }

  if (eliminated.length) {
    text += `💀 Caídos: ${eliminated.map(e => e.name).join(' → ')}\n`;
  }

  text += `\n📊 ${rounds} rondas · ${players.length} jugadores\n`;
  text += `🎮 elpuebloduermevercel.app`;
  return text;
}

type Tab = 'resumen' | 'roles' | 'historia';

const REMATCH_SECS = 15;

export function EndGame({ game, myRole, myUid, isHost, hostInGame = true, winners, winMessage, onPlayAgain, onPlayAgainSameRoom }: Props) {
  const { emoji, title, bg } = getWinnerDisplay(winners);
  const iWon = didIWin(winners, myRole);
  const { interruptWith } = useNarrator();
  const xpAwarded = useRef(false);
  const [xpResult, setXpResult] = useState<XPResult | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [entered, setEntered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(REMATCH_SECS);
  const [sharingImg, setSharingImg] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  // Drama message derived from current game data
  const dramaMsg = buildDramaMessage(myUid, myRole, winners, game, iWon);
  const myPlayer = game.players?.find(p => p.uid === myUid);
  const survived = myPlayer?.isAlive ?? false;

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

  // Countdown to auto-rematch for host
  useEffect(() => {
    if (!isHost || !onPlayAgainSameRoom) return;
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          onPlayAgainSameRoom();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, !!onPlayAgainSameRoom]);

  const handleRematch = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    onPlayAgainSameRoom?.();
  }, [onPlayAgainSameRoom]);

  useEffect(() => {
    if (!myUid || xpAwarded.current) return;
    xpAwarded.current = true;

    const roleInfo = myRole ? ROLES[myRole] : null;
    const hasSpecialRole = !!roleInfo && roleInfo.team !== 'village' && myRole !== 'Aldeano' && myRole !== 'Lobo';

    if (myRole) recordGameResult(myUid, iWon, myRole, survived, dramaMsg).catch(() => {});

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
    const text = buildShareText(game, winners, winMessage, myUid, myRole, iWon);
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

  const handleShareImage = async () => {
    if (!shareCardRef.current || sharingImg) return;
    setSharingImg(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true, pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'el-pueblo-duerme.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '🌙 El Pueblo Duerme' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'el-pueblo-duerme.png';
        a.click();
      }
    } catch { /* cancelled */ }
    setSharingImg(false);
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
        {/* XP gained + título de ego */}
        {xpResult !== null && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mt-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                <span className="text-yellow-300 font-bold text-lg">+{xpResult.xpGained} XP</span>
              </div>
              {(() => {
                const t = getPlayerTitle({ gamesPlayed: 1, winRate: iWon ? 1 : 0, consecutiveWins: iWon ? 1 : 0, lastRole: myRole ?? 'Aldeano', level: xpResult.newLevel });
                return t ? (
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/15 ${t.color}`}>
                    {t.emoji} {t.title}
                  </span>
                ) : null;
              })()}
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

        {/* Drama personal */}
        {dramaMsg && (
          <div className="mt-4 px-4 py-3 rounded-2xl border border-white/10 bg-white/5 flex items-start gap-2">
            <span className="text-white/40 mt-0.5 text-base">💬</span>
            <p className="text-white/70 text-sm italic leading-relaxed">{dramaMsg}</p>
          </div>
        )}

        {/* Share buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 bg-white/8 border border-white/20 text-white/80 font-semibold py-3 rounded-xl hover:bg-white/15 active:bg-white/20 transition-all text-sm"
          >
            <Share2 className="h-4 w-4" />
            {copied ? '¡Copiado! ✓' : 'Texto'}
          </button>
          <button
            onClick={handleShareImage}
            disabled={sharingImg}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-900/40 border border-indigo-500/40 text-indigo-200 font-semibold py-3 rounded-xl hover:bg-indigo-900/60 active:bg-indigo-800/60 transition-all text-sm disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4" />
            {sharingImg ? 'Generando…' : 'Imagen 📸'}
          </button>
        </div>

        {/* Hidden share card for image generation */}
        <div style={{ position: 'fixed', left: '-9999px', top: 0, width: 400 }} aria-hidden>
          <div
            ref={shareCardRef}
            style={{
              width: 400,
              background: 'linear-gradient(135deg, #0d0018 0%, #1a0030 50%, #0d0018 100%)',
              padding: 32,
              fontFamily: 'system-ui, sans-serif',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 40 }}>{emoji}</div>
              <div>
                <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{title}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>El Pueblo Duerme</div>
              </div>
            </div>
            {/* My result */}
            {myRole && (
              <div style={{
                background: iWon ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${iWon ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 16,
                color: iWon ? '#86efac' : '#fca5a5',
                fontWeight: 700,
                fontSize: 15,
              }}>
                {iWon ? '🏆' : '💀'} {iWon ? 'Victoria' : 'Derrota'} · {myRole}
              </div>
            )}
            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              {[
                { val: allPlayers.length, label: 'Jugadores' },
                { val: rounds, label: 'Rondas' },
                { val: survivors.length, label: 'Supervivientes' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 0' }}>
                  <div style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>{s.val}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Wolf team */}
            {allPlayers.filter(p => wolfTeamUids.has(p.uid)).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#f87171', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>🐺 Equipo Lobo</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                  {allPlayers.filter(p => wolfTeamUids.has(p.uid)).map(p => `${p.name} (${game.roles?.[p.uid] ?? 'Lobo'})`).join(' · ')}
                </div>
              </div>
            )}
            {/* Footer */}
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, textAlign: 'center' }}>
              elpuebloduermevercel.app
            </div>
          </div>
        </div>

        {/* Rewarded Ad */}
        {myUid && (
          <div className="mt-3">
            <RewardedAd userId={myUid} coinsReward={50} />
          </div>
        )}

        {/* AdSense banner */}
        <AdBanner format="horizontal" className="mt-3" />

        {/* ── REVANCHA ─────────────────────────────────────────────── */}
        <div className="mt-4 space-y-3">
          {onPlayAgainSameRoom && (
            <>
              {isHost && (
                <div className="relative">
                  {/* Countdown ring */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div
                      className="h-full bg-orange-500/20 transition-all duration-1000"
                      style={{ width: `${(countdown / REMATCH_SECS) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={handleRematch}
                    className="relative w-full flex items-center justify-between gap-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black py-5 px-5 rounded-2xl transition-all text-xl shadow-xl shadow-red-900/40 border border-orange-400/30"
                  >
                    <div className="flex items-center gap-3">
                      <Flame className="h-6 w-6 text-orange-200 animate-pulse" />
                      <div className="text-left">
                        <p className="text-lg font-black leading-tight">⚔️ Revancha</p>
                        <p className="text-orange-200/70 text-xs font-normal">Mismos jugadores · Nueva partida</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center border border-white/20">
                      <span className="text-white font-black text-lg tabular-nums">{countdown}</span>
                    </div>
                  </button>
                </div>
              )}
              {!isHost && hostInGame && (
                <div className="w-full flex items-center justify-center gap-3 bg-orange-950/30 border border-orange-700/30 text-orange-300/70 py-4 rounded-2xl text-sm">
                  <Clock className="h-4 w-4 animate-pulse" />
                  El anfitrión puede iniciar la revancha en cualquier momento…
                </div>
              )}
              {!isHost && !hostInGame && (
                <button
                  onClick={handleRematch}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black py-5 rounded-2xl transition-all text-xl shadow-xl shadow-red-900/40"
                >
                  <Flame className="h-6 w-6 animate-pulse" />
                  ⚔️ Ser anfitrión y pedir revancha
                </button>
              )}
            </>
          )}
          <button
            onClick={onPlayAgain}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 active:bg-white/10 text-white/50 hover:text-white font-medium py-3 rounded-xl transition-all border border-white/10 text-sm"
          >
            <Home className="h-4 w-4" />
            Salir al inicio
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
