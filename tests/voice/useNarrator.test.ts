import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNarratorDirectorBridge, createNarratorScheduler, type NarratorScheduler } from '../../hooks/useNarrator';

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  volume = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = true;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn(() => { this.paused = true; });
  constructor(src: string) { this.src = src; this.paused = false; FakeAudio.instances.push(this); }
  finish() { this.onended?.(); }
  fail() { this.onerror?.(); }
}

describe('useNarrator audio scheduler', () => {
  beforeEach(() => { FakeAudio.instances = []; });
  afterEach(() => { vi.restoreAllMocks(); });

  const createScheduler = () => createNarratorScheduler(src => new FakeAudio(src) as unknown as HTMLAudioElement);

  it('plays a sequence strictly in order', async () => {
    const scheduler = createScheduler();
    scheduler.playSequence(['a.mp3', 'b.mp3', 'c.mp3']);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('a.mp3');
    FakeAudio.instances[0].finish();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('b.mp3');
    FakeAudio.instances[1].finish();
    expect(FakeAudio.instances).toHaveLength(3);
    expect(FakeAudio.instances[2].src).toBe('c.mp3');
  });

  it('never creates two local narrator players at once', () => {
    const scheduler = createScheduler();
    scheduler.play('first.mp3'); scheduler.play('second.mp3'); scheduler.play('third.mp3');
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('first.mp3');
    expect(scheduler.isBusy()).toBe(true);
  });

  it('resolves a waiter when the queued sequence becomes idle', async () => {
    const scheduler = createScheduler();
    scheduler.playSequence(['a.mp3', 'b.mp3']);
    const done = scheduler.waitForAudio();
    let resolved = false; done.then(() => { resolved = true; });
    FakeAudio.instances[0].finish(); await Promise.resolve();
    expect(resolved).toBe(false);
    FakeAudio.instances[1].finish(); await done;
    expect(resolved).toBe(true); expect(scheduler.isBusy()).toBe(false);
  });

  it('resolves an old waiter when a sequence is intentionally interrupted', async () => {
    const scheduler = createScheduler();
    scheduler.play('old.mp3');
    const oldWaiter = scheduler.waitForAudio();
    scheduler.interruptWith('new.mp3');
    await oldWaiter;
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[0].onended).toBeNull();
    expect(FakeAudio.instances[1].src).toBe('new.mp3');
  });

  it('does not let stale callbacks advance a newer generation', () => {
    const scheduler = createScheduler();
    scheduler.play('old.mp3');
    const oldAudio = FakeAudio.instances[0];
    scheduler.interruptWith('new.mp3'); oldAudio.finish();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('new.mp3');
  });

  it('handles an audio error as a terminal event and continues the queue', async () => {
    const scheduler = createScheduler();
    scheduler.playSequence(['broken.mp3', 'next.mp3']);
    const done = scheduler.waitForAudio();
    FakeAudio.instances[0].fail();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('next.mp3');
    FakeAudio.instances[1].finish(); await done;
  });

  it('treats repeated terminal signals as one completion', async () => {
    const scheduler = createScheduler();
    scheduler.playSequence(['a.mp3', 'b.mp3']);
    const done = scheduler.waitForAudio(); const first = FakeAudio.instances[0];
    first.fail(); first.finish();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('b.mp3');
    FakeAudio.instances[1].finish(); await done;
  });

  const createBridgeHarness = () => {
    let active: { id: string; bus: string; priority: number }[] = [];
    let activeCue: { stop?: () => Promise<void> | void } | null = null;
    let finishPlayback!: () => void;
    const scheduler: NarratorScheduler = {
      play: vi.fn(),
      playSequence: vi.fn(() => undefined),
      stop: vi.fn(),
      interruptWith: vi.fn(),
      waitForAudio: vi.fn(() => new Promise<void>(resolve => { finishPlayback = resolve; })),
      isBusy: vi.fn(() => true),
    };
    const director = {
      play: vi.fn(async (cue: any) => {
        active = [{ id: cue.id, bus: cue.bus, priority: cue.priority }];
        activeCue = cue;
        void Promise.resolve(cue.play()).finally(() => { active = []; activeCue = null; });
        return true;
      }),
      stop: vi.fn(async (id: string) => {
        if (active.some(cue => cue.id === id)) await activeCue?.stop?.();
        active = []; activeCue = null;
      }),
      getActive: vi.fn(() => active),
    };
    return { scheduler, director, finish: () => finishPlayback(), bridge: createNarratorDirectorBridge(scheduler, director) };
  };

  it('uses one director narrator cue while preserving scheduler queueing', () => {
    const h = createBridgeHarness();
    h.bridge.play('a.mp3');
    h.bridge.play('b.mp3');
    expect(h.director.play).toHaveBeenCalledTimes(1);
    expect(h.scheduler.playSequence).toHaveBeenNthCalledWith(1, ['a.mp3']);
    expect(h.scheduler.playSequence).toHaveBeenNthCalledWith(2, ['b.mp3']);
  });

  it('stops the director cue before starting an interrupted narrator sequence', async () => {
    const h = createBridgeHarness();
    h.bridge.play('old.mp3');
    h.bridge.interruptWith('new.mp3');
    await Promise.resolve();
    expect(h.scheduler.stop).toHaveBeenCalled();
    expect(h.director.stop).toHaveBeenCalledWith('narrator:local-scheduler');
    expect(h.director.play).toHaveBeenCalledTimes(2);
    expect(h.scheduler.playSequence).toHaveBeenLastCalledWith(['new.mp3']);
  });

  it('releases director ownership when narrator playback finishes', async () => {
    const h = createBridgeHarness();
    h.bridge.play('a.mp3');
    h.finish();
    await Promise.resolve();
    h.bridge.play('b.mp3');
    expect(h.director.play).toHaveBeenCalledTimes(2);
  });
});
