'use client';

import { useState } from 'react';
import { DAILY_REWARDS } from '@/lib/firebase/dailyReward';
import { X, Flame } from 'lucide-react';

interface Props {
  streak: number;
  todayReward: number;
  onClaim: () => Promise<void>;
  onClose: () => void;
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', '☀'];

export function DailyRewardModal({ streak, todayReward, onClaim, onClose }: Props) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const currentDay = streak % DAILY_REWARDS.length;

  const handleClaim = async () => {
    setClaiming(true);
    await onClaim();
    setClaiming(false);
    setClaimed(true);
    setTimeout(() => onClose(), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-sm bg-[#0f0a1e] border border-purple-700/40 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 40px rgba(140,60,255,0.2)' }}>

        {/* Barra superior de color */}
        <div className="h-1 w-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500" />

        {/* Botón cerrar — grande y visible */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 pt-4 pb-5">
          {/* Encabezado */}
          <div className="flex items-center gap-2 mb-1">
            <Flame className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <span className="text-orange-400 font-black text-xs uppercase tracking-widest">
              Racha de {streak} {streak === 1 ? 'día' : 'días'}
            </span>
          </div>
          <h2 className="text-white font-black text-xl mb-4">¡Recompensa Diaria!</h2>

          {/* Grilla de 7 días — horizontal con scroll si hace falta */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {DAILY_REWARDS.map((reward, i) => {
              const isPast = i < currentDay;
              const isToday = i === currentDay;

              return (
                <div
                  key={i}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 rounded-xl py-2 border transition-all w-[42px] ${
                    isToday
                      ? 'bg-purple-600/30 border-purple-400/70'
                      : isPast
                      ? 'bg-green-900/20 border-green-700/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                  style={isToday ? { boxShadow: '0 0 10px rgba(160,80,255,0.5)' } : {}}
                >
                  <span className={`text-[9px] font-bold ${isToday ? 'text-purple-300' : 'text-white/40'}`}>
                    {DAY_LABELS[i]}
                  </span>
                  <span className="text-sm">
                    {i === 6 ? '👑' : isPast ? '✓' : '🪙'}
                  </span>
                  <span className={`text-[10px] font-black ${isToday ? 'text-yellow-300' : isPast ? 'text-green-400' : 'text-white/30'}`}>
                    {reward}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Premio de hoy */}
          <div className="flex items-center gap-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3 mb-4">
            <span className="text-3xl">🪙</span>
            <div>
              <p className="text-yellow-300 font-black text-2xl leading-none">+{todayReward}</p>
              <p className="text-yellow-500/60 text-xs mt-0.5">monedas de hoy</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-white/30 text-[10px]">Mañana</p>
              <p className="text-white/50 text-xs font-bold">+{DAILY_REWARDS[(currentDay + 1) % DAILY_REWARDS.length]} 🪙</p>
            </div>
          </div>

          {/* Botón */}
          {!claimed ? (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-3.5 rounded-2xl text-sm transition-all active:scale-95 disabled:opacity-60"
              style={{ boxShadow: '0 4px 20px rgba(160,60,255,0.35)' }}
            >
              {claiming ? '✨ Reclamando…' : `¡Reclamar ${todayReward} monedas!`}
            </button>
          ) : (
            <div className="w-full bg-green-600/20 border border-green-500/40 text-green-300 font-black py-3.5 rounded-2xl text-sm text-center">
              ✅ ¡Reclamado! Vuelve mañana
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
