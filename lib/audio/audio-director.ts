import { audioMixer, CINEMATIC_MIX, NORMAL_MIX, type AudioMix } from './audio-mixer';

export interface AudioCue {
  id: string;
  bus: 'narrator' | 'music' | 'ambience' | 'effects' | 'voice';
  priority: number;
  play: () => Promise<void> | void;
  stop: () => void;
}

interface ActiveCue {
  cue: AudioCue;
  startedAt: number;
}

class AudioDirector {
  private active = new Map<string, ActiveCue>();
  private mixTimer: ReturnType<typeof setTimeout> | null = null;

  async play(cue: AudioCue): Promise<boolean> {
    if (cue.bus === 'narrator') {
      const narrators = [...this.active.values()].filter(({ cue: active }) => active.bus === 'narrator');
      const strongerOrEqual = narrators.find(({ cue: active }) => active.priority >= cue.priority);
      if (strongerOrEqual) return false;
      for (const { cue: active } of narrators) this.stopCue(active);
    }

    this.active.set(cue.id, { cue, startedAt: Date.now() });
    if (cue.bus === 'narrator') {
      audioMixer.setMix(CINEMATIC_MIX);
      this.scheduleNormalMixRestore();
    }

    try {
      // Playback is intentionally fire-and-forget: an Audio element/Howler/etc.
      // may remain active for the entire duration of the cue.
      void Promise.resolve(cue.play()).catch((error) => {
        console.error('[audioDirector] cue playback failed', error);
        this.stopCue(cue);
      });
    } catch (error) {
      this.stopCue(cue);
      throw error;
    }
    return true;
  }

  async stop(id: string): Promise<void> {
    const matching = [...this.active.values()].filter(({ cue }) => cue.id === id || cue.bus === id);
    for (const { cue } of matching) this.stopCue(cue);
    if (![...this.active.values()].some(({ cue }) => cue.bus === 'narrator')) this.scheduleNormalMixRestore();
  }

  async stopAll(): Promise<void> {
    for (const { cue } of this.active.values()) this.stopCue(cue);
    this.active.clear();
    if (this.mixTimer) clearTimeout(this.mixTimer);
    this.mixTimer = null;
    audioMixer.reset();
  }

  getActive(): Array<{ id: string; bus: AudioCue['bus']; priority: number }> {
    return [...this.active.values()].map(({ cue }) => ({ id: cue.id, bus: cue.bus, priority: cue.priority }));
  }

  getMix(): AudioMix {
    return audioMixer.getMix();
  }

  private stopCue(cue: AudioCue): void {
    try {
      cue.stop();
    } finally {
      this.active.delete(cue.id);
    }
  }

  private scheduleNormalMixRestore(): void {
    if (this.mixTimer) clearTimeout(this.mixTimer);
    this.mixTimer = setTimeout(() => {
      this.mixTimer = null;
      if (![...this.active.values()].some(({ cue }) => cue.bus === 'narrator')) audioMixer.setMix(NORMAL_MIX);
    }, 600);
  }
}

export const audioDirector = new AudioDirector();
