'use client';

import { useEffect, useState, useRef } from 'react';
import { GameState } from './GamePlay';
import { getRoleIcon } from './roleIcons';
import { ROLES } from './roles';
import { useNarrator, waitForAudio } from '@/hooks/useNarrator';
import { Moon, Volume2, UserX, Send, MessageCircle } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';

interface Props {
  game: GameState;
  gameId: string;
  userId: string;
  userName: string;
  eliminatedName: string | null;
  eliminatedRole: string | null;
  onDone: () => void;
  autoSeconds?: number;
}

interface ChatMsg { id: string; senderId: string; senderName: string; text: string; }

export function DayTransition({ game, gameId, userId, userName, eliminatedName, eliminatedRole, onDone, autoSeconds = 4 }: Props) {
  const [narratorDone, setNarratorDone] = useState(false);
  const [countdown, setCountdown] = useState(autoSeconds);
  const { interruptWith, AUDIO_FILES } = useNarrator();
  const played = useRef(false);
  const doneFired = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Chat state
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Subscribe to public chat
  useEffect(() => {
    const q = query(collection(db, 'games', gameId, 'publicChat'), orderBy('createdAt', 'asc'), limit(40));
    return onSnapshot(q, snap => {
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMsg)));
      setTimeout(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
    });
  }, [gameId]);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setSending(true);
    await addDoc(collection(db, 'games', gameId, 'publicChat'), {
      senderId: userId,
      senderName: userName,
      text: msg.trim(),
      createdAt: serverTimestamp(),
    });
    setMsg('');
    setSending(false);
  };

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (eliminatedName) {
      interruptWith(AUDIO_FILES.exiledAnnounce, AUDIO_FILES.exiled, AUDIO_FILES.nightStart);
    } else {
      interruptWith(AUDIO_FILES.nightStart);
    }
    waitForAudio().then(() => setNarratorDone(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!narratorDone) return;
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [narratorDone, countdown]);

  useEffect(() => {
    if (!narratorDone) return;
    if (countdown === 0 && !doneFired.current) {
      doneFired.current = true;
      onDoneRef.current();
    }
  }, [countdown, narratorDone]);

  return (
    <div
      className="min-h-screen w-full text-white flex flex-col"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative z-10 flex flex-col md:flex-row h-screen max-w-5xl mx-auto w-full p-4 gap-4">

        {/* ── Left: transition info ── */}
        <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center">
          <div className="text-5xl animate-pulse">🌙</div>
          <h2 className="font-headline text-3xl font-bold">El pueblo duerme</h2>

          {eliminatedName ? (
            <div className="bg-amber-950/60 border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm">
              <UserX className="h-10 w-10 text-amber-400 mx-auto mb-3" />
              <p className="text-amber-300/70 text-sm uppercase tracking-widest mb-2">El pueblo ha desterrado a</p>
              <p className="font-headline text-2xl font-bold text-amber-200">{eliminatedName}</p>
              {eliminatedRole && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <img
                    src={getRoleIcon(eliminatedRole)}
                    alt={eliminatedRole}
                    className="w-8 h-8 rounded-full object-cover opacity-80"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-white/50 text-sm">
                    Era {eliminatedRole} — {ROLES[eliminatedRole]?.description ?? ''}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
              <Moon className="h-10 w-10 text-blue-300 mx-auto mb-3" />
              <p className="text-white/70 text-lg font-semibold">El pueblo no llegó a un acuerdo</p>
              <p className="text-white/30 text-sm mt-1">Nadie fue desterrado esta votación</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            {!narratorDone ? (
              <div className="flex items-center gap-2 text-white/40 text-sm animate-pulse">
                <Volume2 className="h-4 w-4" />
                <span>El narrador habla… usa el chat mientras tanto</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-white/30 text-xs">La noche comienza en {countdown}s…</span>
                <button
                  onClick={() => { if (!doneFired.current) { doneFired.current = true; onDoneRef.current(); } }}
                  className="text-white/60 hover:text-white text-xs underline transition-colors"
                >
                  Continuar ahora
                </button>
              </div>
            )}
          </div>

          {narratorDone && (
            <div className="w-full max-w-sm bg-white/5 rounded-full h-1">
              <div
                className="bg-blue-400/40 h-1 rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / autoSeconds) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Right: live chat ── */}
        <div className="w-full md:w-72 flex flex-col bg-black/60 border border-white/15 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <MessageCircle className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">Chat del pueblo</span>
            <span className="text-[10px] text-white/40 ml-auto">Habla mientras esperas</span>
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {msgs.length === 0 && (
              <p className="text-white/40 text-xs text-center mt-4">El pueblo no dice nada aún…</p>
            )}
            {msgs.map(m => (
              <div key={m.id} className={`flex gap-2 ${m.senderId === userId ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[85%] flex flex-col ${m.senderId === userId ? 'items-end' : 'items-start'}`}>
                  {m.senderId !== userId && (
                    <span className="text-[10px] text-white/60 mb-0.5 font-semibold">{m.senderName}</span>
                  )}
                  <div className={`px-2.5 py-1.5 rounded-xl text-xs ${m.senderId === userId ? 'bg-blue-500 text-white font-medium' : 'bg-white/15 text-white'}`}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMsg} className="p-2 border-t border-white/10 flex gap-2">
            <input
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Escribe algo…"
              className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
            <button
              type="submit"
              disabled={!msg.trim() || sending}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg px-3 py-2 transition-colors"
            >
              <Send className="h-3 w-3" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
