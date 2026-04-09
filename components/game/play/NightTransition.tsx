'use client';

import { useEffect, useState, useRef } from 'react';
import { GameState } from './GamePlay';
import { getRoleIcon } from './roleIcons';
import { ROLES } from './roles';
import { useNarrator, waitForAudio } from '@/hooks/useNarrator';
import { Skull, Shield, Volume2, Send, MessageCircle } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { ShareMomentCard } from './ShareMomentCard';

interface Props {
  game: GameState;
  gameId: string;
  userId: string;
  userName: string;
  victimName: string | null;
  victimRole: string | null;
  onDone: () => void;
  autoSeconds?: number;
}

interface ChatMsg { id: string; senderId: string; senderName: string; text: string; }

// ── Efecto máquina de escribir ────────────────────────────────────────────────
function useTypewriter(text: string, speed = 28): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    if (!text) return;
    setDisplayed('');
    setDone(false);
    idxRef.current = 0;

    const tick = () => {
      idxRef.current += 1;
      setDisplayed(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) {
        setDone(true);
        return;
      }
      setTimeout(tick, speed);
    };
    const t = setTimeout(tick, 300);
    return () => clearTimeout(t);
  }, [text, speed]);

  return { displayed, done };
}

// ── Pantalla cinemática de muerte ─────────────────────────────────────────────
function DeathCinematic({
  victimName,
  victimRole,
  narration,
  onSkip,
}: {
  victimName: string;
  victimRole: string | null;
  narration: string;
  onSkip: () => void;
}) {
  const { displayed, done } = useTypewriter(narration, 30);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Vibración en móvil
    if ('vibrate' in navigator) navigator.vibrate([300, 100, 200, 100, 500]);
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={done ? onSkip : undefined}
    >
      {/* Glow rojo de fondo */}
      <div className="absolute inset-0 bg-red-950/30 animate-pulse pointer-events-none" />

      {/* Partículas de sangre (CSS puro) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 bg-red-700 rounded-full opacity-60"
            style={{
              left: `${15 + i * 14}%`,
              top: '-4px',
              height: `${60 + i * 30}px`,
              animationDuration: `${1.2 + i * 0.3}s`,
              animation: 'drip 2s ease-in forwards',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-8 max-w-lg text-center">
        {/* Skull con animación de entrada */}
        <div className="relative">
          <Skull className="h-20 w-20 text-red-500 animate-bounce" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 blur-xl bg-red-500/30 rounded-full" />
        </div>

        {/* Nombre de la víctima */}
        <div>
          <p className="text-red-400/70 text-xs uppercase tracking-[0.3em] mb-1">Ha muerto esta noche</p>
          <h1 className="text-5xl font-bold text-red-100 font-headline drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
            {victimName}
          </h1>
          {victimRole && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <img
                src={getRoleIcon(victimRole)}
                alt={victimRole}
                className="w-6 h-6 rounded-full object-cover opacity-70"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-white/40 text-sm">Era {victimRole}</span>
            </div>
          )}
        </div>

        {/* Narración del narrador IA */}
        {narration && (
          <div className="bg-black/60 border border-red-900/40 rounded-2xl p-5 w-full">
            <p className="text-red-200/90 text-base leading-relaxed italic font-serif">
              {displayed}
              {!done && <span className="inline-block w-0.5 h-4 bg-red-400 ml-0.5 animate-pulse align-middle" />}
            </p>
          </div>
        )}

        {done && (
          <button
            onClick={onSkip}
            className="text-white/30 hover:text-white/60 text-xs transition-colors animate-fade-in mt-2"
          >
            Toca para continuar →
          </button>
        )}
      </div>

      <style>{`
        @keyframes drip {
          0% { transform: translateY(0); opacity: 0.8; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function NightTransition({ game, gameId, userId, userName, victimName, victimRole, onDone, autoSeconds = 4 }: Props) {
  const [cinemaPhase, setCinemaPhase] = useState(!!victimName);
  const [showShareCard, setShowShareCard] = useState(false);
  const [narratorDone, setNarratorDone] = useState(false);
  const [countdown, setCountdown] = useState(autoSeconds);
  const [narration, setNarration] = useState('');
  const { interruptWith, AUDIO_FILES } = useNarrator();
  const played = useRef(false);
  const doneFired = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // ── Narrador IA ──────────────────────────────────────────────────
  useEffect(() => {
    const survivors = (game.players ?? [])
      .filter((p: any) => p.isAlive)
      .map((p: any) => p.name as string);

    const event = victimName ? 'night_death' : 'night_safe';

    fetch('/api/narrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        victimName,
        victimRole,
        round: game.roundNumber ?? 1,
        survivors,
      }),
    })
      .then(r => r.json())
      .then(d => { if (d.narration) setNarration(d.narration); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio ────────────────────────────────────────────────────────
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (victimName) {
      interruptWith(AUDIO_FILES.roosterCrow, AUDIO_FILES.deathAnnounce, AUDIO_FILES.rip);
    } else {
      interruptWith(AUDIO_FILES.roosterCrow, AUDIO_FILES.dayWakeup);
    }
    waitForAudio().then(() => setNarratorDone(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Chat en tiempo real ──────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'games', gameId, 'publicChat'), orderBy('createdAt', 'asc'), limit(40));
    return onSnapshot(q, (snap: any) => {
      setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      setTimeout(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
    });
  }, [gameId]);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setSending(true);
    await addDoc(collection(db, 'games', gameId, 'publicChat'), {
      senderId: userId, senderName: userName, text: msg.trim(), createdAt: serverTimestamp(),
    });
    setMsg(''); setSending(false);
  };

  // ── Countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (!narratorDone || cinemaPhase) return;
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [narratorDone, countdown, cinemaPhase]);

  useEffect(() => {
    if (!narratorDone || cinemaPhase) return;
    if (countdown === 0 && !doneFired.current) {
      doneFired.current = true;
      onDoneRef.current();
    }
  }, [countdown, narratorDone, cinemaPhase]);

  const bearGrowl = (game as any).bearGrowl;
  const profetaReveal = (game as any).profetaReveal;
  const profetaTarget = profetaReveal
    ? (game.players ?? []).find((p: any) => p.uid === profetaReveal.targetUid)
    : null;

  const alivePlayers = (game.players ?? []).filter((p: any) => p.isAlive);

  // ── Tarjeta de clip viral ────────────────────────────────────────
  if (showShareCard && victimName) {
    return (
      <ShareMomentCard
        type="death"
        victimName={victimName}
        victimRole={victimRole}
        round={game.roundNumber ?? 1}
        survivorsCount={alivePlayers.length}
        onContinue={() => { setShowShareCard(false); setCinemaPhase(false); }}
      />
    );
  }

  // ── Fase cinemática ──────────────────────────────────────────────
  if (cinemaPhase && victimName) {
    return (
      <DeathCinematic
        victimName={victimName}
        victimRole={victimRole}
        narration={narration}
        onSkip={() => setShowShareCard(true)}
      />
    );
  }

  // ── Transición normal ────────────────────────────────────────────
  return (
    <div
      className="min-h-screen w-full text-white flex flex-col"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative z-10 flex flex-col md:flex-row h-screen max-w-5xl mx-auto w-full p-4 gap-4">

        {/* ── Info de transición ── */}
        <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center">
          <div className="text-5xl animate-pulse">🌄</div>
          <h2 className="font-headline text-3xl font-bold">El pueblo despierta</h2>

          {victimName ? (
            <div className="bg-red-950/60 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm">
              <Skull className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-300/70 text-sm uppercase tracking-widest mb-2">Esta noche murió</p>
              <p className="font-headline text-2xl font-bold text-red-200">{victimName}</p>
              {victimRole && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <img
                    src={getRoleIcon(victimRole)}
                    alt={victimRole}
                    className="w-8 h-8 rounded-full object-cover opacity-80"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-white/50 text-sm">
                    Era {victimRole} — {ROLES[victimRole]?.description ?? ''}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-950/40 border border-green-500/20 rounded-2xl p-6 w-full max-w-sm">
              <Shield className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <p className="text-green-300 text-lg font-semibold">¡Nadie murió esta noche!</p>
              <p className="text-white/40 text-sm mt-1">El guardián o la bruja protegieron al pueblo</p>
            </div>
          )}

          {/* Narración IA (modo compacto tras la cinemática) */}
          {narration && !cinemaPhase && (
            <div className="bg-black/50 border border-white/10 rounded-xl px-5 py-4 w-full max-w-sm">
              <p className="text-white/70 text-sm italic leading-relaxed font-serif">"{narration}"</p>
            </div>
          )}

          {bearGrowl && (
            <div className="bg-amber-950/40 border border-amber-500/20 rounded-xl p-4 w-full max-w-sm">
              <span className="text-2xl">🐻</span>
              <p className="text-amber-300 text-sm mt-1">¡El oso gruñe! Hay un lobo entre los vecinos del domador.</p>
            </div>
          )}

          {profetaTarget && (
            <div className="bg-cyan-950/40 border border-cyan-500/20 rounded-xl p-4 w-full max-w-sm">
              <span className="text-2xl">🔮</span>
              <p className="text-cyan-300 text-sm mt-1">
                La profeta revela: <strong>{profetaTarget.name}</strong> es {profetaReveal.isWolf ? '🐺 un LOBO' : '👤 inocente'}
              </p>
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
                <span className="text-white/30 text-xs">El debate comienza en {countdown}s…</span>
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
                className="bg-white/30 h-1 rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / autoSeconds) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Chat lateral ── */}
        <div className="w-full md:w-72 flex flex-col bg-black/60 border border-white/15 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <MessageCircle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">Chat del pueblo</span>
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
                  <div className={`px-2.5 py-1.5 rounded-xl text-xs text-white ${m.senderId === userId ? 'bg-amber-600 font-semibold' : 'bg-gray-700'}`}>
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
              className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              disabled={!msg.trim() || sending}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 rounded-lg px-3 py-2 transition-colors"
            >
              <Send className="h-3 w-3" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
