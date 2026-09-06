import { describe, expect, it } from 'vitest';
import { HOST_ABSENCE_MS, getTakeoverDecision } from '@/lib/server/hostTakeoverPolicy';

const baseGame = (overrides: Record<string, unknown> = {}) => ({
  hostUid: 'host',
  phase: 'roleReveal',
  players: [
    { uid: 'host', isAlive: true, isAI: false },
    { uid: 'alice', isAlive: true, isAI: false },
    { uid: 'bob', isAlive: true, isAI: false },
  ],
  ...overrides,
});

describe('host takeover policy', () => {
  it('rejects takeover while the host is still inside the absence window', () => {
    const now = 1_000_000;
    expect(getTakeoverDecision(baseGame(), 'alice', now - HOST_ABSENCE_MS + 1, now)).toEqual({
      ok: false,
      code: 'HOST_STILL_ACTIVE',
    });
  });

  it('selects the deterministic first eligible human after the host is stale', () => {
    const now = 1_000_000;
    const result = getTakeoverDecision(baseGame(), 'alice', now - HOST_ABSENCE_MS, now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hostUid).toBe('alice');
  });

  it('prevents a lower-priority candidate from taking over', () => {
    const now = 1_000_000;
    expect(getTakeoverDecision(baseGame(), 'bob', now - HOST_ABSENCE_MS, now)).toEqual({
      ok: false,
      code: 'NOT_NEXT_CANDIDATE',
    });
  });

  it('ignores dead and AI players when selecting the next host', () => {
    const now = 1_000_000;
    const game = baseGame({
      players: [
        { uid: 'host', isAlive: true, isAI: false },
        { uid: 'alice', isAlive: false, isAI: false },
        { uid: 'bot', isAlive: true, isAI: true },
        { uid: 'bob', isAlive: true, isAI: false },
      ],
    });
    const result = getTakeoverDecision(game, 'bob', now - HOST_ABSENCE_MS, now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hostUid).toBe('bob');
  });

  it('rejects takeover in lobby and ended phases', () => {
    const now = 1_000_000;
    expect(getTakeoverDecision(baseGame({ phase: 'lobby' }), 'alice', 0, now)).toEqual({ ok: false, code: 'TAKEOVER_NOT_ALLOWED' });
    expect(getTakeoverDecision(baseGame({ phase: 'ended' }), 'alice', 0, now)).toEqual({ ok: false, code: 'TAKEOVER_NOT_ALLOWED' });
  });
});
