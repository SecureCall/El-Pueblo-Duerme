import { beforeEach, describe, expect, it, vi } from 'vitest';

const getIdToken = vi.fn();

vi.mock('@/lib/firebase/config', () => ({
  auth: {
    get currentUser() {
      return { uid: 'host-1', getIdToken };
    },
  },
}));

describe('requestStartNight', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getIdToken.mockResolvedValue('id-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  it('envía el ID token y valida la respuesta del servidor', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      roundNumber: 1,
      nightStartedAt: 1000,
      phaseEndsAt: 61000,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { requestStartNight } = await import('@/lib/game/startNight');
    const result = await requestStartNight('game-1');

    expect(result).toEqual({
      ok: true,
      roundNumber: 1,
      nightStartedAt: 1000,
      phaseEndsAt: 61000,
    });
    expect(fetch).toHaveBeenCalledWith('/api/start-night', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer id-token' }),
      body: JSON.stringify({ gameId: 'game-1' }),
    }));
  });

  it('propaga errores del servidor', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Solo el anfitrión puede iniciar la noche' }), { status: 403 }));

    const { requestStartNight } = await import('@/lib/game/startNight');
    await expect(requestStartNight('game-1')).rejects.toThrow('Solo el anfitrión puede iniciar la noche');
  });

  it('rechaza una respuesta inválida', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, roundNumber: '1' }), { status: 200 }));

    const { requestStartNight } = await import('@/lib/game/startNight');
    await expect(requestStartNight('game-1')).rejects.toThrow('Respuesta inválida del servidor al iniciar la noche');
  });
});
