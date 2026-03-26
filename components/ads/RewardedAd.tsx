'use client';

import { useState } from 'react';
import { Coins, Play } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, increment } from 'firebase/firestore';

interface Props {
  userId: string;
  coinsReward?: number;
  onRewarded?: () => void;
}

export function RewardedAd({ userId, coinsReward = 50, onRewarded }: Props) {
  const [state, setState] = useState<'idle' | 'watching' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);

  const startAd = () => {
    setState('watching');
    setSeconds(15);

    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          giveReward();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Push rewarded ad to Google AdSense
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  };

  const giveReward = async () => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        coins: increment(coinsReward),
      });
    } catch (_) {}
    setState('done');
    onRewarded?.();
  };

  if (state === 'done') {
    return (
      <div className="w-full bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 text-center">
        <div className="text-3xl mb-1">🪙</div>
        <p className="text-yellow-300 font-semibold text-sm">¡+{coinsReward} monedas ganadas!</p>
      </div>
    );
  }

  if (state === 'watching') {
    return (
      <div className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-center">
        <ins
          className="adsbygoogle block w-full"
          style={{ display: 'block', minHeight: 90 }}
          data-ad-client="ca-pub-4807272408824742"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
        <p className="text-white/50 text-xs mt-2">
          Cierra en {seconds}s... 🪙 +{coinsReward} monedas al terminar
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={startAd}
      className="w-full flex items-center justify-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 font-semibold py-3 rounded-xl transition-all text-sm"
    >
      <Play className="h-4 w-4" />
      Ver anuncio — ganar <Coins className="h-3.5 w-3.5 inline" /> {coinsReward} monedas
    </button>
  );
}
