'use client';

import { useCallback } from 'react';
import { audioDirector, type AudioCue } from '../lib/audio/audio-director';

const VOZ = '/audio/voz/';

export const AUDIO_FILES = {
  nightStart: `${VOZ}El pueblo... duerme.mp3`, nightAmbient: `${VOZ}noche_pueblo_duerme.mp3`,
  roosterCrow: '/audio/rooster-crowing-364473.mp3', dayWakeup: `${VOZ}¡Pueblo... despierta!.mp3`, dayStart: `${VOZ}dia_pueblo_despierta.mp3`,
  deathAnnounce: `${VOZ}muerto.mp3`, rip: `${VOZ}Descanse en paz.mp3`, vampireDeath: `${VOZ}muerte vampiro.mp3`,
  debateAmbient: `${VOZ}debate.mp3`, debateStart: `${VOZ}inicio_debate.mp3`, debatesOpen: `${VOZ}debates empiecen.mp3`, voteStart: `${VOZ}inicio_votacion.mp3`, dangerHere: `${VOZ}el peligro está aquí.mp3`,
  exiled: `${VOZ}destarrado por el pueblo.mp3`, exiledAnnounce: `${VOZ}anuncio_exilio.mp3`,
  gameStart: `${VOZ}Que comience el juego..mp3`, introEpic: `${VOZ}intro_epica.mp3`, salas: `${VOZ}salas.mp3`,
  miracle: `${VOZ}¡Milagro!.mp3`, villageDies: `${VOZ}aldea perecerá.mp3`, lastBullet: `${VOZ}la ultima bala.mp3`,
  victoryVillage: `${VOZ}victoria_aldeanos.mp3`, victoryWolves: `${VOZ}victoria_lobos.mp3`, victoryVampire: `${VOZ}el vampiro ha ganado .mp3`, victoryEbrio: `${VOZ}ganador el ebrio.mp3`, victoryVerdugo: `${VOZ}victoria el berdugo.mp3`, victoryCulto: `${VOZ}victoria culto.mp3`, victoryPescador: `${VOZ}pescador ganador.mp3`,
};

type AudioElement = HTMLAudioElement;
type AudioFactory = (src: string) => AudioElement;

export interface NarratorScheduler {
  play(src: string): void; playSequence(files: string[]): void; stop(): void; interruptWith(...files: string[]): void; waitForAudio(): Promise<void>; isBusy(): boolean;
}

export function createNarratorScheduler(audioFactory: AudioFactory): NarratorScheduler {
  let current: AudioElement | null = null, queue: string[] = [], playing = false, doneCallbacks: Array<() => void> = [], generation = 0;
  const resolveDoneWaiters = () => { const callbacks = doneCallbacks.splice(0); callbacks.forEach(cb => cb()); };
  const notifyDone = () => { if (!playing && queue.length === 0) resolveDoneWaiters(); };
  const playNext = (gen: number) => {
    if (gen !== generation) return;
    if (playing || queue.length === 0) { notifyDone(); return; }
    const src = queue.shift()!; playing = true;
    try {
      if (current) { current.onended = null; current.onerror = null; current.pause(); current.src = ''; }
      const audio = audioFactory(src); current = audio; audio.volume = 0.9;
      let finished = false;
      const done = () => { if (finished || generation !== gen) return; finished = true; playing = false; current = null; playNext(gen); };
      audio.onended = done; audio.onerror = done; audio.play().catch(done);
    } catch { playing = false; current = null; playNext(gen); }
  };
  const play = (src: string) => { if (src) { queue.push(src); playNext(generation); } };
  const playSequence = (files: string[]) => { if (files.length) { queue.push(...files); playNext(generation); } };
  const stop = () => {
    generation++; queue = []; playing = false;
    if (current) { current.onended = null; current.onerror = null; current.pause(); current.src = ''; current = null; }
    resolveDoneWaiters();
  };
  const interruptWith = (...files: string[]) => { stop(); playSequence(files); };
  const waitForAudio = () => !playing && queue.length === 0 ? Promise.resolve() : new Promise<void>(resolve => doneCallbacks.push(resolve));
  return { play, playSequence, stop, interruptWith, waitForAudio, isBusy: () => playing || queue.length > 0 };
}

