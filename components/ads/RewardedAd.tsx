'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Play } from 'lucide-react';
import { auth } from '@/lib/firebase/config';

const BANNER_KEY = '62e20b1b19b6fefc4b9795ed79a64fab';
const COINS_PER_VIDEO = 50;

interface Props {
  userId?: string;
  coinsReward?: number;
  onRewarded?: () => void;
}

function AdSlot() {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;}</style><script>atOptions={'key':'${BANNER_KEY}','format':'iframe','height':250,'width':300,'params':{}};</script><script src="https://www.highperformanceformat.com/${BANNER_KEY}/invoke.js"></script></head><body></body></html>`;
  return (
    <iframe
      srcDoc={html}
      width={300}
      height={250}
      scrolling="no"
      frameBorder="0"
      sandbox="allow-scripts"
      style={{ border: 'none', display: 'block', margin: '0 auto' }}
      title="Publicidad"
    />
  );
}

export function RewardedAd({ onRewarded }: Props) {
  const [state, setState] = useState<'idle' | 'watching' | 'done' | 'error'>('idle');
  const [seconds, setSeconds] = useState(0);
  const rewardIdRef = useRef<string | null>(null);

  const claimReward = useCallback(async () => {
    const currentUser = auth.currentUser;
    const rewardId = rewardIdRef.current;
    if (!currentUser || !rewardId) {
      setState('error');
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/award-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'claim', rewardId }),
      });

      rewardIdRef.current = null;
      if (!response.ok) {
        setState('error');
        return;
      }

      setState('done');
      onRewarded?.();
    } catch (_) {
      rewardIdRef.current = null;
      setState('error');
    }
  }, [onRewarded]);

  useEffect(() => {
    if (state !== 'watching') return;

    const interval = window.setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          window.clearInterval(interval);
          void claimReward();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [claimReward, state]);

  useEffect(() => () => {
    rewardIdRef.current = null;
  }, []);

  const startAd = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setState('error');
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/award-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.rewardId !== 'string') {
        setState('error');
        return;
      }

      rewardIdRef.current = data.rewardId;
      setState('watching');
      setSeconds(typeof data.waitSeconds === 'number' ? data.waitSeconds : 15);
    } catch (_) {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="w-full bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 text-center">
        <div className="text-3xl mb-1">🪙</div>
        <p className="text-yellow-300 font-semibold text-sm">¡+{COINS_PER_VIDEO} monedas ganadas!</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="w-full bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-center">
        <p className="text-red-300 font-semibold text-sm mb-2">No se pudo conceder la recompensa.</p>
        <button onClick={() => setState('idle')} className="text-yellow-300 text-sm underline">Intentar de nuevo</button>
      </div>
    );
  }

  if (state === 'watching') {
    return (
      <div className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-center">
        <AdSlot />
        <p className="text-white/50 text-xs mt-2">
          Cierra en {seconds}s... 🪙 +{COINS_PER_VIDEO} monedas al terminar
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={() => void startAd()}
      className="w-full flex items-center justify-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 font-semibold py-3 rounded-xl transition-all text-sm"
    >
      <Play className="h-4 w-4" />
      Ver anuncio — ganar <Coins className="h-3.5 w-3.5 inline" /> {COINS_PER_VIDEO} monedas
    </button>
  );
}
