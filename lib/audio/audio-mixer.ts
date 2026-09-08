export interface AudioMix {
  music: number;
  ambience: number;
  effects: number;
  voice: number;
}

export const NORMAL_MIX: AudioMix = {
  music: 1,
  ambience: 1,
  effects: 1,
  voice: 1,
};

export const CINEMATIC_MIX: AudioMix = {
  music: 0.55,
  ambience: 0.65,
  effects: 0.8,
  voice: 1,
};

class AudioMixer {
  private mix: AudioMix = { ...NORMAL_MIX };

  getMix(): AudioMix {
    return { ...this.mix };
  }

  setMix(mix: Partial<AudioMix>): void {
    this.mix = {
      music: mix.music ?? this.mix.music,
      ambience: mix.ambience ?? this.mix.ambience,
      effects: mix.effects ?? this.mix.effects,
      voice: mix.voice ?? this.mix.voice,
    };
  }

  reset(): void {
    this.mix = { ...NORMAL_MIX };
  }
}

export const audioMixer = new AudioMixer();
