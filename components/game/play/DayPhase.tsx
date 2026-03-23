'use client';

import { useState, useEffect, useRef } from 'react';
import { GameState, Player } from './GamePlay';
import { Sun, Send, Vote, Skull, Bot, Timer } from 'lucide-react';
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
  onTimerEnd: () => void;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
}

export function DayPhase({ game, gameId, myRole, me, userId, isHost, onVote, onTimerEnd }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(DAY_DURATION);
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
  const roleInfo = ROLES[myRole];

  useEffect(() => {
    const q = query(
      collection(db, 'games', gameId, 'publicChat'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap: any) => {
      setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  }, [gameId]);

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
    if (!msg.trim()) return;
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

  const handleVote = async () => {
    if (!myVote || voted || !meAlive) return;
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

        <div className="flex gap-3 flex-1 min-h-0">
          {/* Chat */}
          <div className="flex-1 flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/10">
              <p className="text-sm font-medium text-amber-300/80">💬 Debate del Pueblo</p>
              <p className="text-white/30 text-xs">Discutid y decidid quién ejecutar hoy</p>
            </div>
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
            {meAlive && (
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
            {!meAlive && (
              <div className="p-3 border-t border-white/5 text-center">
                <p className="text-white/20 text-xs">👻 Estás muerto. Observas en silencio.</p>
              </div>
            )}
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
                      onClick={() => !voted && meAlive && setMyVote(p.uid)}
                      disabled={voted || !meAlive}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${isSelected ? 'border-amber-500 bg-amber-900/30' : 'border-white/10 bg-white/5 hover:border-white/25'} ${!meAlive || voted ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
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

              {meAlive && !voted && (
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
              {!meAlive && (
                <div className="mt-3 text-center text-white/20 text-xs py-1">
                  No puedes votar
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
