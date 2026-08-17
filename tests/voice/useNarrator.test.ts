import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

async function loadNarrator() {
  vi.resetModules();
  (globalThis as any).window = {};
  (globalThis as any).Audio = FakeAudio;
  return import('../../hooks/useNarrator');
}

describe('useNarrator audio scheduler', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).Audio;
    vi.restoreAllMocks();
  });

  it('plays a sequence strictly in order', async () => {
    const { useNarrator } = await loadNarrator();
    const narrator = useNarrator();

    narrator.playSequence(['a.mp3', 'b.mp3', 'c.mp3']);

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('a.mp3');

    FakeAudio.instances[0].finish();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('b.mp3');

    FakeAudio.instances[1].finish();
    expect(FakeAudio.instances).toHaveLength(3);
    expect(FakeAudio.instances[2].src).toBe('c.mp3');
  });

  it('never creates two local narrator players at once', async () => {
    const { useNarrator } = await loadNarrator();
    const narrator = useNarrator();

    narrator.play('first.mp3');
    narrator.play('second.mp3');
    narrator.play('third.mp3');

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('first.mp3');
    expect(narrator.isBusy?.()).toBeUndefined();
  });

  it('resolves a waiter when the queued sequence becomes idle', async () => {
    const { useNarrator, waitForAudio, isNarratorBusy } = await loadNarrator();

    useNarrator().playSequence(['a.mp3', 'b.mp3']);
    const done = waitForAudio();

    expect(isNarratorBusy()).toBe(true);
    let resolved = false;
    done.then(() => { resolved = true; });

    FakeAudio.instances[0].finish();
    expect(resolved).toBe(false);

    FakeAudio.instances[1].finish();
    await done;
    expect(resolved).toBe(true);
    expect(isNarratorBusy()).toBe(false);
  });

  it('resolves an old waiter when a sequence is intentionally interrupted', async () => {
    const { useNarrator, waitForAudio } = await loadNarrator();
    const narrator = useNarrator();

    narrator.play('old.mp3');
    const oldWaiter = waitForAudio();

    narrator.interruptWith('new.mp3');
    await oldWaiter;

    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[0].onended).toBeNull();
    expect(FakeAudio.instances[1].src).toBe('new.mp3');
  });

  it('does not let stale callbacks advance a newer generation', async () => {
    const { useNarrator } = await loadNarrator();
    const narrator = useNarrator();

    narrator.play('old.mp3');
    const oldAudio = FakeAudio.instances[0];

    narrator.interruptWith('new.mp3');
    oldAudio.finish();

    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('new.mp3');
  });

  it('handles an audio error as a terminal event and continues the queue', async () => {
    const { useNarrator, waitForAudio } = await loadNarrator();

    useNarrator().playSequence(['broken.mp3', 'next.mp3']);
    const done = waitForAudio();

    FakeAudio.instances[0].fail();

    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('next.mp3');

    FakeAudio.instances[1].finish();
    await done;
  });

  it('treats repeated terminal signals as one completion', async () => {
    const { useNarrator, waitForAudio } = await loadNarrator();

    useNarrator().playSequence(['a.mp3', 'b.mp3']);
    const done = waitForAudio();
    const first = FakeAudio.instances[0];

    first.fail();
    first.finish();

    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('b.mp3');

    FakeAudio.instances[1].finish();
    await done;
  });
});
