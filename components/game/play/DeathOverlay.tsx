'use client';

import { useEffect, useState } from 'react';
import { Skull } from 'lucide-react';

interface DeadPlayer {
  uid: string;
  name: string;
  role: string;
}

interface Props {
  deaths: DeadPlayer[];
  onDone: () => void;
}

export function DeathOverlay({ deaths, onDone }: Props) {
  const [step, setStep] = useState<'fade-in' | 'visible' | 'fade-out'>('fade-in');
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!deaths.length) { onDone(); return; }

    const t1 = setTimeout(() => setStep('visible'), 50);
    const t2 = setTimeout(() => setStep('fade-out'), 2800);
    const t3 = setTimeout(() => {
      if (current + 1 < deaths.length) {
        setCurrent(c => c + 1);
        setStep('fade-in');
        const r1 = setTimeout(() => setStep('visible'), 50);
        const r2 = setTimeout(() => setStep('fade-out'), 2800);
        const r3 = setTimeout(onDone, 3300);
        return () => { clearTimeout(r1); clearTimeout(r2); clearTimeout(r3); };
      } else {
        onDone();
      }
    }, 3300);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!deaths.length) return null;
  const player = deaths[current];

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(139,0,0,0.85) 0%, rgba(0,0,0,0.97) 70%)',
        opacity: step === 'fade-in' ? 0 : step === 'visible' ? 1 : 0,
        transition: step === 'fade-in' ? 'opacity 0.4s ease-in' : 'opacity 0.6s ease-out',
      }}
    >
      <div
        className="text-center px-8"
        style={{
          transform: step === 'visible' ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.4s ease-out',
        }}
      >
        <Skull
          className="mx-auto mb-6 text-red-500"
          style={{
            width: 80,
            height: 80,
            filter: 'drop-shadow(0 0 20px rgba(220,38,38,0.8))',
            animation: step === 'visible' ? 'pulse 1s ease-in-out infinite' : 'none',
          }}
        />
        <p className="text-red-400 text-lg font-semibold tracking-widest uppercase mb-2 opacity-80">
          Ha caído esta noche
        </p>
        <h2
          className="text-white font-black mb-3"
          style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', textShadow: '0 0 30px rgba(220,38,38,0.6)' }}
        >
          {player.name}
        </h2>
        <p className="text-red-300 text-xl font-semibold tracking-wide">
          Era el{' '}
          <span className="text-white font-black" style={{ textShadow: '0 0 15px rgba(255,255,255,0.5)' }}>
            {player.role}
          </span>
        </p>
        <div className="mt-8 flex justify-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-red-500"
              style={{
                animation: step === 'visible' ? `bounce 1s ease-in-out ${i * 0.15}s infinite` : 'none',
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
