'use client';

import { useCallback, useRef } from 'react';

export function useNarrator() {
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string, options?: { rate?: number; pitch?: number }) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-ES';
    utter.rate = options?.rate ?? 0.88;
    utter.pitch = options?.pitch ?? 0.75;
    utter.volume = 1;

    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const esVoice =
        voices.find(v => v.lang === 'es-ES' && v.name.toLowerCase().includes('jorge')) ||
        voices.find(v => v.lang === 'es-ES' && !v.name.toLowerCase().includes('female') && !v.name.toLowerCase().includes('mónica') && !v.name.toLowerCase().includes('paulina')) ||
        voices.find(v => v.lang.startsWith('es')) ||
        null;
      if (esVoice) utter.voice = esVoice;
      window.speechSynthesis.speak(utter);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = setVoice;
    }

    utterRef.current = utter;
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop };
}

export const NARRATIONS = {
  nightStart: () => 'El pueblo duerme. Las sombras cubren las calles y las bestias despiertan.',
  nightWolves: () => 'Los lobos abren los ojos... y eligen su presa.',
  nightSeer: () => 'La vidente despierta y consulta las estrellas para descubrir la verdad.',
  nightWitch: () => 'La bruja despierta. En sus manos, una poción de vida y una de muerte.',
  nightCupido: () => 'Cupido despierta. Esta noche, unirá dos corazones para siempre.',
  nightGuardian: () => 'El guardián despierta. ¿A quién protegerá esta noche?',
  nightFlautista: () => 'El flautista toca su melodía en la oscuridad, hechizando almas inocentes.',
  nightPerroLobo: () => 'El perro lobo se despierta. ¿Lucha con el pueblo o con los lobos?',
  nightSalvaje: () => 'El niño salvaje elige a su mentor. Si cae, la bestia despertará en él.',
  dayStart: (victimName?: string | null) =>
    victimName
      ? `El pueblo despierta con horror. ${victimName} fue asesinado durante la noche. El pueblo debe encontrar a los culpables.`
      : 'Amanece en el pueblo. Esta noche nadie murió. Pero el peligro aún acecha.',
  voteResult: (name: string) =>
    `El pueblo ha decidido. ${name} es eliminado. Que la justicia guíe al pueblo.`,
  winVillage: () => '¡El pueblo ha triunfado! Los lobos han sido derrotados. La paz vuelve al pueblo.',
  winWolves: () => '¡Los lobos han ganado! Las bestias devoran lo que queda del pueblo en la oscuridad.',
  winFlautista: () => '¡El flautista ha vencido! Todos bailan al ritmo de su melodía para siempre.',
  winAngel: () => '¡El ángel ha ganado! Su sacrificio ha salvado al pueblo de la oscuridad.',
  winPicaro: () => '¡El pícaro ha ganado! El engaño y la astucia triunfan sobre todos.',
  winMessage: (winners: string | null) => {
    switch (winners) {
      case 'village': return NARRATIONS.winVillage();
      case 'wolves': return NARRATIONS.winWolves();
      case 'flautista': return NARRATIONS.winFlautista();
      case 'angel': return NARRATIONS.winAngel();
      case 'picaro': return NARRATIONS.winPicaro();
      default: return 'La partida ha terminado.';
    }
  },
};
