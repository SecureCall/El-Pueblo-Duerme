import { audioMixer } from './audio-mixer';

export type AudioBus = 'narrator' | 'voice' | 'music' | 'sfx' | 'ambient';
export type AudioPriority = 20 | 40 | 60 | 80 | 90 | 95 | 100;

export interface AudioCue {
  id: string;
  bus: AudioBus;
  priority: AudioPriority;
  play: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
  duckVoice?: boolean;
  duckMusic?: boolean;
  duckAmbient?: boolean;
  interrupt?: boolean;
  cooldownMs?: number;
}

class AudioDirector {
  private active = new Map<string, AudioCue>();
  private lastPlayed = new Map<string, number>();
  private masterEnabled = true;
  private cinematicDepth = 0;

  setEnabled(enabled: boolean) {
    this.masterEnabled = enabled;
    if (!enabled) void this.stopAll();
  }
  isEnabled() { return this.masterEnabled; }

  async play(cue: AudioCue): Promise<boolean> {
    if (!this.masterEnabled) return false;
    const now = Date.now();
    const last = this.lastPlayed.get(cue.id) ?? 0;
    if (cue.cooldownMs && now - last < cue.cooldownMs) return false;

    const conflicts = [...this.active.values()].filter(active =>
      active.bus === cue.bus ||
      (cue.bus === 'narrator' && active.bus === 'narrator') ||
      (cue.bus === 'sfx' && active.bus === 'sfx' && active.priority >= cue.priority)
    );

    if (cue.interrupt || cue.bus === 'narrator') {
      await Promise.all(conflicts.filter(active => active.priority <= cue.priority).map(active => this.stop(active.id)));
    } else if (conflicts.some(active => active.priority > cue.priority)) {
      return false;
    }

    this.lastPlayed.set(cue.id, now);
    this.active.set(cue.id, cue);

    if (cue.bus === 'narrator') {
      if (this.cinematicDepth === 0) audioMixer.enterCinematic();
      this.cinematicDepth++;
    }

    try {
      await cue.play();
      return true;
    } finally {
      // stop() may already have removed this cue. Only the owner that still
      // holds the active entry is allowed to release cinematic depth.
      if (this.active.get(cue.id) === cue) {
        this.active.delete(cue.id);
        if (cue.bus === 'narrator') {
          this.cinematicDepth = Math.max(0, this.cinematicDepth - 1);
          if (this.cinematicDepth === 0) audioMixer.leaveCinematic();
        }
      }
    }
  }

  async stop(id: string) {
    const cue = this.active.get(id);
    if (!cue) return;
    const wasNarrator = cue.bus === 'narrator';
    this.active.delete(id);
    try { await cue.stop?.(); }
    finally {
      if (wasNarrator) {
        this.cinematicDepth = Math.max(0, this.cinematicDepth - 1);
        if (this.cinematicDepth === 0) audioMixer.leaveCinematic();
      }
    }
  }

  async stopBus(bus: AudioBus) {
    await Promise.all([...this.active.values()].filter(cue => cue.bus === bus).map(cue => this.stop(cue.id)));
  }

  async stopAll() {
    await Promise.all([...this.active.values()].map(cue => this.stop(cue.id)));
    this.cinematicDepth = 0;
    audioMixer.reset();
  }

  getMix() { return audioMixer.getMix(); }
  getActive() { return [...this.active.values()].map(cue => ({ id: cue.id, bus: cue.bus, priority: cue.priority })); }
}

export const audioDirector = new AudioDirector();
