'use client';

import { useState, useEffect, useRef } from 'react';
import { GameState, Player } from './GamePlay';
import { Sun, Send, Vote, Skull, Bot, Timer, Scale } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { ROLES } from './roles';
import { getRoleIcon } from './roleIcons';
import { useNarrator } from '@/hooks/useNarrator';

const DAY_DURATION = 60;

interface Props {
  game: GameState;
  gameId: string;
  myRole: string;
  me?: Player;
  userId: string;
  isHost: boolean;
  onVote: (targetUid: string) => Promise<void>;
  onJuezSecondVote: () => Promise<void>;
  onAlborotadoraFight: (p1: string, p2: string) => Promise<void>;
  onTimerEnd: () => void;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
}

type ChatTab = 'public' | 'ghost' | 'lovers';

export function DayPhase({ game, gameId, myRole, me, userId, isHost, onVote, onJuezSecondVote, onAlborotadoraFight, onTimerEnd }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [ghostMsgs, setGhostMsgs] = useState<ChatMsg[]>([]);
  const [loversMsgs, setLoversMsgs] = useState<ChatMsg[]>([]);
  const [msg, setMsg] = useState('');
  const [ghostMsg, setGhostMsg] = useState('');
  const [loversMsg, setLoversMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingGhost, setSendingGhost] = useState(false);
  const [sendingLovers, setSendingLovers] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(DAY_DURATION);
  const [chatTab, setChatTab] = useState<ChatTab>('public');
  const timerEndFired = useRef(false);
  const onTimerEndRef = useRef(onTimerEnd);
  const chatRef = useRef<HTMLDivElement>(null);
  const voteNarratedRound = useRef<number>(-1);
  const dangerNarratedRound = useRef<number>(-1);
  const { interruptWith, AUDIO_FILES } = useNarrator();

  useEffect(() => { onTimerEndRef.current = onTimerEnd; }, [onTimerEnd]);

  const dayVotes = (game as any).dayVotes ?? {};
  const meAlive = me?.isAlive ?? false;
  const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
  const eliminatedNight = game.dayEliminatedUid
    ? game.players?.find(p => p.uid === game.dayEliminatedUid)
    : null;

  // Role-based access flags
  const isMedium = myRole === 'Médium';
  const isDead = !meAlive;
  const canSeeGhostChat = isMedium || isDead;
  const lovers = game.lovers ?? null;
  const isLover = lovers ? (lovers[0] === userId || lovers[1] === userId) : false;
  const isJuez = myRole === 'Juez' && meAlive;
  const isAlquimista = myRole === 'Alquimista';
  const voteBanned = game.voteBanned ?? [];
  const myVoteBanned = voteBanned.includes(userId);
  const isSilenced = (game.silencedPlayers ?? []).includes(userId);
  const isAlborotadora = myRole === 'Alborotadora' && meAlive && !game.alborotadoraUsed;
  const [alborotadoraStep, setAlborotadoraStep] = useState<0 | 1>(0);
  const [alborotadoraFighters, setAlborotadoraFighters] = useState<string[]>([]);
  const isVerdugo = myRole === 'Verdugo';
  const verdugoTarget = isVerdugo ? (game.players ?? []).find(p => p.uid === game.verdugos?.[userId]) : null;

  // Tabs available
  const availableTabs: ChatTab[] = ['public'];
  if (canSeeGhostChat) availableTabs.push('ghost');
  if (isLover) availableTabs.push('lovers');

  // Public chat
  useEffect(() => {
    const q = query(collection(db, 'games', gameId, 'publicChat'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, (snap: any) => {
      setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      if (chatTab === 'public') setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Ghost chat (Médium reads, dead players write)
  useEffect(() => {
    if (!canSeeGhostChat) return;
    const q = query(collection(db, 'games', gameId, 'ghostChat'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, (snap: any) => {
      setGhostMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      if (chatTab === 'ghost') setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, canSeeGhostChat]);

  // Lovers chat (only the pair)
  useEffect(() => {
    if (!isLover) return;
    const q = query(collection(db, 'games', gameId, 'loversChat'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, (snap: any) => {
      setLoversMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      if (chatTab === 'lovers') setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isLover]);

  // Scroll chat on tab switch
  useEffect(() => {
    setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
  }, [chatTab]);

  // Timer
  useEffect(() => {
    const startedAt = game.dayStartedAt ?? Date.now();
    timerEndFired.current = false;

    const round = game.roundNumber ?? 1;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, DAY_DURATION - elapsed);
      setSecondsLeft(remaining);
      if (remaining === 20 && voteNarratedRound.current !== round) {
        voteNarratedRound.current = round;
        interruptWith(AUDIO_FILES.voteStart);
      }
      if (remaining === 10 && dangerNarratedRound.current !== round) {
        dangerNarratedRound.current = round;
        interruptWith(AUDIO_FILES.dangerHere);
      }
      if (remaining === 0 && !timerEndFired.current) {
        timerEndFired.current = true;
        onTimerEndRef.current();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [game.dayStartedAt]);

  const timerColor = secondsLeft <= 30 ? 'text-red-400' : secondsLeft <= 60 ? 'text-amber-400' : 'text-green-400';
  const timerPct = secondsLeft / DAY_DURATION;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim() || isSilenced) return;
    setSending(true);
    await addDoc(collection(db, 'games', gameId, 'publicChat'), {
      senderId: userId,
      senderName: me?.name ?? 'Jugador',
      text: msg.trim(),
      createdAt: serverTimestamp(),
    });
    setMsg('');
    setSending(false);
  };

  const sendGhostMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ghostMsg.trim() || !isDead) return;
    setSendingGhost(true);
    await addDoc(collection(db, 'games', gameId, 'ghostChat'), {
      senderId: userId,
      senderName: me?.name ?? 'Fantasma',
      text: ghostMsg.trim(),
      createdAt: serverTimestamp(),
    });
    setGhostMsg('');
    setSendingGhost(false);
  };

  const sendLoversMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loversMsg.trim() || !isLover || !meAlive) return;
    setSendingLovers(true);
    await addDoc(collection(db, 'games', gameId, 'loversChat'), {
      senderId: userId,
      senderName: me?.name ?? 'Enamorado',
      text: loversMsg.trim(),
      createdAt: serverTimestamp(),
    });
    setLoversMsg('');
    setSendingLovers(false);
  };

  const handleVote = async () => {
    if (!myVote || voted || !meAlive || myVoteBanned) return;
    await onVote(myVote);
    setVoted(true);
  };

  const voteCounts: Record<string, number> = {};
  for (const target of Object.values(dayVotes) as string[]) {
    voteCounts[target] = (voteCounts[target] ?? 0) + 1;
  }
  const totalVoted = Object.keys(dayVotes).length;
  const totalAlive = alivePlayers.length;

  const votingTargets = alivePlayers.filter(p => p.uid !== userId);

  const tabLabel: Record<ChatTab, string> = {
    public: '💬 Pueblo',
    ghost: '👻 Muertos',
    lovers: '💕 Privado',
  };

  const renderChatContent = () => {
    if (chatTab === 'ghost') {
      return (
        <>
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {ghostMsgs.length === 0 && (
              <p className="text-white/20 text-sm text-center mt-8">
                {isMedium ? 'El más allá guarda silencio...' : 'Los muertos aún no hablan...'}
              </p>
            )}
            {ghostMsgs.map(m => (
              <div key={m.id} className={`flex gap-2 ${m.senderId === userId ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[80%] flex flex-col ${m.senderId === userId ? 'items-end' : 'items-start'}`}>
                  {m.senderId !== userId && (
                    <span className="text-[10px] text-white/40 mb-0.5">{m.senderName}</span>
                  )}
                  <div className={`px-3 py-1.5 rounded-xl text-sm ${m.senderId === userId ? 'bg-slate-500 text-white' : 'bg-white/10 text-white/70'}`}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {isDead && (
            <form onSubmit={sendGhostMsg} className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={ghostMsg}
                onChange={e => setGhostMsg(e.target.value)}
                placeholder="Habla desde el más allá..."
                maxLength={200}
                className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
              <button type="submit" disabled={!ghostMsg.trim() || sendingGhost} className="bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/30 p-2 rounded-lg disabled:opacity-40">
                <Send className="h-4 w-4 text-slate-400" />
              </button>
            </form>
          )}
          {isMedium && !isDead && (
            <div className="p-3 border-t border-white/5 text-center">
              <p className="text-white/20 text-xs">👻 Solo los muertos pueden escribir aquí. Tú puedes leer.</p>
            </div>
          )}
        </>
      );
    }

    if (chatTab === 'lovers') {
      const partner = (game.players ?? []).find(p => lovers && p.uid !== userId && (lovers[0] === p.uid || lovers[1] === p.uid));
      return (
        <>
          <div className="px-4 py-2 border-b border-white/10">
            <p className="text-xs text-pink-400/70">💕 Chat privado con {partner?.name ?? 'tu amado/a'}</p>
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {loversMsgs.length === 0 && (
              <p className="text-white/20 text-sm text-center mt-8">Solo tú y {partner?.name ?? 'tu pareja'} podéis leer esto...</p>
            )}
            {loversMsgs.map(m => (
              <div key={m.id} className={`flex gap-2 ${m.senderId === userId ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[80%] flex flex-col ${m.senderId === userId ? 'items-end' : 'items-start'}`}>
                  {m.senderId !== userId && (
                    <span className="text-[10px] text-white/40 mb-0.5">{m.senderName}</span>
                  )}
                  <div className={`px-3 py-1.5 rounded-xl text-sm ${m.senderId === userId ? 'bg-pink-500 text-white font-medium' : 'bg-pink-900/40 text-white'}`}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {meAlive && (
            <form onSubmit={sendLoversMsg} className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={loversMsg}
                onChange={e => setLoversMsg(e.target.value)}
                placeholder="Solo vuestra pareja lo ve..."
                maxLength={200}
                className="flex-1 bg-white/5 border border-pink-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50"
              />
              <button type="submit" disabled={!loversMsg.trim() || sendingLovers} className="bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 p-2 rounded-lg disabled:opacity-40">
                <Send className="h-4 w-4 text-pink-400" />
              </button>
            </form>
          )}
          {!meAlive && (
            <div className="p-3 border-t border-white/5 text-center">
              <p className="text-white/20 text-xs">💔 Estás muerto/a. Solo podéis leer.</p>
            </div>
          )}
        </>
      );
    }

    // Public chat
    return (
      <>
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {msgs.length === 0 && (
            <p className="text-white/20 text-sm text-center mt-8">El pueblo delibera en silencio...</p>
          )}
          {msgs.map(m => (
            <div key={m.id} className={`flex gap-2 ${m.senderId === userId ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[80%] flex flex-col ${m.senderId === userId ? 'items-end' : 'items-start'}`}>
                {m.senderId !== userId && (
                  <span className="text-[10px] text-white/40 mb-0.5">{m.senderName}</span>
                )}
                <div className={`px-3 py-1.5 rounded-xl text-sm ${m.senderId === userId ? 'bg-amber-500 text-black font-medium' : 'bg-white/10 text-white'}`}>
                  {m.text}
                </div>
              </div>
            </div>
          ))}
        </div>
        {meAlive && !isSilenced && (
          <form onSubmit={sendMsg} className="p-3 border-t border-white/10 flex gap-2">
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Defiéndete o acusa..."
              maxLength={200}
              className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
            />
            <button type="submit" disabled={!msg.trim() || sending} className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 p-2 rounded-lg disabled:opacity-40">
              <Send className="h-4 w-4 text-amber-400" />
            </button>
          </form>
        )}
        {meAlive && isSilenced && (
          <div className="p-3 border-t border-slate-700/30 text-center">
            <p className="text-slate-400/60 text-xs">🤫 La Silenciadora te ha robado la voz esta ronda.</p>
          </div>
        )}
        {!meAlive && (
          <div className="p-3 border-t border-white/5 text-center">
            <p className="text-white/20 text-xs">👻 Estás muerto. Observas en silencio.</p>
          </div>
        )}
      </>
    );
  };

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col"
      style={{
        backgroundImage: 'url(/dia.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-amber-950/60" />
      <div className="relative z-10 flex flex-col h-screen max-w-3xl mx-auto w-full p-4 gap-3">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-400" />
            <h1 className="font-headline text-xl font-bold">Día {game.roundNumber ?? 1}</h1>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2">
            <div className="relative w-28">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${secondsLeft <= 30 ? 'bg-red-500' : secondsLeft <= 60 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${timerPct * 100}%` }}
                />
              </div>
            </div>
            <div className={`flex items-center gap-1 font-mono font-bold text-sm ${timerColor}`}>
              <Timer className="h-3.5 w-3.5" />
              {mm}:{ss}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <img src={getRoleIcon(myRole)} alt={myRole} className="w-7 h-7 rounded object-cover" />
            <span className="text-white/50 text-sm">{myRole}</span>
          </div>
        </div>

        {/* Night death announcement */}
        {eliminatedNight && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 flex items-center gap-3">
            <Skull className="h-6 w-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-red-300 font-semibold">
                {eliminatedNight.name} ha sido devorado/a durante la noche
              </p>
              <p className="text-red-400/60 text-xs">Era: {game.roles?.[eliminatedNight.uid] ?? 'Aldeano'}</p>
            </div>
          </div>
        )}

        {!eliminatedNight && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-3 text-center">
            <p className="text-green-400 text-sm">☀️ Esta noche nadie murió. El pueblo descansa aliviado.</p>
          </div>
        )}

        {/* Alquimista potion result */}
        {isAlquimista && game.alquimistaPotion && (
          <div className={`rounded-xl p-3 border text-sm flex items-center gap-3 ${
            game.alquimistaPotion === 'save' ? 'bg-lime-900/30 border-lime-500/40 text-lime-300' :
            game.alquimistaPotion === 'reveal' ? 'bg-cyan-900/30 border-cyan-500/40 text-cyan-300' :
            'bg-white/5 border-white/10 text-white/50'
          }`}>
            <span className="text-2xl">⚗️</span>
            <div>
              <p className="font-semibold">
                {game.alquimistaPotion === 'save' && '¡Tu poción salvó a la víctima de los lobos esta noche!'}
                {game.alquimistaPotion === 'reveal' && game.alquimistaRevealUid
                  ? `Tu poción revela: ${(game.players ?? []).find(p => p.uid === game.alquimistaRevealUid)?.name ?? '?'} es ${(game.roles ?? {})[game.alquimistaRevealUid ?? ''] ?? 'Aldeano'}`
                  : game.alquimistaPotion === 'reveal' && '🔍 Tu poción no reveló nada (no había candidatos)'}
                {game.alquimistaPotion === 'nothing' && 'Tu poción de anoche fue inerte. Sin efecto.'}
              </p>
            </div>
          </div>
        )}

        {/* Vote ban notice */}
        {myVoteBanned && meAlive && (
          <div className="bg-orange-900/30 border border-orange-500/40 rounded-xl p-3 text-center">
            <p className="text-orange-300 text-sm">🐐 El Chivo Expiatorio te excluyó — <strong>no puedes votar esta ronda</strong>.</p>
          </div>
        )}

        <div className="flex gap-3 flex-1 min-h-0">
          {/* Chat area with tabs */}
          <div className="flex-1 flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-white/10">
              {availableTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setChatTab(tab)}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    chatTab === tab
                      ? tab === 'ghost' ? 'bg-slate-800/60 text-slate-300 border-b-2 border-slate-400'
                      : tab === 'lovers' ? 'bg-pink-900/40 text-pink-300 border-b-2 border-pink-400'
                      : 'bg-amber-900/30 text-amber-300 border-b-2 border-amber-400'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {tabLabel[tab]}
                </button>
              ))}
            </div>

            {/* Header for public chat */}
            {chatTab === 'public' && (
              <div className="px-4 py-2 border-b border-white/5">
                <p className="text-white/30 text-xs">Discutid y decidid quién ejecutar hoy</p>
              </div>
            )}

            {/* Chat content */}
            {renderChatContent()}
          </div>

          {/* Voting panel */}
          <div className="w-52 flex-shrink-0 flex flex-col gap-3">
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Vote className="h-4 w-4 text-amber-400" />
                <p className="text-sm font-medium text-amber-300/80">Votación</p>
              </div>
              <p className="text-white/30 text-xs mb-3">{totalVoted}/{totalAlive} han votado</p>

              <div className="flex-1 overflow-y-auto space-y-1.5">
                {votingTargets.map(p => {
                  const votes = voteCounts[p.uid] ?? 0;
                  const isSelected = myVote === p.uid;
                  return (
                    <button
                      key={p.uid}
                      onClick={() => !voted && meAlive && !myVoteBanned && setMyVote(p.uid)}
                      disabled={voted || !meAlive || myVoteBanned}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${isSelected ? 'border-amber-500 bg-amber-900/30' : 'border-white/10 bg-white/5 hover:border-white/25'} ${!meAlive || voted || myVoteBanned ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0 font-bold overflow-hidden">
                        {p.photoURL
                          ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" />
                          : p.name[0]
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          {p.isAI && <Bot className="h-2.5 w-2.5 text-cyan-400/60 flex-shrink-0" />}
                        </div>
                        {votes > 0 && (
                          <p className="text-amber-400 text-[10px]">
                            {'⚡'.repeat(Math.min(votes, 5))} ×{votes}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {meAlive && !voted && !myVoteBanned && (
                <button
                  onClick={handleVote}
                  disabled={!myVote}
                  className="mt-3 w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                >
                  Votar
                </button>
              )}
              {voted && (
                <div className="mt-3 text-center text-amber-400/60 text-xs py-1">
                  ✓ Voto registrado
                </div>
              )}
              {myVoteBanned && meAlive && (
                <div className="mt-3 text-center text-orange-400/60 text-xs py-1">
                  🐐 Sin voto esta ronda
                </div>
              )}
              {!meAlive && (
                <div className="mt-3 text-center text-white/20 text-xs py-1">
                  No puedes votar
                </div>
              )}

              {/* Juez second vote button */}
              {isJuez && !game.juezUsed && (
                <button
                  onClick={onJuezSecondVote}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 bg-gray-700/60 hover:bg-gray-600/60 border border-gray-500/40 text-gray-200 text-xs font-medium py-2 rounded-xl transition-colors"
                >
                  <Scale className="h-3.5 w-3.5" />
                  Segunda votación
                </button>
              )}
              {isJuez && game.juezUsed && (
                <div className="mt-2 text-center text-gray-400/40 text-[10px] py-1">
                  ⚖️ Segunda votación usada
                </div>
              )}

              {/* Alborotadora fight picker */}
              {isAlborotadora && !game.alborotadoraFight && (
                <div className="mt-3 border border-amber-500/30 rounded-xl p-3 bg-amber-900/10">
                  <p className="text-xs text-amber-300 font-semibold mb-1">🥊 Alborotadora — provocar pelea</p>
                  <p className="text-[10px] text-white/40 mb-2">Elige 2 jugadores. Ambos morirán antes de la votación final.</p>
                  {alborotadoraStep === 0 ? (
                    <>
                      <p className="text-[10px] text-amber-300/60 mb-1">1er luchador:</p>
                      <div className="space-y-1">
                        {alivePlayers.filter(p => p.uid !== userId).map(p => (
                          <button key={p.uid} onClick={() => { setAlborotadoraFighters([p.uid]); setAlborotadoraStep(1); }}
                            className="w-full text-left text-xs p-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-amber-500/50 transition-all">
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-amber-300/60 mb-1">
                        2º luchador (contra {alivePlayers.find(p => p.uid === alborotadoraFighters[0])?.name}):
                      </p>
                      <div className="space-y-1">
                        {alivePlayers.filter(p => p.uid !== alborotadoraFighters[0]).map(p => (
                          <button key={p.uid} onClick={() => onAlborotadoraFight(alborotadoraFighters[0], p.uid)}
                            className="w-full text-left text-xs p-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-red-500/50 transition-all">
                            {p.name}
                          </button>
                        ))}
                        <button onClick={() => { setAlborotadoraFighters([]); setAlborotadoraStep(0); }}
                          className="w-full text-[10px] text-white/30 hover:text-white/50 pt-1">
                          ← Volver
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {game.alborotadoraFight && (
                <div className="mt-2 text-center text-amber-400/60 text-[10px] py-1">
                  🥊 Pelea activa: {game.alborotadoraFight.map(uid => (game.players ?? []).find(p => p.uid === uid)?.name).join(' vs ')}
                </div>
              )}

              {/* Verdugo secret target reminder */}
              {isVerdugo && verdugoTarget && (
                <div className="mt-3 border border-red-700/30 rounded-xl p-3 bg-red-950/10">
                  <p className="text-[10px] text-red-300/60 uppercase tracking-wide mb-1">Tu objetivo secreto</p>
                  <p className="text-sm text-white font-semibold">{verdugoTarget.name}</p>
                  <p className="text-[10px] text-white/30">Si el pueblo lo lincha hoy, ¡ganas solo!</p>
                </div>
              )}

              {/* Silenciadora reminder */}
              {isSilenced && (
                <div className="mt-3 border border-slate-700/40 rounded-xl p-3 bg-slate-950/20 text-center">
                  <p className="text-xs text-slate-400">🤫 Has sido silenciado. No puedes escribir en el chat.</p>
                </div>
              )}
            </div>

            {/* Alive list */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-3">
              <p className="text-white/25 text-[10px] uppercase tracking-wide mb-2">Vivos ({alivePlayers.length})</p>
              {alivePlayers.map(p => (
                <div key={p.uid} className="flex items-center gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-white/50 text-xs truncate">{p.name}</span>
                  {p.isAI && <Bot className="h-2.5 w-2.5 text-cyan-400/40" />}
                  {voteBanned.includes(p.uid) && <span className="text-orange-400 text-[9px]">🚫</span>}
                </div>
              ))}
              {(game.players ?? []).filter(p => !p.isAlive).map(p => (
                <div key={p.uid} className="flex items-center gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/15 flex-shrink-0" />
                  <span className="text-white/20 text-xs truncate line-through">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
