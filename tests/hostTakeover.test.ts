import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGetIdToken = vi.fn();
const mockFetch = vi.fn();

vi.mock('@/lib/firebase/config', () => ({
  auth: {
    get currentUser() {
      return { uid: 'player-1', getIdToken: mockGetIdToken };
    },
  },
}));

describe('requestHostTakeover', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetIdToken.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('sends the authenticated game takeover request', async () => {
    mockGetIdToken.mockResolvedValue('id-token');
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, takenOver: true, hostUid: 'player-1' }), { status: 200 }));

    const { requestHostTakeover } = await import('@/lib/game/hostTakeover');
    await expect(requestHostTakeover('game-123')).resolves.toEqual({ ok: true, takenOver: true, hostUid: 'player-1' });

    expect(mockFetch).toHaveBeenCalledWith('/api/host-takeover', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      headers: expect.objectContaining({ Authorization: 'Bearer id-token' }),
      body: JSON.stringify({ gameId: 'game-123' }),
    }));
  });

  it('rejects an invalid server response', async () => {
    mockGetIdToken.mockResolvedValue('id-token');
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, takenOver: true }), { status: 200 }));

    const { requestHostTakeover } = await import('@/lib/game/hostTakeover');
    await expect(requestHostTakeover('game-123')).rejects.toThrow('Respuesta inválida del servidor al asumir el host');
  });

  it('surfaces the server error', async () => {
    mockGetIdToken.mockResolvedValue('id-token');
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'El host sigue activo' }), { status: 409 }));

    const { requestHostTakeover } = await import('@/lib/game/hostTakeover');
    await expect(requestHostTakeover('game-123')).rejects.toThrow('El host sigue activo');
  });
});
