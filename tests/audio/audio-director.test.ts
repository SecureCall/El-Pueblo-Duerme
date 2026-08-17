import { describe, expect, it, beforeEach } from 'vitest';
import { audioDirector, type AudioCue } from '../../lib/audio/audio-director';
import { audioMixer, NORMAL_MIX } from '../../lib/audio/audio-mixer';

const cue = (id: string, priority: AudioCue['priority'], bus: AudioCue['bus'] = 'narrator') => {
  const state = { stopped: false };
  const item: AudioCue = {
    id,
    bus,
    priority,
    play: () => new Promise<void>(() => {}),
    stop: () => { state.stopped = true; },
  };
  return { item, state };
};

describe('AudioDirector narrator exclusivity', () => {
  beforeEach(async () => {
    await audioDirector.stopAll();
    audioMixer.reset();
  });

  it('rejects a lower-priority narrator while a stronger narrator is active', async () => {
    const strong = cue('strong', 100);
    const weak = cue('weak', 80);

    expect(await audioDirector.play(strong.item)).toBe(true);
    expect(await audioDirector.play(weak.item)).toBe(false);
    expect(strong.state.stopped).toBe(false);
    expect(audioDirector.getActive()).toEqual([{ id: 'strong', bus: 'narrator', priority: 100 }]);
  });

  it('replaces a lower-priority narrator with a stronger narrator', async () => {
    const weak = cue('weak', 80);
    const strong = cue('strong', 100);

    expect(await audioDirector.play(weak.item)).toBe(true);
    expect(await audioDirector.play(strong.item)).toBe(true);
    expect(weak.state.stopped).toBe(true);
    expect(audioDirector.getActive()).toEqual([{ id: 'strong', bus: 'narrator', priority: 100 }]);
  });

  it('replaces an equal-priority narrator instead of overlapping it', async () => {
    const first = cue('first', 80);
    const second = cue('second', 80);

    expect(await audioDirector.play(first.item)).toBe(true);
    expect(await audioDirector.play(second.item)).toBe(true);
    expect(first.state.stopped).toBe(true);
    expect(audioDirector.getActive()).toEqual([{ id: 'second', bus: 'narrator', priority: 80 }]);
  });

  it('enters cinematic mix for one narrator and restores normal mix after stop', async () => {
    const narrator = cue('narrator', 100);
    expect(await audioDirector.play(narrator.item)).toBe(true);
    expect(audioDirector.getMix().voice).toBeLessThan(NORMAL_MIX.voice);
    await audioDirector.stop('narrator');
    expect(audioDirector.getMix()).toEqual(NORMAL_MIX);
  });
});
