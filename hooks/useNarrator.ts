'use client';

import { useCallback } from 'react';

const VOZ = '/audio/voz/';

export const AUDIO_FILES = {
  // ─── Noche ───────────────────────────────────────────────────────
  nightStart:       `${VOZ}El pueblo... duerme.mp3`,
  nightAmbient:     `${VOZ}noche_pueblo_duerme.mp3`,

  // ─── Día ─────────────────────────────────────────────────────────
  dayWakeup:        `${VOZ}¡Pueblo... despierta!.mp3`,
  dayStart:         `${VOZ}dia_pueblo_despierta.mp3`,

  // ─── Muertes ─────────────────────────────────────────────────────
  deathAnnounce:    `${VOZ}muerto.mp3`,
  rip:              `${VOZ}Descanse en paz.mp3`,
  vampireDeath:     `${VOZ}muerte vampiro.mp3`,

  // ─── Debate / Votación ───────────────────────────────────────────
  debateAmbient:    `${VOZ}debate.mp3`,
  debateStart:      `${VOZ}inicio_debate.mp3`,
  debatesOpen:      `${VOZ}debates empiecen.mp3`,
  voteStart:        `${VOZ}inicio_votacion.mp3`,
  dangerHere:       `${VOZ}el peligro está aquí.mp3`,

  // ─── Exilio / Expulsión ──────────────────────────────────────────
  exiled:           `${VOZ}destarrado por el pueblo.mp3`,
  exiledAnnounce:   `${VOZ}anuncio_exilio.mp3`,

  // ─── Inicio de partida ───────────────────────────────────────────
  gameStart:        `${VOZ}Que comience el juego..mp3`,
  introEpic:        `${VOZ}intro_epica.mp3`,
  salas:            `${VOZ}salas.mp3`,

  // ─── Efectos especiales ──────────────────────────────────────────
  miracle:          `${VOZ}¡Milagro!.mp3`,
  villageDies:      `${VOZ}aldea perecerá.mp3`,
  lastBullet:       `${VOZ}la ultima bala.mp3`,

  // ─── Victorias ───────────────────────────────────────────────────
  victoryVillage:   `${VOZ}victoria_aldeanos.mp3`,
  victoryWolves:    `${VOZ}victoria_lobos.mp3`,
  victoryVampire:   `${VOZ}el vampiro ha ganado .mp3`,
  victoryEbrio:     `${VOZ}ganador el ebrio.mp3`,
  victoryVerdugo:   `${VOZ}victoria el berdugo.mp3`,
  victoryCulto:     `${VOZ}victoria culto.mp3`,
  victoryPescador:  `${VOZ}pescador ganador.mp3`,
};

// ─── Singleton audio queue ───────────────────────────────────────────────────

let _current: HTMLAudioElement | null = null;
let _queue: string[] = [];
let _playing = false;
let _doneCallbacks: Array<() => void> = [];

/**
 * Generation counter — incremented every time stopAll() is called.
 * Each audio element captures the generation at creation time.
 * If the generation doesn't match when a callback fires, the audio
 * was from a previous sequence and its callback is silently ignored.
 * This prevents stale onended / onerror events from corrupting state
 * and causing two tracks to play simultaneously.
 */
let _generation = 0;

function _notifyDone() {
  if (!_playing && _queue.length === 0 && _doneCallbacks.length > 0) {
    const cbs = _doneCallbacks.splice(0);
    cbs.forEach(cb => cb());
  }
}

function _playNext(gen: number) {
  if (gen !== _generation) return; // stale callback — ignore
  if (_playing || _queue.length === 0) {
    _notifyDone();
    return;
  }

  const src = _queue.shift()!;
  _playing = true;

  try {
    // Detach handlers from previous element before replacing
    if (_current) {
      _current.onended = null;
      _current.onerror = null;
      _current.pause();
      _current.src = '';
    }

    const audio = new Audio(src);
    _current = audio;
    audio.volume = 0.9;

    const done = (ok: boolean) => {
      if (_generation !== gen) return; // stale
      _playing = false;
      _current = null;
      _playNext(gen);
    };

    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    audio.play().catch(() => done(false));
  } catch {
    _playing = false;
    _current = null;
    _playNext(gen);
  }
}

/** Returns a promise that resolves when the entire audio queue finishes playing. */
export function waitForAudio(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!_playing && _queue.length === 0) return Promise.resolve();
  return new Promise(resolve => { _doneCallbacks.push(resolve); });
}

/** Returns true if narrator is currently speaking or has queued audio. */
export function isNarratorBusy(): boolean {
  return _playing || _queue.length > 0;
}

/** Enqueue one or more audio files. They play in order, waiting for each to finish. */
function enqueue(...files: string[]) {
  if (typeof window === 'undefined') return;
  _queue.push(...files);
  _playNext(_generation);
}

/** Stop current audio, detach its callbacks, and clear the entire queue. */
function stopAll() {
  _generation++;           // invalidate all in-flight callbacks
  _queue = [];
  _playing = false;
  if (_current) {
    _current.onended = null;
    _current.onerror = null;
    _current.pause();
    _current.src = '';
    _current = null;
  }
  _doneCallbacks = [];     // cancel pending waitForAudio promises
}

/** Stop current audio, clear queue, then enqueue new files (interrupt). */
function interrupt(...files: string[]) {
  stopAll();
  enqueue(...files);
}

// ─── React hook ──────────────────────────────────────────────────────────────

export function useNarrator() {
  const play = useCallback((src: string) => enqueue(src), []);
  const playSequence = useCallback((files: string[]) => enqueue(...files), []);
  const stop = useCallback(() => stopAll(), []);
  const interruptWith = useCallback((...files: string[]) => interrupt(...files), []);

  return { play, playSequence, stop, interruptWith, AUDIO_FILES };
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export const NARRATIONS = {
  nightStart:  () => AUDIO_FILES.nightStart,
  dayWakeup:   () => AUDIO_FILES.dayWakeup,
  debateOpen:  () => AUDIO_FILES.debateStart,
  voteStart:   () => AUDIO_FILES.voteStart,
  exiled:      () => AUDIO_FILES.exiled,
  gameStart:   () => AUDIO_FILES.gameStart,
  winMessage:  (winners: string | null): string => {
    switch (winners) {
      case 'wolves':    return AUDIO_FILES.victoryWolves;
      case 'village':   return AUDIO_FILES.victoryVillage;
      case 'vampiro':   return AUDIO_FILES.victoryVampire;
      case 'ebrio':     return AUDIO_FILES.victoryEbrio;
      case 'verdugo':   return AUDIO_FILES.victoryVerdugo;
      case 'culto':     return AUDIO_FILES.victoryCulto;
      case 'pescador':  return AUDIO_FILES.victoryPescador;
      default:          return AUDIO_FILES.victoryVillage;
    }
  },
};
