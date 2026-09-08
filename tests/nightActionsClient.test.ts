import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const getIdToken = vi.fn().mockResolvedValue('token');

vi.mock('@/lib/firebase/config', () => ({
  auth: { currentUser: { uid: 'player-1', getIdToken } },
}));

describe('requestNightAction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    getIdToken.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the authenticated UID and payload to the authoritative endpoint', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      validated: true,
      created: true,
      resolved: false,
      actorUid: 'player-1',
      role: 'Vidente',
      roundNumber: 1,
      actions: ['seerTarget'],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const { requestNightAction } = await import('@/lib/game/nightActions');
    await requestNightAction('game-1', { seerTarget: 'target-1' });

    expect(fetchMock).toHaveBeenCalledWith('/api/sync-night-action', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      gameId: 'game-1',
      uid: 'player-1',
      payload: { seerTarget: 'target-1' },
    });
  });

  it('rejects non-success responses instead of silently accepting the action', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Acción no permitida' }), { status: 403 }));

    const { requestNightAction } = await import('@/lib/game/nightActions');
    await expect(requestNightAction('game-1', { seerTarget: 'target-1' })).rejects.toThrow('Acción no permitida');
  });
});
