'use client';

/**
 * OnboardingModal
 * Tutorial invisible de 3 pasos para nuevos jugadores.
 * Aparece una sola vez y se guarda en localStorage.
 */
import { useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';

const STEPS = [
  {
    emoji: '🎭',
    title: 'Tienes un rol secreto',
    desc: 'Serás Aldeano, Lobo, Vidente u otro rol especial. Nadie sabe quién eres. Actúa en consecuencia.',
    tip: 'Los lobos conocen a sus compañeros. El resto no sabe nada.',
  },
  {
    emoji: '🌙',
    title: 'La noche y el día',
    desc: 'De noche, los lobos eligen a quién matar. Algunos roles especiales actúan en silencio. De día, el pueblo debate y vota a quién desterrar.',
    tip: 'Convence al pueblo de que eres inocente. O actúa si eres lobo.',
  },
  {
    emoji: '🏆',
    title: '¿Cómo ganar?',
    desc: 'El pueblo gana si descubre y destierra a todos los lobos. Los lobos ganan si son mayoría o si el pueblo falla demasiado.',
    tip: 'La clave está en el debate. Escucha, desconfía y acusa en el momento exacto.',
  },
];

export function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem('epd_tutorial_v2');
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('epd_tutorial_v2', '1');
      }
    }, 400);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center pb-6 px-4 transition-all duration-400 ${
        exiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-sm bg-gray-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Progress bar */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-all ${i === step ? 'bg-amber-400 w-4' : i < step ? 'bg-white/40' : 'bg-white/15'}`}
                />
              ))}
            </div>
            <button
              onClick={dismiss}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-col items-center text-center gap-4">
            <span className="text-5xl">{current.emoji}</span>
            <h3 className="text-white font-bold text-xl leading-tight">{current.title}</h3>
            <p className="text-white/60 text-sm leading-relaxed">{current.desc}</p>

            {/* Tip box */}
            <div className="w-full bg-amber-950/40 border border-amber-800/30 rounded-xl px-4 py-3">
              <p className="text-amber-300/90 text-xs leading-relaxed">
                💡 {current.tip}
              </p>
            </div>
          </div>

          {/* Action */}
          <button
            onClick={next}
            className="mt-6 w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-2xl flex items-center justify-center gap-2 text-sm transition-colors active:scale-95"
          >
            {step < STEPS.length - 1 ? (
              <>Siguiente <ChevronRight className="h-4 w-4" /></>
            ) : (
              '¡Empezar a jugar!'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
