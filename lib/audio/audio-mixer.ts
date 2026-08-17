export type AudioChannel = 'narrator' | 'voice' | 'music' | 'ambient' | 'sfx';

export type AudioMix = Record<AudioChannel, number>;

export const NORMAL_MIX: AudioMix = {
  narrator: 1,
  voice: 1,
  music: 0.72,
  ambient: 0.55,
  sfx: 0.9,
};

export const CINEMATIC_MIX: AudioMix = {
  narrator: 1,
  voice: 0.22,
  music: 0.22,
  ambient: 0.16,
  sfx: 0.68,
};

export type MixTransition = {
  from: AudioMix;
  to: AudioMix;
  durationMs: number;
  startedAt: number;
};

export class AudioMixer {
  private mix: AudioMix = { ...NORMAL_MIX };
  private transition: MixTransition | null = null;

  getMix(): AudioMix {
    if (!this.transition) return { ...this.mix };
    const elapsed = Date.now() - this.transition.startedAt;
    const duration = Math.max(1, this.transition.durationMs);
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const next = {} as AudioMix;
    (Object.keys(this.mix) as AudioChannel[]).forEach(channel => {
      next[channel] = this.transition!.from[channel] + (this.transition!.to[channel] - this.transition!.from[channel]) * eased;
    });
    if (progress >= 1) {
      this.mix = { ...this.transition.to };
      this.transition = null;
      return { ...this.mix };
    }
    return next;
  }

  transitionTo(target: AudioMix, durationMs = 450): void {
    const current = this.getMix();
    const duration = Math.max(0, durationMs);
    this.transition = { from: current, to: { ...target }, durationMs: duration, startedAt: Date.now() };
    if (duration === 0) this.getMix();
  }

  enterCinematic(durationMs = 350): void {
    this.transitionTo(CINEMATIC_MIX, durationMs);
  }

  leaveCinematic(durationMs = 650): void {
    this.transitionTo(NORMAL_MIX, durationMs);
  }

  reset(): void {
    this.transition = null;
    this.mix = { ...NORMAL_MIX };
  }
}

export const audioMixer = new AudioMixer();
