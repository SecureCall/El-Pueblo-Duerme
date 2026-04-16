'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Moon, Sun, Users, Vote, Eye } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    icon: <Moon className="h-12 w-12 text-indigo-400" />,
    title: 'La Noche Cae',
    body: 'Cada noche, los lobos despiertan en secreto y eligen a una víctima. Roles especiales como la Vidente o el Doctor también actúan mientras el pueblo duerme.',
    tip: '🐺 Los lobos conocen a sus aliados. El pueblo, no.',
    bg: 'from-indigo-900/80 to-black',
  },
  {
    icon: <Sun className="h-12 w-12 text-yellow-400" />,
    title: 'El Día Despierta',
    body: 'Al amanecer se revela quién murió. El pueblo debate, acusa y vota para eliminar a alguien sospechoso de ser lobo.',
    tip: '🗣️ Convence al pueblo de tu inocencia... o de la culpa de otro.',
    bg: 'from-yellow-900/50 to-black',
  },
  {
    icon: <Vote className="h-12 w-12 text-red-400" />,
    title: 'La Votación',
    body: 'Todos los jugadores vivos votan para eliminar a un sospechoso. El más votado es ejecutado y se revela su rol. Elige con cuidado: podrías eliminar a un aliado.',
    tip: '⚖️ Un voto de empate salva al acusado... por ahora.',
    bg: 'from-red-900/50 to-black',
  },
  {
    icon: <Eye className="h-12 w-12 text-violet-400" />,
    title: 'Roles Especiales',
    body: 'Cada jugador recibe un rol secreto. La Vidente ve la verdad, el Doctor salva vidas, la Hechicera puede revivir o envenenar, el Cazador dispara al morir.',
    tip: '🎭 Más de 35 roles con habilidades únicas.',
    bg: 'from-violet-900/50 to-black',
  },
  {
    icon: <Users className="h-12 w-12 text-green-400" />,
    title: '¿Quién Gana?',
    body: 'El pueblo gana si elimina a todos los lobos. Los lobos ganan cuando igualan en número al pueblo. Algunos roles tienen victorias propias (el Ángel, el Pícaro…).',
    tip: '🏆 La partida puede terminar de muchas formas sorpresa.',
    bg: 'from-green-900/50 to-black',
  },
];

const TUTORIAL_KEY = 'elpueblo_tutorial_done';

export function shouldShowTutorial(): boolean {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(TUTORIAL_KEY);
}

export function markTutorialDone(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TUTORIAL_KEY, '1');
}

export function TutorialOverlay({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    markTutorialDone();
    onClose();
  };

  const handleNext = () => {
    if (isLast) { handleClose(); return; }
    setStep(s => s + 1);
  };

  const handlePrev = () => setStep(s => Math.max(0, s - 1));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{
        backgroundColor: 'rgba(0,0,0,0.85)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        className={`relative w-full max-w-sm bg-gradient-to-b ${current.bg} border border-white/15 rounded-3xl overflow-hidden`}
        style={{
          transform: visible ? 'scale(1)' : 'scale(0.92)',
          transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-8 pb-4 text-center">
          <div className="flex justify-center mb-4">{current.icon}</div>
          <h2 className="font-headline text-2xl font-black mb-3 text-white">{current.title}</h2>
          <p className="text-white/70 text-sm leading-relaxed mb-4">{current.body}</p>
          <div className="bg-white/8 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white/50 italic">
            {current.tip}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all ${i === step ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/25'}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 px-6 pb-6">
          {step > 0 && (
            <button
              onClick={handlePrev}
              className="flex items-center gap-1 px-4 py-3 rounded-xl bg-white/8 border border-white/10 text-white/60 hover:text-white text-sm font-medium transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl bg-white text-black font-bold text-sm transition-all hover:bg-white/90"
          >
            {isLast ? '¡Empezar a jugar!' : 'Siguiente'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
