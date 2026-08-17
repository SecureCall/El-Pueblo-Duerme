import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNarratorScheduler } from '../../hooks/useNarrator';

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  volume = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = true;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn(() => { this.paused = true; });

  constructor(src: string) {
    this.src = src;
    this.paused = false;
    FakeAudio.instances.push(this);
  }

  finish() {
    this.onended?.();
  }

  fail() {
    this.onerror?.();
  }
}

describe('useNarrator audio scheduler', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createScheduler = () =>
    createNarratorScheduler(src => new FakeAudio(src) as unknown as HTMLAudioElement);

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

    scheduler.play('first.mp3');
    scheduler.play('second.mp3');
    scheduler.play('third.mp3');

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('first.mp3');
    expect(scheduler.isBusy()).toBe(true);
  });

  it('resolves a waiter when the queued sequence becomes idle', async () => {
    const scheduler = createScheduler();

    scheduler.playSequence(['a.mp3', 'b.mp3']);
    const done = scheduler.waitForAudio();

    expect(scheduler.isBusy()).toBe(true);
    let resolved = false;
    done.then(() => { resolved = true; });

    FakeAudio.instances[0].finish();
    await Promise.resolve();
    expect(resolved).toBe(false);

    FakeAudio.instances[1].finish();
    await done;
    expect(resolved).toBe(true);
    expect(scheduler.isBusy()).toBe(false);
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

    scheduler.interruptWith('new.mp3');
    oldAudio.finish();

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

    FakeAudio.instances[1].finish();
    await done;
  });

  it('treats repeated terminal signals as one completion', async () => {
    const scheduler = createScheduler();

    scheduler.playSequence(['a.mp3', 'b.mp3']);
    const done = scheduler.waitForAudio();
    const first = FakeAudio.instances[0];

    first.fail();
    first.finish();

    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('b.mp3');

    FakeAudio.instances[1].finish();
    await done;
  });
});
