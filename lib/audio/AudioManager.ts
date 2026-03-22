import { MUSIC_FILES, VOICE_FILES, MusicTrack, VoiceLine } from './sounds';

class AudioManager {
  private musicEl: HTMLAudioElement | null = null;
  private voiceEl: HTMLAudioElement | null = null;
  private currentTrack: MusicTrack | null = null;
  private musicVolume = 0.35;
  private voiceVolume = 1.0;
  private muted = false;

  private createAudio(src: string, loop: boolean, volume: number): HTMLAudioElement {
    const el = new Audio(src);
    el.loop = loop;
    el.volume = this.muted ? 0 : volume;
    return el;
  }

  playMusic(track: MusicTrack) {
    if (this.currentTrack === track && this.musicEl && !this.musicEl.paused) return;

    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.src = '';
    }

    this.currentTrack = track;
    this.musicEl = this.createAudio(MUSIC_FILES[track], true, this.musicVolume);
    this.musicEl.play().catch(() => {});
  }

  stopMusic() {
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.currentTime = 0;
      this.currentTrack = null;
    }
  }

  playVoice(line: VoiceLine, onEnd?: () => void) {
    if (this.voiceEl) {
      this.voiceEl.pause();
      this.voiceEl.src = '';
    }

    this.voiceEl = this.createAudio(VOICE_FILES[line], false, this.voiceVolume);
    if (onEnd) this.voiceEl.addEventListener('ended', onEnd, { once: true });
    this.voiceEl.play().catch(() => {});
  }

  stopVoice() {
    if (this.voiceEl) {
      this.voiceEl.pause();
      this.voiceEl.currentTime = 0;
    }
  }

  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicEl) this.musicEl.volume = this.muted ? 0 : this.musicVolume;
  }

  setVoiceVolume(v: number) {
    this.voiceVolume = Math.max(0, Math.min(1, v));
    if (this.voiceEl) this.voiceEl.volume = this.muted ? 0 : this.voiceVolume;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.musicEl) this.musicEl.volume = this.muted ? 0 : this.musicVolume;
    if (this.voiceEl) this.voiceEl.volume = this.muted ? 0 : this.voiceVolume;
    return this.muted;
  }

  get isMuted() {
    return this.muted;
  }

  get currentMusic() {
    return this.currentTrack;
  }

  playVoiceThenMusic(line: VoiceLine, track: MusicTrack) {
    this.stopMusic();
    this.playVoice(line, () => {
      this.playMusic(track);
    });
  }

  nightSequence() {
    this.playVoiceThenMusic('el-pueblo-duerme', 'night');
  }

  daySequence() {
    this.stopMusic();
    this.playVoice('pueblo-despierta', () => {
      this.playMusic('rooster');
      setTimeout(() => this.playMusic('day'), 5000);
    });
  }

  gameStartSequence() {
    this.stopMusic();
    this.playVoice('intro-epica', () => {
      this.playVoice('que-comience-el-juego', () => {
        this.playMusic('night');
      });
    });
  }
}

const audioManager = typeof window !== 'undefined' ? new AudioManager() : null;

export function getAudioManager(): AudioManager | null {
  return audioManager;
}

export type { AudioManager };
