'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase/config';
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, limit,
} from 'firebase/firestore';

const EMOTES = [
  { emoji: '😱', label: 'Shock' },
  { emoji: '😡', label: 'Traición' },
  { emoji: '🤡', label: 'Tonto' },
  { emoji: '💀', label: 'RIP' },
  { emoji: '👀', label: 'Sospechoso' },
  { emoji: '🎭', label: 'Actor' },
  { emoji: '🤥', label: 'Mentiroso' },
  { emoji: '🎉', label: 'Victoria' },
];

interface FloatingEmote {
  id: string;
  emoji: string;
  senderName: string;
  x: number;
  createdAt: number;
}

interface Props {
  gameId: string;
  userId: string;
  userName: string;
}

const EMOTE_TTL_MS = 4000;
const COOLDOWN_MS = 1500;

export function EmoteBar({ gameId, userId, userName }: Props) {
  const [floaters, setFloaters] = useState<FloatingEmote[]>([]);
  const [lastSent, setLastSent] = useState(0);
  const [open, setOpen] = useState(false);

  // ── Escuchar emotes en tiempo real ──────────────────────────────
  useEffect(() => {
    const cutoff = Date.now() - 10000;
    const q = query(
      collection(db, 'games', gameId, 'emotes'),
      limit(30)
    );
    const unsub = onSnapshot(q, (snap: any) => {
      snap.docChanges().forEach((change: any) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const ts: number = data.createdAt?.toMillis?.() ?? Date.now();
        if (ts < cutoff) return; // ignorar histórico
        setFloaters(prev => {
          const id = change.doc.id;
          if (prev.find(f => f.id === id)) return prev;
          const newEmote: FloatingEmote = {
            id,
            emoji: data.emoji,
            senderName: data.senderName,
            x: 5 + Math.random() * 70,
            createdAt: ts,
          };
          return [...prev, newEmote].slice(-20);
        });
      });
    });
    return () => unsub();
  }, [gameId]);

  // ── Limpiar emotes caducados ──────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setFloaters(prev => prev.filter(f => now - f.createdAt < EMOTE_TTL_MS));
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ── Enviar emote ──────────────────────────────────────────────
  const sendEmote = useCallback(async (emoji: string) => {
    const now = Date.now();
    if (now - lastSent < COOLDOWN_MS) return;
    setLastSent(now);
    setOpen(false);
    await addDoc(collection(db, 'games', gameId, 'emotes'), {
      emoji,
      senderId: userId,
      senderName: userName,
      createdAt: serverTimestamp(),
    });
  }, [gameId, userId, userName, lastSent]);

  return (
    <>
      {/* ── Emotes flotantes ───────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {floaters.map(f => {
          const age = Date.now() - f.createdAt;
          const progress = age / EMOTE_TTL_MS;
          return (
            <div
              key={f.id}
              className="absolute flex flex-col items-center gap-0.5 animate-float-up"
              style={{
                left: `${f.x}%`,
                bottom: `${80 + progress * 30}px`,
                opacity: Math.max(0, 1 - progress * 1.5),
                transition: 'none',
              }}
            >
              <span className="text-3xl drop-shadow-lg select-none">{f.emoji}</span>
              <span className="text-[9px] text-white/70 bg-black/50 rounded px-1 whitespace-nowrap font-semibold">
                {f.senderName}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Botón principal ────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {open && (
          <div className="bg-gray-900/95 border border-white/15 rounded-2xl p-3 flex flex-wrap gap-2 max-w-[200px] shadow-2xl animate-fade-in">
            {EMOTES.map(e => (
              <button
                key={e.emoji}
                onClick={() => sendEmote(e.emoji)}
                title={e.label}
                className="text-2xl hover:scale-125 active:scale-95 transition-transform p-1 rounded-xl hover:bg-white/10"
              >
                {e.emoji}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setOpen(o => !o)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 text-xl ${
            open
              ? 'bg-white/20 border-2 border-white/40 scale-110'
              : 'bg-gray-800/90 border border-white/20 hover:scale-110 hover:bg-gray-700/90'
          }`}
          title="Reaccionar"
        >
          {open ? '✕' : '😮'}
        </button>
      </div>

      <style>{`
        @keyframes float-up {
          0%   { transform: translateY(0) scale(1); }
          50%  { transform: translateY(-60px) scale(1.1); }
          100% { transform: translateY(-120px) scale(0.9); }
        }
        .animate-float-up { animation: float-up 4s ease-out forwards; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.15s ease-out; }
      `}</style>
    </>
  );
}
