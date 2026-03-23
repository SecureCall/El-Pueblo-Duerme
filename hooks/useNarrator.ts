'use client';

import { useCallback, useRef } from 'react';

const VOZ = '/audio/voz/';

export const AUDIO_FILES = {
  nightStart:        `${VOZ}El pueblo... duerme.mp3`,
  nightAmbient:      `${VOZ}noche_pueblo_duerme.mp3`,
  dayWakeup:         `${VOZ}¡Pueblo... despierta!.mp3`,
  dayStart:          `${VOZ}dia_pueblo_despierta.mp3`,
  deathAnnounce:     `${VOZ}muerto.mp3`,
  rip:               `${VOZ}Descanse en paz.mp3`,
  debateStart:       `${VOZ}inicio_debate.mp3`,
  debatesOpen:       `${VOZ}debates empiecen.mp3`,
  voteStart:         `${VOZ}inicio_votacion.mp3`,
  exiled:            `${VOZ}destarrado por el pueblo.mp3`,
  exiledAnnounce:    `${VOZ}anuncio_exilio.mp3`,
  dangerHere:        `${VOZ}el peligro está aquí.mp3`,
  villageDies:       `${VOZ}aldea perecerá.mp3`,
  miracle:           `${VOZ}¡Milagro!.mp3`,
  gameStart:         `${VOZ}Que comience el juego..mp3`,
  victoryVillage:    `${VOZ}victoria_aldeanos.mp3`,
  victoryWolves:     `${VOZ}victoria_lobos.mp3`,
};

export function useNarrator() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((src: string, options?: { volume?: number }) => {
    if (typeof window === 'undefined') return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const a = new Audio(src);
      a.volume = options?.volume ?? 0.9;
      a.play().catch(() => {});
      audioRef.current = a;
    } catch {}
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const playSequence = useCallback(async (files: string[], gapMs = 300) => {
    for (const src of files) {
      await new Promise<void>(resolve => {
        try {
          const a = new Audio(src);
          a.volume = 0.9;
          audioRef.current = a;
          a.onended = () => setTimeout(resolve, gapMs);
          a.onerror = () => resolve();
          a.play().catch(() => resolve());
        } catch {
          resolve();
        }
      });
    }
  }, []);

  return { play, stop, playSequence, AUDIO_FILES };
}

export const NARRATIONS = {
  nightStart:    () => AUDIO_FILES.nightStart,
  dayStart:      (hasDead: boolean) => hasDead ? AUDIO_FILES.deathAnnounce : AUDIO_FILES.dayWakeup,
  dayWakeup:     () => AUDIO_FILES.dayWakeup,
  debateOpen:    () => AUDIO_FILES.debateStart,
  voteStart:     () => AUDIO_FILES.voteStart,
  exiled:        () => AUDIO_FILES.exiled,
  winVillage:    () => AUDIO_FILES.victoryVillage,
  winWolves:     () => AUDIO_FILES.victoryWolves,
  winOther:      () => AUDIO_FILES.victoryVillage,
  winMessage:    (winners: string | null) => {
    switch (winners) {
      case 'wolves': return AUDIO_FILES.victoryWolves;
      default:       return AUDIO_FILES.victoryVillage;
    }
  },
  gameStart:     () => AUDIO_FILES.gameStart,
};
