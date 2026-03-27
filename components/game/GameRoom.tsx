'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import {
  doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, serverTimestamp,
  collection, addDoc, query, orderBy, limit, onSnapshot as onSnap, deleteDoc,
} from 'firebase/firestore';
import { Copy, Crown, LogOut, Send, Users, Loader2, Bot, Share2, MessageCircle, Facebook, Link, Check } from 'lucide-react';
import { useNarrator, waitForAudio } from '@/hooks/useNarrator';
import { useAudio } from '@/app/providers/AudioProvider';

interface Player {
  uid: string;
  name: string;
  photoURL: string;
  isHost: boolean;
  isAlive: boolean;
  role: string | null;
  isAI?: boolean;
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

const AI_NAMES = [
  'Aldeano Misterioso', 'Campesino Justo', 'Herrero Silencioso', 'Monja Devota',
  'Boticario Sabio', 'Noble Astuto', 'Granjero Honrado', 'Trovador Errante',
  'Leñador Robusto', 'Pescador Tranquilo', 'Mercader Viajero', 'Clérigo Piadoso',
  'Tejedora Sagaz', 'Pícaro Sombra', 'Cazador Solitario', 'Doncella Prudente',
];

function generateAIPlayers(current: Player[], maxPlayers: number): Player[] {
  const count = maxPlayers - current.length;
  if (count <= 0) return [];
  const used = new Set(current.map(p => p.name));
  const available = AI_NAMES.filter(n => !used.has(n));
  return Array.from({ length: count }, (_, i) => ({
    uid: `ai_${Date.now()}_${i}`,
    name: available[i % available.length] ?? `IA ${i + 1}`,
    photoURL: '',
    isHost: false,
    isAlive: true,
    role: null,
    isAI: true,
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
  const chatRef = useRef<HTMLDivElement>(null);
  const { play, stop, AUDIO_FILES } = useNarrator();
  const { playMusic } = useAudio();
  const [introSkipped, setIntroSkipped] = useState(false);
  const salasPlayed = useRef(false);

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
      const newPlayer: Player = {
        uid: user.uid,
        name: user.displayName ?? 'Jugador',
        photoURL: user.photoURL ?? '',
        isHost: false,
        isAlive: true,
        role: null,
      };
      updateDoc(doc(db, 'games', gameId), {
        players: arrayUnion(newPlayer),
        playerCount: (game.playerCount ?? 1) + 1,
      }).catch(() => {});
    }
  }, [user, game, gameId]);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim() || !user) return;
    setSending(true);
    await addDoc(collection(db, 'games', gameId, 'lobbyChat'), {
      senderId: user.uid,
      senderName: user.displayName ?? 'Jugador',
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
    stop(); // Corta salas.mp3 si sigue sonando
    setStarting(true);
    try {
      const realPlayers = game.players ?? [];
      let allPlayers = realPlayers;

      if (game.fillWithAI && realPlayers.length < game.maxPlayers) {
        const aiPlayers = generateAIPlayers(realPlayers, game.maxPlayers);
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
                {realPlayers.map(p => (
                  <div key={p.uid} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0 overflow-hidden">
                      {p.photoURL
                        ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                        : <span className="w-full h-full flex items-center justify-center text-xs font-bold">{p.name[0]}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      {p.isHost && <span className="text-yellow-400 text-[10px] flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" /> Anfitrión</span>}
                    </div>
                  </div>
                ))}

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
