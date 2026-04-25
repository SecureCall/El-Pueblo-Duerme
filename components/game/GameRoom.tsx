'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import {
  doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, serverTimestamp,
  collection, addDoc, query, orderBy, limit, onSnapshot as onSnap, deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { Copy, Crown, LogOut, Send, Users, Loader2, Bot, Share2, MessageCircle, Facebook, Link, Check, UserPlus } from 'lucide-react';
import { useNarrator, waitForAudio } from '@/hooks/useNarrator';
import { useAudio } from '@/app/providers/AudioProvider';
import { FriendsPanel } from '@/components/friends/FriendsPanel';
import { sendFriendRequest } from '@/lib/firebase/friends';
import { xpToLevel, levelEmoji } from '@/lib/firebase/xp';
import { BOT_NAMES, assignBotType, type BotType } from '@/lib/bots/botSystem';
import { getBehaviorProfile } from '@/lib/bots/playerStats';

interface Player {
  uid: string;
  name: string;
  photoURL: string;
  isHost: boolean;
  isAlive: boolean;
  role: string | null;
  isAI?: boolean;
  botType?: string;
  level?: number;
  lastSeen?: number;
}

interface GameData {
  name: string;
  code: string;
  hostUid: string;
  hostName: string;
  maxPlayers: number;
  wolves: number;
  isPublic: boolean;
  fillWithAI: boolean;
  juryVote: boolean;
  specialRoles: string[];
  playerCount: number;
  status: string;
  phase: string;
  players: Player[];
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

// Bias de personalidad según perfil del host: complementar su estilo
function biasedBotType(aggressionLevel: 'fast' | 'medium' | 'slow', i: number): BotType {
  // Host agresivo → más bots callados y listos para crear contraste
  // Host pasivo → más acusadores para animar el debate
  // Host medio → mezcla variada
  const pools: Record<string, BotType[]> = {
    fast:   ['callado', 'callado', 'listo', 'acusador', 'caotico'],
    slow:   ['acusador', 'acusador', 'caotico', 'listo', 'callado'],
    medium: ['callado', 'acusador', 'listo', 'caotico', 'acusador'],
  };
  const pool = pools[aggressionLevel];
  return pool[i % pool.length];
}

function generateAIPlayers(current: Player[], maxPlayers: number, aggressionLevel?: 'fast' | 'medium' | 'slow'): Player[] {
  const count = maxPlayers - current.length;
  if (count <= 0) return [];
  const used = new Set(current.map(p => p.name));
  const available = BOT_NAMES.filter(n => !used.has(n));
  return Array.from({ length: count }, (_, i) => ({
    uid: `ai_${Date.now()}_${i}`,
    name: available[i % available.length] ?? `Jugador ${i + 1}`,
    photoURL: '',
    isHost: false,
    isAlive: true,
    role: null,
    isAI: true,
    botType: aggressionLevel ? biasedBotType(aggressionLevel, i) : assignBotType(),
  }));
}

export function GameRoom({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [retentionCountdown, setRetentionCountdown] = useState<number | null>(null);
  const retentionFiredRef = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const { play, stop, AUDIO_FILES } = useNarrator();
  const { playMusic } = useAudio();
  const [introSkipped, setIntroSkipped] = useState(false);
  const salasPlayed = useRef(false);
  const [sentFriendReqs, setSentFriendReqs] = useState<Set<string>>(new Set());

  const addFriend = async (e: React.MouseEvent, targetUid: string) => {
    e.stopPropagation();
    if (!user) return;
    await sendFriendRequest(user.uid, targetUid);
    setSentFriendReqs(prev => new Set(prev).add(targetUid));
  };

  const kickPlayer = async (targetUid: string) => {
    if (!isHost || !game || targetUid === user?.uid) return;
    const target = game.players?.find(p => p.uid === targetUid);
    if (!target) return;
    await updateDoc(doc(db, 'games', gameId), {
      players: arrayRemove(target),
      playerCount: Math.max(0, (game.playerCount ?? 1) - 1),
    }).catch(() => {});
  };

  useEffect(() => {
    if (salasPlayed.current) return;
    salasPlayed.current = true;
    play(AUDIO_FILES.salas);
    waitForAudio().then(() => playMusic('lobby'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "games", gameId), (snap: any) => {
      if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
      const data = snap.data() as GameData;
      setGame(data);
      setLoading(false);

      if (data.status === 'playing') {
        router.push(`/game/${gameId}/play`);
      }
    }, () => { setNotFound(true); setLoading(false); });

    return () => unsub();
  }, [gameId, router]);

  useEffect(() => {
    if (!game) return;
    const q = query(
      collection(db, 'games', gameId, 'lobbyChat'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsub = onSnap(q, (snap: any) => {
      setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 50);
    });
    return () => unsub();
  }, [game, gameId]);

  useEffect(() => {
    if (!user || !game) return;
    const already = game.players?.some(p => p.uid === user.uid);
    if (!already) {
      const resolvedName = user.displayName || user.email?.split('@')[0] || 'Jugador';
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        const xp = snap.exists() ? (snap.data().xp ?? 0) : 0;
        const newPlayer: Player = {
          uid: user.uid,
          name: resolvedName,
          photoURL: user.photoURL ?? '',
          isHost: false,
          isAlive: true,
          role: null,
          level: xpToLevel(xp),
          lastSeen: Date.now(),
        };
        updateDoc(doc(db, 'games', gameId), {
          players: arrayUnion(newPlayer),
          playerCount: (game.playerCount ?? 1) + 1,
        }).catch(() => {});
      }).catch(() => {});
    }
  }, [user, game, gameId]);

  // Heartbeat: update lastSeen every 60s so others can detect inactivity
  useEffect(() => {
    if (!user || !game) return;
    const updatePresence = () => {
      const me = game.players?.find(p => p.uid === user.uid);
      if (!me) return;
      const updated = game.players?.map(p => p.uid === user.uid ? { ...p, lastSeen: Date.now() } : p);
      updateDoc(doc(db, 'games', gameId), { players: updated }).catch(() => {});
    };
    updatePresence();
    const id = setInterval(updatePresence, 60000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, gameId]);

  // Auto-fill con bots (matchmaking retención)
  const autoFillWithBots = async () => {
    if (!user || !game || retentionFiredRef.current) return;
    if (game.hostUid !== user.uid) return;
    retentionFiredRef.current = true;
    const realNow = (game.players ?? []).filter(p => !p.isAI);
    if (realNow.length >= 4) return;
    const targetTotal = Math.min(game.maxPlayers ?? 10, Math.max(6, realNow.length + 3));
    const newBots = generateAIPlayers(realNow, targetTotal);
    if (newBots.length === 0) return;
    await updateDoc(doc(db, 'games', gameId), {
      players: [...realNow, ...newBots],
      playerCount: realNow.length + newBots.length,
      fillWithAI: true,
    }).catch(() => {});
    setRetentionCountdown(null);
  };

  // Retención: si el host está solo < 4 jugadores por 45s, muestra aviso y rellena en 60s
  useEffect(() => {
    if (!user || !game || game.status !== 'lobby') return;
    if (game.hostUid !== user.uid) return;
    const realCount = (game.players ?? []).filter(p => !p.isAI).length;
    if (realCount >= 4 || retentionFiredRef.current) return;

    const WARN_AT = 40000;
    const FILL_AT = 60000;
    const COUNTDOWN_SECS = 20;

    const warnTimer = setTimeout(() => {
      setRetentionCountdown(COUNTDOWN_SECS);
    }, WARN_AT);

    const countdownInterval = setTimeout(() => {
      let c = COUNTDOWN_SECS - 1;
      const iv = setInterval(() => {
        setRetentionCountdown(prev => {
          if (prev === null || prev <= 1) { clearInterval(iv); return null; }
          return prev - 1;
        });
        c--;
        if (c <= 0) clearInterval(iv);
      }, 1000);
    }, WARN_AT + 1000);

    const fillTimer = setTimeout(() => {
      autoFillWithBots();
    }, FILL_AT);

    return () => {
      clearTimeout(warnTimer);
      clearTimeout(countdownInterval);
      clearTimeout(fillTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(game?.players ?? []).filter(p => !p.isAI).length, game?.status, user?.uid]);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim() || !user) return;
    setSending(true);
    await addDoc(collection(db, 'games', gameId, 'lobbyChat'), {
      senderId: user.uid,
      senderName: user.displayName || user.email?.split('@')[0] || 'Jugador',
      text: msg.trim(),
      createdAt: serverTimestamp(),
    });
    setMsg('');
    setSending(false);
  };

  const leaveGame = async () => {
    if (!user || !game) return;
    const me = game.players?.find(p => p.uid === user.uid);

    const remainingHumans = (game.players ?? []).filter(p => !p.isAI && p.uid !== user.uid);

    if (remainingHumans.length === 0 && game.isPublic) {
      await deleteDoc(doc(db, 'games', gameId)).catch(() => {});
    } else if (me) {
      const updates: Record<string, unknown> = {
        players: arrayRemove(me),
        playerCount: Math.max(0, (game.playerCount ?? 1) - 1),
      };
      if (me.isHost && remainingHumans.length > 0) {
        const newHost = remainingHumans[0];
        updates['hostUid'] = newHost.uid;
        updates['hostName'] = newHost.name;
      }
      await updateDoc(doc(db, 'games', gameId), updates).catch(() => {});
    }
    router.push('/');
  };

  const getShareData = () => {
    const code = game?.code ?? '';
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `¡Únete a mi partida de El Pueblo Duerme! 🐺\nCódigo: ${code}\n${url}`;
    return { code, url, text };
  };

  const handleShare = async () => {
    const { text, url } = getShareData();
    if (navigator.share) {
      try {
        await navigator.share({
          title: '¡Únete a El Pueblo Duerme!',
          text,
          url,
        });
        return;
      } catch (_) {}
    }
    setShowShare(v => !v);
  };

  const handleCopyLink = async () => {
    const { text } = getShareData();
    await navigator.clipboard.writeText(text);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShowShare(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const skipIntro = () => {
    stop();
    setIntroSkipped(true);
    playMusic('lobby');
  };

  const startGame = async () => {
    if (!user || !game || game.hostUid !== user.uid) return;
    stop();
    setStarting(true);
    try {
      const realPlayers = game.players ?? [];
      let allPlayers = realPlayers;

      if (game.fillWithAI && realPlayers.length < game.maxPlayers) {
        // Leer perfil del host para ajustar personalidades de bots
        const profile = await getBehaviorProfile(user.uid).catch(() => null);
        const aggressionLevel = profile?.aggressionLevel ?? 'medium';
        const aiPlayers = generateAIPlayers(realPlayers, game.maxPlayers, aggressionLevel);
        allPlayers = [...realPlayers, ...aiPlayers];
      }

      await updateDoc(doc(db, 'games', gameId), {
        status: 'playing',
        players: allPlayers,
        playerCount: allPlayers.length,
        startedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error starting game:', err);
      setStarting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f]">
      <Loader2 className="h-10 w-10 animate-spin text-white/50" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#05080f] text-white gap-4">
      <p className="text-xl font-headline">Sala no encontrada</p>
      <button onClick={() => router.push('/')} className="text-white/50 hover:text-white text-sm underline">Volver al inicio</button>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#05080f] text-white gap-4">
      <p>Debes iniciar sesión para unirte a la partida.</p>
      <button onClick={() => router.push('/login')} className="underline text-white/70 hover:text-white">Iniciar sesión</button>
    </div>
  );

  const isHost = user?.uid === game?.hostUid;
  const players = game?.players ?? [];
  const realPlayers = players.filter(p => !p.isAI);
  const aiSlots = (game?.maxPlayers ?? 10) - realPlayers.length;
  const canStart = isHost && (
    game?.fillWithAI ? realPlayers.length >= 1 : players.length >= 4
  );

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative z-10 flex flex-col h-screen max-w-5xl mx-auto w-full p-4 gap-4">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="font-headline text-2xl font-bold">{game?.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-white/40 text-xs">Código:</span>
              <button
                onClick={() => navigator.clipboard.writeText(game?.code ?? '')}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md text-sm font-mono font-bold transition-colors"
              >
                {game?.code} <Copy className="h-3.5 w-3.5 text-white/60" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Share button with dropdown */}
            <div className="relative" ref={shareRef}>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Share2 className="h-4 w-4 text-white/70" />
                <span className="text-white/80">Invitar</span>
              </button>

              {showShare && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#0d1117] border border-white/15 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-white/50 text-xs">Código de sala</p>
                    <p className="font-mono font-bold text-lg tracking-widest">{game?.code}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {/* WhatsApp */}
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(getShareData().text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowShare(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors w-full"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="h-4 w-4 text-[#25D366]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">WhatsApp</p>
                        <p className="text-white/30 text-xs">Compartir en WhatsApp</p>
                      </div>
                    </a>

                    {/* Facebook */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareData().url)}&quote=${encodeURIComponent(getShareData().text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowShare(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors w-full"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1877F2]/20 flex items-center justify-center flex-shrink-0">
                        <Facebook className="h-4 w-4 text-[#1877F2]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Facebook</p>
                        <p className="text-white/30 text-xs">Compartir en Facebook</p>
                      </div>
                    </a>

                    {/* Telegram */}
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(getShareData().url)}&text=${encodeURIComponent(getShareData().text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowShare(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors w-full"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#229ED9]/20 flex items-center justify-center flex-shrink-0">
                        <Send className="h-4 w-4 text-[#229ED9]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Telegram</p>
                        <p className="text-white/30 text-xs">Compartir en Telegram</p>
                      </div>
                    </a>

                    {/* Copy link */}
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors w-full text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        {linkCopied
                          ? <Check className="h-4 w-4 text-green-400" />
                          : <Link className="h-4 w-4 text-white/60" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium">{linkCopied ? '¡Copiado!' : 'Copiar enlace'}</p>
                        <p className="text-white/30 text-xs">Código + URL de la sala</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button onClick={leaveGame} className="flex items-center gap-1.5 text-white/40 hover:text-red-400 text-sm transition-colors">
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </div>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Players panel */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-3">
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-white/50" />
                <span className="text-sm text-white/70 font-medium">
                  Jugadores ({realPlayers.length}/{game?.maxPlayers})
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {realPlayers.map(p => {
                  const inactive = p.lastSeen ? (Date.now() - p.lastSeen) > 3 * 60 * 1000 : false;
                  const lvl = p.level ?? 1;
                  return (
                  <div key={p.uid} className="flex items-center gap-2 group">
                    <div className="relative w-8 h-8 flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                        {p.photoURL
                          ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                          : <span className="w-full h-full flex items-center justify-center text-xs font-bold">{p.name[0]}</span>
                        }
                      </div>
                      {inactive && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-black" title="Inactivo" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {p.isHost && <span className="text-yellow-400 text-[10px] flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" /> Anfitrión</span>}
                        <span className="text-white/30 text-[10px]">{levelEmoji(lvl)} Nv.{lvl}</span>
                        {inactive && <span className="text-red-400 text-[10px]">⚠ inactivo</span>}
                      </div>
                    </div>
                    {p.uid !== user?.uid && (
                      <div className="flex items-center gap-1">
                        {isHost && (
                          <button
                            onClick={() => kickPlayer(p.uid)}
                            title={`Expulsar a ${p.name}`}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium ${
                              inactive
                                ? 'text-red-400 hover:text-red-300'
                                : 'text-orange-400 hover:text-orange-300'
                            }`}
                          >
                            Kick
                          </button>
                        )}
                        {sentFriendReqs.has(p.uid)
                          ? <span className="flex items-center gap-1 text-green-400 text-[10px]"><Check className="h-3 w-3" /></span>
                          : <button
                              onClick={e => addFriend(e, p.uid)}
                              title={`Agregar a ${p.name} como amigo`}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white/50 hover:text-amber-400 font-medium"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </button>
                        }
                      </div>
                    )}
                  </div>
                  );
                })}

                {game?.fillWithAI && aiSlots > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-[10px] text-white/30 mb-1.5 flex items-center gap-1">
                      <Bot className="h-3 w-3" /> Se añadirán al iniciar:
                    </p>
                    {Array.from({ length: Math.min(aiSlots, 5) }).map((_, i) => (
                      <div key={`ai-${i}`} className="flex items-center gap-2 opacity-40 mb-1.5">
                        <div className="w-8 h-8 rounded-full border border-dashed border-cyan-500/50 flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-cyan-400" />
                        </div>
                        <span className="text-xs text-cyan-300/70">Jugador IA</span>
                      </div>
                    ))}
                    {aiSlots > 5 && (
                      <p className="text-[10px] text-cyan-400/50 text-center">+{aiSlots - 5} más</p>
                    )}
                  </div>
                )}

                {!game?.fillWithAI && players.length < (game?.maxPlayers ?? 10) && Array.from({ length: Math.max(0, (game?.maxPlayers ?? 10) - players.length) }).slice(0, 5).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-2 opacity-25">
                    <div className="w-8 h-8 rounded-full border border-dashed border-white/30" />
                    <span className="text-xs text-white/40">Esperando...</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white/50 space-y-1">
              <p>🐺 {game?.wolves} Lobo{(game?.wolves ?? 1) > 1 ? 's' : ''}</p>
              <p>{game?.isPublic ? '🌍 Pública' : '🔒 Privada'}</p>
              {game?.juryVote && <p>⚖️ Voto del Jurado</p>}
              {game?.fillWithAI && <p className="text-cyan-400">🤖 Modo con IA activo</p>}
            </div>

            {/* Skip intro button — visible while salas.mp3 plays */}
            {!introSkipped && (
              <button
                onClick={skipIntro}
                className="w-full flex items-center justify-center gap-2 text-white/40 hover:text-white/70 text-xs py-1 transition-colors animate-pulse"
              >
                <span>⏭</span>
                <span>Saltar narración del narrador</span>
              </button>
            )}

            {/* Retención: aviso de auto-fill */}
            {isHost && retentionCountdown !== null && realPlayers.length < 4 && (
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-3 text-center space-y-1.5 animate-pulse">
                <p className="text-amber-400 text-xs font-medium">Pocos jugadores — añadiendo bots en</p>
                <p className="text-amber-300 font-bold text-2xl">{retentionCountdown}s</p>
                <button
                  onClick={autoFillWithBots}
                  className="text-amber-400/70 hover:text-amber-300 text-xs underline"
                >
                  Añadir ahora
                </button>
              </div>
            )}

            {isHost && (
              <>
                <button
                  onClick={startGame}
                  disabled={!canStart || starting}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : '⚔️'}
                  {starting ? 'Iniciando...' : game?.fillWithAI ? 'Comenzar con IA' : 'Comenzar Partida'}
                </button>
                {!canStart && !game?.fillWithAI && (
                  <p className="text-center text-white/30 text-xs">Mínimo 4 jugadores reales</p>
                )}
                {game?.fillWithAI && realPlayers.length < 1 && (
                  <p className="text-center text-white/30 text-xs">Necesitas al menos 1 jugador real</p>
                )}
              </>
            )}

            {!isHost && (
              <p className="text-center text-white/30 text-xs py-2">Esperando al anfitrión...</p>
            )}
          </div>

          {/* Friends panel */}
          <FriendsPanel
            gameId={gameId}
            gameCode={game?.code}
            gameName={game?.name}
            compact
          />

          {/* Chat */}
          <div className="flex-1 flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-sm font-medium text-white/70">Chat de sala</p>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {msgs.length === 0 && (
                <p className="text-white/20 text-sm text-center mt-8">El pueblo guarda silencio...</p>
              )}
              {msgs.map(m => (
                <div key={m.id} className={`flex gap-2 ${m.senderId === user?.uid ? 'flex-row-reverse' : ''}`}>
                  <div className={`max-w-[75%] ${m.senderId === user?.uid ? 'items-end' : 'items-start'} flex flex-col`}>
                    {m.senderId !== user?.uid && (
                      <span className="text-[10px] text-white/40 mb-0.5">{m.senderName}</span>
                    )}
                    <div className={`px-3 py-1.5 rounded-xl text-sm ${m.senderId === user?.uid ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                      {m.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMsg} className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={msg}
                onChange={e => setMsg(e.target.value)}
                placeholder="Escribe un mensaje..."
                maxLength={200}
                className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
              />
              <button
                type="submit"
                disabled={!msg.trim() || sending}
                className="bg-white/10 hover:bg-white/20 border border-white/20 p-2 rounded-lg transition-colors disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
