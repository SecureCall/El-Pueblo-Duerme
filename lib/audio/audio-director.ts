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

const DEFAULT_DUCK = { voice: 0.25, music: 0.2, ambient: 0.15 } as const;

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
      await Promise.all(conflicts.filter(active => (active.priority ?? 0) <= cue.priority).map(active => this.stop(active.id)));
    } else if (conflicts.some(active => active.priority > cue.priority)) {
      return false;
    }

    this.lastPlayed.set(cue.id, now);
    this.active.set(cue.id, cue);
    if (cue.bus === 'narrator') this.cinematicDepth++;

    try {
      await cue.play();
      return true;
    } finally {
      this.active.delete(cue.id);
      if (cue.bus === 'narrator') this.cinematicDepth = Math.max(0, this.cinematicDepth - 1);
    }
  }

  async stop(id: string) {
    const cue = this.active.get(id);
    if (!cue) return;
    try { await cue.stop?.(); } finally { this.active.delete(id); }
  }

  async stopBus(bus: AudioBus) {
    const cues = [...this.active.values()].filter(cue => cue.bus === bus);
    await Promise.all(cues.map(cue => this.stop(cue.id)));
  }

  async stopAll() {
    const cues = [...this.active.values()];
    await Promise.all(cues.map(cue => this.stop(cue.id)));
    this.cinematicDepth = 0;
  }

  getMix() {
    if (this.cinematicDepth === 0) return { voice: 1, music: 1, ambient: 1 };
    return DEFAULT_DUCK;
  }

  getActive() { return [...this.active.values()].map(cue => ({ id: cue.id, bus: cue.bus, priority: cue.priority })); }
}

export const audioDirector = new AudioDirector();
