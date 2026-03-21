'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle, Coins, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/providers/AuthProvider';
import { addCoins, canWatchVideo } from '@/lib/firebase/coins';
import { useToast } from '@/app/hooks/use-toast';

interface VideoRewardProps {
  onCoinsEarned: () => void;
}

export function VideoReward({ onCoinsEarned }: VideoRewardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<'idle' | 'watching' | 'done' | 'unavailable'>('idle');
  const [seconds, setSeconds] = useState(30);
  const [canWatch, setCanWatch] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;
    canWatchVideo(user.uid).then(ok => {
      if (!ok) setPhase('unavailable');
    });
  }, [user]);

  const startVideo = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Inicia sesión', description: 'Necesitas una cuenta para ganar monedas.' });
      return;
    }
    const ok = await canWatchVideo(user.uid);
    if (!ok) { setPhase('unavailable'); return; }

    setPhase('watching');
    setSeconds(30);
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          rewardUser();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const rewardUser = async () => {
    if (!user) return;
    try {
      await addCoins(user.uid, 50, 'video');
      setPhase('done');
      onCoinsEarned();
      toast({ title: '¡+50 monedas!', description: 'Has ganado 50 monedas por ver el vídeo.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron añadir las monedas.' });
      setPhase('idle');
    }
  };

  const reset = () => {
    setPhase('idle');
    setSeconds(30);
  };

  const progress = ((30 - seconds) / 30) * 100;

  return (
    <div className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 border border-yellow-500/30 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-yellow-500 rounded-full p-2">
          <Coins className="h-5 w-5 text-black" />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">Ganar Monedas Gratis</h3>
          <p className="text-white/60 text-sm">Ve vídeos cortos y gana 50 monedas cada uno (máx. 5 por día)</p>
        </div>
      </div>

      {phase === 'idle' && (
        <button
          onClick={startVideo}
          className="w-full flex items-center justify-center gap-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl transition-all active:scale-95"
        >
          <Play className="h-5 w-5" />
          Ver Vídeo y Ganar +50 monedas
        </button>
      )}

      {phase === 'watching' && (
        <div className="space-y-3">
          <div className="relative bg-black rounded-xl overflow-hidden" style={{ paddingBottom: '42%' }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <div className="text-6xl mb-3">🎬</div>
              <p className="text-white/70 text-sm">Vídeo en reproducción...</p>
              <p className="text-yellow-400 font-bold text-2xl mt-2">{seconds}s</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="bg-yellow-400 h-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-white/50 text-xs">No cierres esta página — ¡ya casi tienes tus monedas!</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto" />
          <p className="text-white font-bold text-lg">¡+50 monedas ganadas!</p>
          <button
            onClick={reset}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-6 rounded-xl transition-all"
          >
            Ver otro vídeo
          </button>
        </div>
      )}

      {phase === 'unavailable' && (
        <div className="text-center py-4 text-white/50">
          <p className="text-lg">✅ Límite diario alcanzado</p>
          <p className="text-sm mt-1">Vuelve mañana para ganar más monedas</p>
        </div>
      )}
    </div>
  );
}
