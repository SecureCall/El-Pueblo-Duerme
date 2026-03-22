'use client';

import { useState, useEffect } from 'react';
import { GameState } from '@/lib/game/types';
import { ChatPanel } from '../ChatPanel';
import { advanceToVote } from '@/lib/game/engine';
import { Sun, Users } from 'lucide-react';

interface Props {
  game: GameState; gameId: string; me: any; myRole: any;
  user: any; remaining: number; isHost: boolean;
}

function Timer({ seconds }: { seconds: number }) {
  const pct = Math.min(100, (seconds / 300) * 100);
  const color = seconds < 30 ? 'bg-red-500' : seconds < 60 ? 'bg-yellow-500' : 'bg-green-500';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-white/60 text-sm font-mono tabular-nums w-12 text-right">{m}:{s.toString().padStart(2,'0')}</span>
    </div>
  );
}

export function DayPhase({ game, gameId, me, user, remaining, isHost }: Props) {
  const [localRemaining, setLocalRemaining] = useState(remaining);
  const alivePlayers = game.players?.filter(p => p.isAlive) ?? [];
  const silenced = me?.isSilenced;

  useEffect(() => {
    const start = game.phaseStartedAt;
    const dur = game.phaseDuration;
    const tick = () => setLocalRemaining(Math.max(0, dur - (Date.now() - start) / 1000));
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [game.phaseStartedAt, game.phaseDuration]);

  const myRole = me?.role;
  const showWolfChat = myRole === 'lobo' || myRole === 'cria_lobo' || me?.transformedToWolf;
  const showTwinChat = me?.isTwin;
  const showLoversChat = me?.isLover;

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-yellow-400" />
          <h2 className="font-headline text-xl font-bold text-yellow-300">Debate del Pueblo</h2>
          <span className="text-white/30 text-sm">· Ronda {game.round}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white/40" />
          <span className="text-white/40 text-sm">{alivePlayers.length} vivos</span>
        </div>
      </div>

      <div className="flex-shrink-0">
        <Timer seconds={localRemaining} />
        {silenced && (
          <div className="mt-2 bg-purple-900/30 border border-purple-500/20 rounded-lg px-3 py-2">
            <p className="text-purple-300 text-sm text-center">🤫 Estás silenciado. No puedes hablar hoy.</p>
          </div>
        )}
      </div>

      {/* Announcements */}
      {(game.dayAnnouncements ?? []).length > 0 && (
        <div className="bg-black/30 border border-yellow-500/20 rounded-xl p-3 flex-shrink-0">
          {game.dayAnnouncements.map((a, i) => (
            <p key={i} className="text-yellow-300/80 text-sm">{a}</p>
          ))}
        </div>
      )}

      {/* Chats */}
      <div className="flex-1 grid gap-3 min-h-0" style={{ gridTemplateColumns: showWolfChat || showTwinChat || showLoversChat ? '1fr 1fr' : '1fr' }}>
        <ChatPanel
          gameId={gameId} channel="publicChat" title="💬 Chat del pueblo"
          myUid={user.uid} myName={user.displayName ?? 'Jugador'}
          silenced={silenced}
        />
        {showWolfChat && (
          <ChatPanel gameId={gameId} channel="wolfChat" title="🐺 Chat de lobos"
            myUid={user.uid} myName={user.displayName ?? 'Jugador'} accentColor="#f87171" />
        )}
        {showTwinChat && !showWolfChat && (
          <ChatPanel gameId={gameId} channel="twinChat" title="👯 Chat de gemelas"
            myUid={user.uid} myName={user.displayName ?? 'Jugador'} accentColor="#a78bfa" />
        )}
        {showLoversChat && !showWolfChat && !showTwinChat && (
          <ChatPanel gameId={gameId} channel="loversChat" title="💕 Chat de enamorados"
            myUid={user.uid} myName={user.displayName ?? 'Jugador'} accentColor="#f9a8d4" />
        )}
      </div>

      {/* Players */}
      <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
        {alivePlayers.map(p => (
          <div key={p.uid} className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 ring-1 ring-white/10">
              {p.photoURL ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-bold">{p.name[0]}</span>}
            </div>
            <span className="text-[9px] text-white/50 max-w-[40px] truncate text-center">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
