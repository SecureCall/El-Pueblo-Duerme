import { audioMixer, type AudioChannel } from './audio-mixer';

export type RuntimeAudio = {
  id: string;
  element: HTMLAudioElement;
  channel: AudioChannel;
  baseVolume: number;
};

const CHANNEL_BY_BUS: Record<string, AudioChannel> = {
  narrator: 'narrator',
  voice: 'voice',
  music: 'music',
  ambient: 'ambient',
  sfx: 'sfx',
};

class AudioRuntime {
  private items = new Map<string, RuntimeAudio>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlocked = false;

  private ensureTimer() {
    if (typeof window === 'undefined' || this.timer) return;
    this.timer = setInterval(() => this.syncMix(), 50);
  }

  private syncMix() {
    const mix = audioMixer.getMix();
    for (const item of this.items.values()) {
      item.element.volume = Math.max(0, Math.min(1, item.baseVolume * mix[item.channel]));
    }
  }

  async unlock(): Promise<void> {
    if (this.unlocked || typeof window === 'undefined') return;
    // Mobile browsers normally require a user gesture before audio can play.
    // A silent, immediately paused element primes the media pipeline without
    // stealing focus or producing audible output.
    try {
      const audio = new Audio();
      audio.muted = true;
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      await audio.play();
      audio.pause();
    } catch {
      // The next user gesture can retry unlock; playback itself remains safe.
    }
    this.unlocked = true;
  }

  register(id: string, src: string, bus: string, options: { loop?: boolean; volume?: number } = {}): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    this.remove(id);
    const element = new Audio(src);
    element.preload = 'auto';
    element.loop = !!options.loop;
    element.volume = options.volume ?? 1;
    const item: RuntimeAudio = {
      id,
      element,
      channel: CHANNEL_BY_BUS[bus] ?? 'sfx',
      baseVolume: options.volume ?? 1,
    };
    this.items.set(id, item);
    this.ensureTimer();
    return element;
  }

  async play(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) throw new Error(`Audio cue not registered: ${id}`);
    await this.unlock();
    item.element.currentTime = 0;
    this.syncMix();
    await item.element.play();
  }

  waitForEnd(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) return Promise.resolve();
    if (item.element.ended) return Promise.resolve();
    if (item.element.loop) return new Promise(() => undefined);
    return new Promise(resolve => {
      const done = () => { item.element.removeEventListener('ended', done); resolve(); };
      item.element.addEventListener('ended', done, { once: true });
    });
  }

  async stop(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;
    item.element.pause();
    try { item.element.currentTime = 0; } catch {}
  }

  remove(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    item.element.pause();
    item.element.removeAttribute('src');
    item.element.load();
    this.items.delete(id);
    if (this.items.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  registerVoiceElement(id: string, element: HTMLAudioElement, baseVolume = 1): void {
    if (typeof window === 'undefined') return;
    this.remove(id);
    this.items.set(id, { id, element, channel: 'voice', baseVolume });
    this.ensureTimer();
    this.syncMix();
  }

  reset(): void {
    for (const id of [...this.items.keys()]) this.remove(id);
    this.unlocked = false;
  }
}

export const audioRuntime = new AudioRuntime();
