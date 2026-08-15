'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { joinGame } from '@/lib/game/client-actions';
import { GameRoom } from '@/components/game/GameRoom';
import { Loader2 } from 'lucide-react';

export function SecureGameRoomEntry({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureJoined() {
      if (!user) return;
      try {
        const playerName = user.displayName || user.email?.split('@')[0] || 'Jugador';
        await joinGame(user, gameId, playerName);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo entrar en la partida');
      }
    }

    ensureJoined();
    return () => { cancelled = true; };
  }, [user, gameId]);

  if (!user || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05080f] text-white">
        {error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : (
          <Loader2 className="h-10 w-10 animate-spin text-white/50" />
        )}
      </div>
    );
  }

  return <GameRoom gameId={gameId} />;
}
