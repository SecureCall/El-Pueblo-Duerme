import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncNightAction } from '@/lib/game/syncNightAction';

describe('syncNightAction client contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the authenticated canonical request and returns the server role', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, role: 'Vidente' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      syncNightAction('game-1', 'user-1', { seerTarget: 'user-2' }),
    ).resolves.toEqual({ ok: true, role: 'Vidente' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sync-night-action');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      gameId: 'game-1',
      uid: 'user-1',
      payload: { seerTarget: 'user-2' },
    });
  });

  it('surfaces the server error message for rejected requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'La acción no es válida' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      syncNightAction('game-1', 'user-1', { seerTarget: 'user-2' }),
    ).rejects.toThrow('La acción no es válida');
  });

  it('rejects an invalid success response instead of trusting malformed data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      syncNightAction('game-1', 'user-1', { _skip: true }),
    ).rejects.toThrow('Respuesta inválida del servidor al sincronizar la acción nocturna');
  });

  it('fails before making a network request when identifiers are missing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(syncNightAction('', 'user-1', {})).rejects.toThrow('gameId y uid son obligatorios');
    await expect(syncNightAction('game-1', '', {})).rejects.toThrow('gameId y uid son obligatorios');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
