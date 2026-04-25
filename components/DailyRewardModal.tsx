'use client';

import { useState } from 'react';
import { DAILY_REWARDS } from '@/lib/firebase/dailyReward';
import { X, Flame, Coins } from 'lucide-react';

interface Props {
  streak: number;
  todayReward: number;
  onClaim: () => Promise<void>;
  onClose: () => void;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', '¡Dom!'];

export function DailyRewardModal({ streak, todayReward, onClaim, onClose }: Props) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showCoins, setShowCoins] = useState(false);

  const currentDay = streak % DAILY_REWARDS.length;

  const handleClaim = async () => {
    setClaiming(true);
    await onClaim();
    setClaiming(false);
    setClaimed(true);
    setShowCoins(true);
    setTimeout(() => {
      onClose();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-gradient-to-b from-[#0f0a1e] to-[#0a0612] border border-purple-700/40 rounded-3xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 60px rgba(140,60,255,0.25)' }}>

        {/* Header glow */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(140,60,255,0.35) 0%, transparent 70%)' }} />

        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 text-white/30 hover:text-white/60 transition-colors p-1">
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-5 pt-6 pb-5">
          {/* Streak header */}
          <div className="flex flex-col items-center mb-5">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-5 w-5 text-orange-400" />
              <span className="text-orange-400 font-black text-sm uppercase tracking-widest">Racha de {streak} {streak === 1 ? 'día' : 'días'}</span>
              <Flame className="h-5 w-5 text-orange-400" />
            </div>
            <h2 className="text-white font-black text-2xl">¡Recompensa Diaria!</h2>
            <p className="text-white/40 text-xs mt-1">Entra cada día para ganar más monedas</p>
          </div>

          {/* 7-day grid */}
          <div className="grid grid-cols-7 gap-1.5 mb-5">
            {DAILY_REWARDS.map((reward, i) => {
              const isPast = i < currentDay;
              const isToday = i === currentDay;
              const isFuture = i > currentDay;
              const isLast = i === 6;

              return (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2 px-1 border transition-all ${
                    isToday
                      ? 'bg-purple-600/30 border-purple-400/60 scale-105'
                      : isPast
                      ? 'bg-green-900/20 border-green-700/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                  style={isToday ? { boxShadow: '0 0 12px rgba(160,80,255,0.4)' } : {}}
                >
                  <span className="text-[9px] font-bold text-white/40">{DAY_LABELS[i]}</span>
                  <span className={`text-base ${isToday ? 'text-yellow-300' : isPast ? 'text-green-400' : 'text-white/30'}`}>
                    {isLast ? '👑' : isPast ? '✓' : '🪙'}
                  </span>
                  <span className={`text-[10px] font-black ${isToday ? 'text-yellow-300' : isPast ? 'text-green-400' : 'text-white/25'}`}>
                    {reward}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Today's reward big display */}
          <div className="flex flex-col items-center mb-5">
            <div className={`relative flex flex-col items-center gap-1 bg-gradient-to-b from-yellow-500/20 to-orange-600/10 border border-yellow-500/30 rounded-2xl px-8 py-4 transition-all duration-500 ${showCoins ? 'scale-110' : ''}`}>
              <span className="text-4xl">🪙</span>
              <span className="text-yellow-300 font-black text-3xl">+{todayReward}</span>
              <span className="text-yellow-500/60 text-xs font-semibold">monedas de hoy</span>

              {/* Flying coins animation */}
              {showCoins && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                  {[...Array(6)].map((_, i) => (
                    <span
                      key={i}
                      className="absolute text-lg animate-bounce"
                      style={{
                        left: `${15 + i * 13}%`,
                        top: `${20 + (i % 3) * 20}%`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.6s',
                      }}
                    >🪙</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CTA button */}
          {!claimed ? (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-4 rounded-2xl text-base transition-all active:scale-95 disabled:opacity-60"
              style={{ boxShadow: '0 6px 24px rgba(160,60,255,0.4)' }}
            >
              {claiming ? '✨ Reclamando…' : `¡Reclamar ${todayReward} monedas!`}
            </button>
          ) : (
            <div className="w-full bg-green-600/30 border border-green-500/40 text-green-300 font-black py-4 rounded-2xl text-base text-center">
              ✅ ¡Recompensa reclamada!
            </div>
          )}

          <p className="text-white/20 text-[10px] text-center mt-3">
            Vuelve mañana para seguir tu racha → {DAILY_REWARDS[(currentDay + 1) % DAILY_REWARDS.length]} monedas
          </p>
        </div>
      </div>
    </div>
  );
}
