'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle, Coins } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/hooks/use-toast';
import { canWatchVideo, addCoins } from '@/lib/firebase/coins';

const BANNER_KEY = '62e20b1b19b6fefc4b9795ed79a64fab';

function AdSlot() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;}</style><script>atOptions={'key':'${BANNER_KEY}','format':'iframe','height':250,'width':300,'params':{}};</script><script src="https://www.highperformanceformat.com/${BANNER_KEY}/invoke.js"></script></head><body></body></html>`;
  return (
    <div className="w-full bg-black/30 rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: 160 }}>
      <iframe
        srcDoc={html}
        width={300}
        height={250}
        scrolling="no"
        frameBorder="0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{ border: 'none', display: 'block' }}
        title="Publicidad"
      />
    </div>
  );
}

interface VideoRewardProps {
  onCoinsEarned: () => void;
}

export function VideoReward({ onCoinsEarned }: VideoRewardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<'idle' | 'watching' | 'done' | 'unavailable'>('idle');
  const [seconds, setSeconds] = useState(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Comprobación de disponibilidad al montar — usa el cliente, sin POST al servidor
  useEffect(() => {
    if (!user) return;
    canWatchVideo(user.uid).then(can => {
      if (!can) setPhase('unavailable');
    }).catch(() => {});
  }, [user]);

  const startVideo = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Inicia sesión', description: 'Necesitas una cuenta para ganar monedas.' });
      return;
    }
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
      // Intento primario: servidor con Admin SDK (rate-limit garantizado server-side)
      const token = await user.getIdToken();
      const res = await fetch('/api/award-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429 || data.limitReached) {
        setPhase('unavailable');
        toast({ variant: 'destructive', title: 'Límite alcanzado', description: 'Ya viste 5 vídeos hoy. Vuelve mañana.' });
        return;
      }

      if (res.ok) {
        setPhase('done');
        onCoinsEarned();
        toast({ title: '¡+50 monedas!', description: 'Has ganado 50 monedas por ver el vídeo.' });
        return;
      }

      // Fallback cliente si el servidor no está disponible
      await clientFallback();
    } catch {
      await clientFallback();
    }
  };

  const clientFallback = async () => {
    if (!user) return;
    try {
      const can = await canWatchVideo(user.uid);
      if (!can) {
        setPhase('unavailable');
        toast({ variant: 'destructive', title: 'Límite alcanzado', description: 'Ya viste 5 vídeos hoy. Vuelve mañana.' });
        return;
      }
      await addCoins(user.uid, 50, 'video');
      setPhase('done');
      onCoinsEarned();
      toast({ title: '¡+50 monedas!', description: 'Has ganado 50 monedas por ver el vídeo.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron añadir las monedas. Inténtalo de nuevo.' });
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
          <AdSlot />
          <div className="flex items-center justify-between text-sm">
            <p className="text-white/50">Espera {seconds}s para recibir tus monedas...</p>
            <span className="text-yellow-400 font-bold text-xl">{seconds}s</span>
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
