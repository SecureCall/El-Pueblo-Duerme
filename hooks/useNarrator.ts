'use client';

import { useCallback } from 'react';

const VOZ = '/audio/voz/';

export const AUDIO_FILES = {
  nightStart:     `${VOZ}El pueblo... duerme.mp3`,
  nightAmbient:   `${VOZ}noche_pueblo_duerme.mp3`,
  dayWakeup:      `${VOZ}¡Pueblo... despierta!.mp3`,
  dayStart:       `${VOZ}dia_pueblo_despierta.mp3`,
  deathAnnounce:  `${VOZ}muerto.mp3`,
  rip:            `${VOZ}Descanse en paz.mp3`,
  debateStart:    `${VOZ}inicio_debate.mp3`,
  debatesOpen:    `${VOZ}debates empiecen.mp3`,
  voteStart:      `${VOZ}inicio_votacion.mp3`,
  exiled:         `${VOZ}destarrado por el pueblo.mp3`,
  exiledAnnounce: `${VOZ}anuncio_exilio.mp3`,
  dangerHere:     `${VOZ}el peligro está aquí.mp3`,
  villageDies:    `${VOZ}aldea perecerá.mp3`,
  miracle:        `${VOZ}¡Milagro!.mp3`,
  gameStart:      `${VOZ}Que comience el juego..mp3`,
  victoryVillage: `${VOZ}victoria_aldeanos.mp3`,
  victoryWolves:  `${VOZ}victoria_lobos.mp3`,
};

// ─── Singleton audio queue (shared across all components) ───────────────────

let _current: HTMLAudioElement | null = null;
let _queue: string[] = [];
let _playing = false;

function _playNext() {
  if (_playing || _queue.length === 0) return;
  const src = _queue.shift()!;
  _playing = true;

  try {
    if (_current) {
      _current.pause();
      _current.src = '';
    }
    _current = new Audio(src);
    _current.volume = 0.9;

    _current.onended = () => {
      _playing = false;
      _current = null;
      _playNext();
    };
    _current.onerror = () => {
      _playing = false;
      _current = null;
      _playNext();
    };

    _current.play().catch(() => {
      _playing = false;
      _current = null;
      _playNext();
    });
  } catch {
    _playing = false;
    _current = null;
    _playNext();
  }
}

/** Enqueue one or more audio files. They play in order, waiting for each to finish. */
function enqueue(...files: string[]) {
  if (typeof window === 'undefined') return;
  _queue.push(...files);
  _playNext();
}

/** Stop current audio and clear the entire queue. */
function stopAll() {
  _queue = [];
  _playing = false;
  if (_current) {
    _current.pause();
    _current.src = '';
    _current = null;
  }
}

/** Stop current audio, clear queue, then enqueue new files (interrupt). */
function interrupt(...files: string[]) {
  stopAll();
  enqueue(...files);
}

// ─── React hook ─────────────────────────────────────────────────────────────

export function useNarrator() {
  const play = useCallback((src: string) => enqueue(src), []);
  const playSequence = useCallback((files: string[]) => enqueue(...files), []);
  const stop = useCallback(() => stopAll(), []);
  const interruptWith = useCallback((...files: string[]) => interrupt(...files), []);

  return { play, playSequence, stop, interruptWith, AUDIO_FILES };
}

export const NARRATIONS = {
  nightStart:  () => AUDIO_FILES.nightStart,
  dayWakeup:   () => AUDIO_FILES.dayWakeup,
  debateOpen:  () => AUDIO_FILES.debateStart,
  voteStart:   () => AUDIO_FILES.voteStart,
  exiled:      () => AUDIO_FILES.exiled,
  winMessage:  (winners: string | null) =>
    winners === 'wolves' ? AUDIO_FILES.victoryWolves : AUDIO_FILES.victoryVillage,
  gameStart:   () => AUDIO_FILES.gameStart,
};
