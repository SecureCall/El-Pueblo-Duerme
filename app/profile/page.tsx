'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Coins, LogOut, ShoppingBag, User, Trophy, Loader2, Star, Flame, Zap } from 'lucide-react';
import { xpProgress, levelLabel, levelEmoji, getPlayerTitle } from '@/lib/firebase/xp';

interface UserData {
  displayName: string;
  email: string;
  photoURL: string;
  coins: number;
  xp: number;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: any;
}

interface GameHistoryEntry {
  won: boolean;
  role: string;
  survived: boolean;
  ts: number;
}

interface BehaviorData {
  consecutiveWins: number;
  gamesPlayed: number;
  gamesWon: number;
  lastRole: string;
  winsAsWolf?: number;
  winsAsVillage?: number;
  survivedGames?: number;
  rolePlayCount?: Record<string, number>;
  lastGameDrama?: string;
  gameHistory?: GameHistoryEntry[];
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [behaviorData, setBehaviorData] = useState<BehaviorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    if (!user) return;
    Promise.all([
      getDoc(doc(db, 'users', user.uid)),
      getDoc(doc(db, 'playerBehavior', user.uid)),
    ]).then(([userSnap, behaviorSnap]) => {
      if (userSnap.exists()) setUserData(userSnap.data() as UserData);
      if (behaviorSnap.exists()) setBehaviorData(behaviorSnap.data() as BehaviorData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  const displayName = userData?.displayName ?? user?.displayName ?? 'Jugador';
  const coins = userData?.coins ?? 0;
  const xp = userData?.xp ?? 0;
  const gamesPlayed = userData?.gamesPlayed ?? 0;
  const gamesWon = userData?.gamesWon ?? 0;
  const avatar = userData?.photoURL ?? user?.photoURL ?? '';
  const initial = displayName.charAt(0).toUpperCase();
  const consecutiveWins = behaviorData?.consecutiveWins ?? 0;
  const lastRole = behaviorData?.lastRole ?? 'Aldeano';
  const winsAsWolf = behaviorData?.winsAsWolf ?? 0;
  const winsAsVillage = behaviorData?.winsAsVillage ?? 0;
  const survivedGames = behaviorData?.survivedGames ?? 0;
  const rolePlayCount = behaviorData?.rolePlayCount ?? {};
  const lastGameDrama = behaviorData?.lastGameDrama ?? '';
  const gameHistory = behaviorData?.gameHistory ?? [];

  const { current: xpCurrent, needed: xpNeeded, pct: xpPct, level } = xpProgress(xp);
  const label = levelLabel(level);
  const lEmoji = levelEmoji(level);
  const winRate = gamesPlayed > 0 ? gamesWon / gamesPlayed : 0;

  const titleCfg = getPlayerTitle({ gamesPlayed, winRate, consecutiveWins, lastRole, level, winsAsWolf, winsAsVillage, survivedGames, rolePlayCount });

  return (
    <div className="relative min-h-screen w-full text-white" style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(5, 10, 20, 0.85)' }} />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-white/50 hover:text-white text-sm transition-colors">← Volver al Inicio</Link>
        </div>

        {/* Profile card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-6 mb-6">
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-20 h-20 rounded-full object-cover border-2 border-white/20" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold border-2 border-white/20">
                {initial}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="font-headline text-3xl font-bold">{displayName}</h1>
                <span className="text-lg">{lEmoji}</span>
              </div>
              <p className="text-white/40 text-sm">{user?.email}</p>
              <p className="text-white/60 text-sm font-semibold mt-0.5">{label} · Nivel {level}</p>

              {/* Título único */}
              {titleCfg && (
                <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 ${titleCfg.color}`}>
                  <span className="text-sm">{titleCfg.emoji}</span>
                  <span className="text-sm font-bold">{titleCfg.title}</span>
                  <span className="text-[10px] text-white/40 ml-1">{titleCfg.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Racha de victorias destacada */}
          {consecutiveWins >= 2 && (
            <div className="flex items-center gap-3 bg-orange-950/40 border border-orange-500/30 rounded-xl px-4 py-3 mb-5">
              <Flame className="h-6 w-6 text-orange-400 animate-pulse" />
              <div>
                <p className="text-orange-300 font-bold text-sm">Racha activa: {consecutiveWins} victorias seguidas</p>
                <p className="text-white/40 text-xs">+{Math.min(consecutiveWins, 5) * 30} XP de bonus por racha en la siguiente partida</p>
              </div>
            </div>
          )}

          {/* XP bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" /> {xp.toLocaleString()} XP total</span>
              <span>{xpCurrent} / {xpNeeded} para nivel {level + 1}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${xpPct * 100}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex flex-col items-center gap-1">
              <Coins className="h-5 w-5 text-yellow-400" />
              <p className="text-yellow-300 font-bold text-xl">{coins.toLocaleString()}</p>
              <p className="text-yellow-400/60 text-xs">monedas</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-1">
              <Trophy className="h-5 w-5 text-white/40" />
              <p className="text-white font-bold text-xl">{gamesPlayed}</p>
              <p className="text-white/40 text-xs">partidas</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex flex-col items-center gap-1">
              <Trophy className="h-5 w-5 text-green-400" />
              <p className="text-green-300 font-bold text-xl">{gamesWon}</p>
              <p className="text-green-400/60 text-xs">victorias</p>
            </div>
          </div>

          {/* Rol favorito */}
          {lastRole && lastRole !== 'Aldeano' && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-3">
              <Zap className="h-4 w-4 text-purple-400" />
              <span className="text-white/50 text-sm">Último rol: </span>
              <span className="text-purple-300 font-semibold text-sm">{lastRole}</span>
            </div>
          )}

          {/* Stats adicionales */}
          {(winsAsWolf > 0 || survivedGames > 0) && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {winsAsWolf > 0 && (
                <div className="bg-red-950/30 border border-red-700/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <span className="text-lg">🐺</span>
                  <div>
                    <p className="text-red-300 font-bold text-base">{winsAsWolf}</p>
                    <p className="text-red-400/60 text-[10px]">victorias como lobo</p>
                  </div>
                </div>
              )}
              {survivedGames > 0 && (
                <div className="bg-teal-950/30 border border-teal-700/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <span className="text-lg">🛡️</span>
                  <div>
                    <p className="text-teal-300 font-bold text-base">{survivedGames}</p>
                    <p className="text-teal-400/60 text-[10px]">veces sobrevivido</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Drama de la última partida */}
          {lastGameDrama && (
            <div className="flex items-start gap-2 bg-purple-950/30 border border-purple-700/30 rounded-xl px-4 py-3 mb-3">
              <span className="text-purple-400 mt-0.5">💬</span>
              <p className="text-purple-200 text-sm italic">"{lastGameDrama}"</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link href="/store" className="flex items-center justify-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 font-bold py-3 rounded-xl transition-all">
              <ShoppingBag className="h-4 w-4" />
              Ir a la Tienda
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-medium py-3 rounded-xl transition-all"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
            <User className="h-4 w-4 text-white/40" /> Historial de partidas
          </h2>
          <p className="text-white/30 text-xs mb-4">{gamesPlayed} partida{gamesPlayed !== 1 ? 's' : ''} jugada{gamesPlayed !== 1 ? 's' : ''} en total</p>

          {gamesPlayed === 0 ? (
            <>
              <p className="text-white/30 text-sm text-center py-8">No has jugado ninguna partida todavía.<br />¡Crea o únete a una!</p>
              <Link href="/" className="block text-center bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 transition-all">
                Jugar ahora
              </Link>
            </>
          ) : (
            <div className="space-y-4">
              {/* Gráfico de últimas 10 partidas */}
              {gameHistory.length > 0 && (
                <div>
                  <p className="text-white/40 text-xs mb-2">Últimas {gameHistory.length} partidas</p>
                  <div className="flex gap-1.5 items-center">
                    {gameHistory.map((g, i) => (
                      <div
                        key={i}
                        title={`${g.won ? '✅ Victoria' : '❌ Derrota'} · ${g.role}${g.survived ? ' · Sobrevivió' : ''}`}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all cursor-default ${
                          g.won
                            ? 'bg-green-500/30 border-green-500/60 text-green-300'
                            : 'bg-red-500/20 border-red-500/40 text-red-400'
                        }`}
                      >
                        {g.won ? '🟢' : '🔴'}
                      </div>
                    ))}
                    {gameHistory.length < 10 && Array.from({ length: 10 - gameHistory.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="w-6 h-6 rounded-full bg-white/5 border border-white/10" />
                    ))}
                  </div>
                  {/* Último rol jugado de la historia */}
                  {gameHistory.length > 0 && (
                    <p className="text-white/25 text-[10px] mt-2">
                      Última partida: <span className="text-white/50">{gameHistory[gameHistory.length - 1].role}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-0">
                <div className="flex justify-between text-sm text-white/60 py-3 border-b border-white/10">
                  <span>Tasa de victorias</span>
                  <span className="font-bold text-white">{Math.round(winRate * 100)}%</span>
                </div>
                <div className="flex justify-between text-sm text-white/60 py-3 border-b border-white/10">
                  <span>Partidas ganadas</span>
                  <span className="font-bold text-green-400">{gamesWon} / {gamesPlayed}</span>
                </div>
                {consecutiveWins > 0 && (
                  <div className="flex justify-between text-sm text-white/60 py-3">
                    <span>Racha actual</span>
                    <span className="font-bold text-orange-400">{consecutiveWins} seguidas 🔥</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
