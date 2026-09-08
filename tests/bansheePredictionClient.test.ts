import { describe, expect, it, vi, beforeEach } from 'vitest';

const getIdToken = vi.fn().mockResolvedValue('token');
const currentUser = { getIdToken };

vi.mock('@/lib/firebase/config', () => ({
  auth: { get currentUser() { return currentUser; } },
}));

describe('Banshee prediction client action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends authenticated server request with game, target and round', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      round: 3,
      targetUid: 'player-2',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { requestBansheePrediction } = await import('@/lib/game/bansheePrediction');
    await requestBansheePrediction('game-1', 'player-2', 3);

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/banshee-prediction', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      },
    }));

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      gameId: 'game-1',
      targetUid: 'player-2',
      round: 3,
    });
  });

  it('rejects malformed server responses', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { requestBansheePrediction } = await import('@/lib/game/bansheePrediction');
    await expect(requestBansheePrediction('game-1', 'player-2', 1)).rejects.toThrow('Respuesta inválida');
  });
});
