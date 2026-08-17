import { audioMixer, type AudioMix } from './audio-mixer';

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
  private mixListeners = new Set<(mix: AudioMix) => void>();

  setEnabled(enabled: boolean) {
    this.masterEnabled = enabled;
    if (!enabled) void this.stopAll();
  }

  isEnabled() { return this.masterEnabled; }

  onMixChange(listener: (mix: AudioMix) => void) {
    this.mixListeners.add(listener);
    listener(this.getMix());
    return () => this.mixListeners.delete(listener);
  }

  private notifyMixChange() {
    const mix = this.getMix();
    this.mixListeners.forEach(listener => listener(mix));
  }

  async play(cue: AudioCue): Promise<boolean> {
    if (!this.masterEnabled) return false;

    const now = Date.now();
    const last = this.lastPlayed.get(cue.id) ?? 0;
    if (cue.cooldownMs && now - last < cue.cooldownMs) return false;

    // Narration is a single exclusive channel. Never allow two narrator cues
    // to overlap, even when the incoming cue has equal priority.
    if (cue.bus === 'narrator') {
      const activeNarrators = [...this.active.values()].filter(active => active.bus === 'narrator');
      if (activeNarrators.length > 0) {
        const strongest = activeNarrators.reduce((max, active) => Math.max(max, active.priority), -Infinity);
        if (cue.priority < strongest) return false;
        await Promise.all(activeNarrators.map(active => this.stop(active.id)));
      }
    } else {
      const conflicts = [...this.active.values()].filter(active =>
        active.bus === cue.bus ||
        (cue.bus === 'sfx' && active.bus === 'sfx' && active.priority >= cue.priority)
      );

      if (cue.interrupt) {
        await Promise.all(conflicts.filter(active => active.priority <= cue.priority).map(active => this.stop(active.id)));
      } else if (conflicts.some(active => active.priority > cue.priority)) {
        return false;
      }
    }

    this.lastPlayed.set(cue.id, now);
    this.active.set(cue.id, cue);

    if (cue.bus === 'narrator') {
      if (this.cinematicDepth === 0) {
        audioMixer.enterCinematic();
        this.notifyMixChange();
      }
      this.cinematicDepth++;
    }

    try {
      await cue.play();
      return true;
    } finally {
      if (this.active.get(cue.id) === cue) {
        this.active.delete(cue.id);
        if (cue.bus === 'narrator') {
          this.cinematicDepth = Math.max(0, this.cinematicDepth - 1);
          if (this.cinematicDepth === 0) {
            audioMixer.leaveCinematic();
            this.notifyMixChange();
          }
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
        if (this.cinematicDepth === 0) {
          audioMixer.leaveCinematic();
          this.notifyMixChange();
        }
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
    this.notifyMixChange();
  }

  getMix() { return audioMixer.getMix(); }
  getActive() { return [...this.active.values()].map(cue => ({ id: cue.id, bus: cue.bus, priority: cue.priority })); }
}

export const audioDirector = new AudioDirector();
