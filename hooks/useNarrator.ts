'use client';

import { useCallback } from 'react';

const VOZ = '/audio/voz/';

export const AUDIO_FILES = {
  nightStart: `${VOZ}El pueblo... duerme.mp3`,
  nightAmbient: `${VOZ}noche_pueblo_duerme.mp3`,
  roosterCrow: '/audio/rooster-crowing-364473.mp3',
  dayWakeup: `${VOZ}¡Pueblo... despierta!.mp3`,
  dayStart: `${VOZ}dia_pueblo_despierta.mp3`,
  deathAnnounce: `${VOZ}muerto.mp3`,
  rip: `${VOZ}Descanse en paz.mp3`,
  vampireDeath: `${VOZ}muerte vampiro.mp3`,
  debateAmbient: `${VOZ}debate.mp3`,
  debateStart: `${VOZ}inicio_debate.mp3`,
  debatesOpen: `${VOZ}debates empiecen.mp3`,
  voteStart: `${VOZ}inicio_votacion.mp3`,
  dangerHere: `${VOZ}el peligro está aquí.mp3`,
  exiled: `${VOZ}destarrado por el pueblo.mp3`,
  exiledAnnounce: `${VOZ}anuncio_exilio.mp3`,
  gameStart: `${VOZ}Que comience el juego..mp3`,
  introEpic: `${VOZ}intro_epica.mp3`,
  salas: `${VOZ}salas.mp3`,
  miracle: `${VOZ}¡Milagro!.mp3`,
  villageDies: `${VOZ}aldea perecerá.mp3`,
  lastBullet: `${VOZ}la ultima bala.mp3`,
  victoryVillage: `${VOZ}victoria_aldeanos.mp3`,
  victoryWolves: `${VOZ}victoria_lobos.mp3`,
  victoryVampire: `${VOZ}el vampiro ha ganado .mp3`,
  victoryEbrio: `${VOZ}ganador el ebrio.mp3`,
  victoryVerdugo: `${VOZ}victoria el berdugo.mp3`,
  victoryCulto: `${VOZ}victoria culto.mp3`,
  victoryPescador: `${VOZ}pescador ganador.mp3`,
};

type AudioElement = HTMLAudioElement;
type AudioFactory = (src: string) => AudioElement;

export interface NarratorScheduler {
  play(src: string): void;
  playSequence(files: string[]): void;
  stop(): void;
  interruptWith(...files: string[]): void;
  waitForAudio(): Promise<void>;
  isBusy(): boolean;
}

/**
 * Pure audio scheduler. It deliberately knows nothing about React, so it can
 * be stress-tested independently and then exposed through useNarrator().
 */
export function createNarratorScheduler(audioFactory: AudioFactory): NarratorScheduler {
  let current: AudioElement | null = null;
  let queue: string[] = [];
  let playing = false;
  let doneCallbacks: Array<() => void> = [];
  let generation = 0;

  const resolveDoneWaiters = () => {
    if (doneCallbacks.length === 0) return;
    const callbacks = doneCallbacks.splice(0);
    callbacks.forEach(cb => cb());
  };

  const notifyDone = () => {
    if (!playing && queue.length === 0) resolveDoneWaiters();
  };

  const playNext = (gen: number) => {
    if (gen !== generation) return;
    if (playing || queue.length === 0) {
      notifyDone();
      return;
    }

    const src = queue.shift()!;
    playing = true;

    try {
      if (current) {
        current.onended = null;
        current.onerror = null;
        current.pause();
        current.src = '';
      }

      const audio = audioFactory(src);
      current = audio;
      audio.volume = 0.9;

      let finished = false;
      const done = () => {
        if (finished || generation !== gen) return;
        finished = true;
        playing = false;
        current = null;
        playNext(gen);
      };

      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    } catch {
      playing = false;
      current = null;
      playNext(gen);
    }
  };

  const play = (src: string) => {
    if (src) {
      queue.push(src);
      playNext(generation);
    }
  };

  const playSequence = (files: string[]) => {
    if (files.length === 0) return;
    queue.push(...files);
    playNext(generation);
  };

  const stop = () => {
    generation++;
    queue = [];
    playing = false;

    if (current) {
      current.onended = null;
      current.onerror = null;
      current.pause();
      current.src = '';
      current = null;
    }

    resolveDoneWaiters();
  };

  const interruptWith = (...files: string[]) => {
    stop();
    playSequence(files);
  };

  const waitForAudio = () => {
    if (!playing && queue.length === 0) return Promise.resolve();
    return new Promise<void>(resolve => doneCallbacks.push(resolve));
  };

  return {
    play,
    playSequence,
    stop,
    interruptWith,
    waitForAudio,
    isBusy: () => playing || queue.length > 0,
  };
}

const browserAudioFactory: AudioFactory = src => new Audio(src);
const narratorScheduler = createNarratorScheduler(browserAudioFactory);

export function waitForAudio(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return narratorScheduler.waitForAudio();
}

export function isNarratorBusy(): boolean {
  return narratorScheduler.isBusy();
}

export function useNarrator() {
  const play = useCallback((src: string) => narratorScheduler.play(src), []);
  const playSequence = useCallback((files: string[]) => narratorScheduler.playSequence(files), []);
  const stop = useCallback(() => narratorScheduler.stop(), []);
  const interruptWith = useCallback((...files: string[]) => narratorScheduler.interruptWith(...files), []);

  return { play, playSequence, stop, interruptWith, AUDIO_FILES };
}

export const NARRATIONS = {
  nightStart: () => AUDIO_FILES.nightStart,
  dayWakeup: () => AUDIO_FILES.dayWakeup,
  debateOpen: () => AUDIO_FILES.debateStart,
  voteStart: () => AUDIO_FILES.voteStart,
  exiled: () => AUDIO_FILES.exiled,
  gameStart: () => AUDIO_FILES.gameStart,
  winMessage: (winners: string | null): string => {
    switch (winners) {
      case 'wolves': return AUDIO_FILES.victoryWolves;
      case 'village': return AUDIO_FILES.victoryVillage;
      case 'vampiro': return AUDIO_FILES.victoryVampire;
      case 'ebrio': return AUDIO_FILES.victoryEbrio;
      case 'verdugo': return AUDIO_FILES.victoryVerdugo;
      case 'culto': return AUDIO_FILES.victoryCulto;
      case 'pescador': return AUDIO_FILES.victoryPescador;
      default: return AUDIO_FILES.victoryVillage;
    }
  },
};