const browserAudioFactory: AudioFactory = src => new Audio(src);
const narratorScheduler = createNarratorScheduler(browserAudioFactory);
const NARRATOR_CUE_ID = 'narrator:local-scheduler';

interface NarratorDirector { play(cue: AudioCue): Promise<boolean>; stop(id: string): Promise<void>; getActive(): Array<{ id: string; bus: string; priority: number }>; }

export function createNarratorDirectorBridge(scheduler: NarratorScheduler, director: NarratorDirector = audioDirector) {
  let directorOwnsNarrator = false;
  const startSequence = (files: string[]) => { scheduler.playSequence(files); return scheduler.waitForAudio(); };
  const makeCue = (files: string[]): AudioCue => ({
    id: NARRATOR_CUE_ID, bus: 'narrator', priority: 100,
    play: () => startSequence(files),
    stop: () => { directorOwnsNarrator = false; scheduler.stop(); },
  });
  const ensureDirectorCue = (files: string[]) => {
    if (!files.length) return;
    if (directorOwnsNarrator && director.getActive().some(cue => cue.id === NARRATOR_CUE_ID)) { scheduler.playSequence(files); return; }
    directorOwnsNarrator = true;
    void director.play(makeCue(files)).then(accepted => { if (!accepted) { directorOwnsNarrator = false; scheduler.stop(); } });
  };
  const stop = () => { directorOwnsNarrator = false; scheduler.stop(); void director.stop(NARRATOR_CUE_ID); };
  const interruptWith = (...files: string[]) => { directorOwnsNarrator = false; scheduler.stop(); void director.stop(NARRATOR_CUE_ID).then(() => ensureDirectorCue(files)); };
  return { play: (src: string) => ensureDirectorCue(src ? [src] : []), playSequence: (files: string[]) => ensureDirectorCue(files), stop, interruptWith, waitForAudio: () => scheduler.waitForAudio(), isBusy: () => scheduler.isBusy() };
}

const narratorBridge = createNarratorDirectorBridge(narratorScheduler);
export function waitForAudio(): Promise<void> { if (typeof window === 'undefined') return Promise.resolve(); return narratorBridge.waitForAudio(); }
export function isNarratorBusy(): boolean { return narratorBridge.isBusy(); }
export function useNarrator() {
  const play = useCallback((src: string) => narratorBridge.play(src), []);
  const playSequence = useCallback((files: string[]) => narratorBridge.playSequence(files), []);
  const stop = useCallback(() => narratorBridge.stop(), []);
  const interruptWith = useCallback((...files: string[]) => narratorBridge.interruptWith(...files), []);
  return { play, playSequence, stop, interruptWith, AUDIO_FILES };
}

export const NARRATIONS = {
  nightStart: () => AUDIO_FILES.nightStart, dayWakeup: () => AUDIO_FILES.dayWakeup, debateOpen: () => AUDIO_FILES.debateStart, voteStart: () => AUDIO_FILES.voteStart, exiled: () => AUDIO_FILES.exiled, gameStart: () => AUDIO_FILES.gameStart,
  winMessage: (winners: string | null): string => { switch (winners) { case 'wolves': return AUDIO_FILES.victoryWolves; case 'village': return AUDIO_FILES.victoryVillage; case 'vampiro': return AUDIO_FILES.victoryVampire; case 'ebrio': return AUDIO_FILES.victoryEbrio; case 'verdugo': return AUDIO_FILES.victoryVerdugo; case 'culto': return AUDIO_FILES.victoryCulto; case 'pescador': return AUDIO_FILES.victoryPescador; default: return AUDIO_FILES.victoryVillage; } },
};
