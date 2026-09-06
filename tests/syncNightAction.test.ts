import { beforeEach, describe, expect, it, vi } from 'vitest';

const getIdToken = vi.fn();
let currentUser: { uid: string; getIdToken: typeof getIdToken } | null = {
  uid: 'player-1',
  getIdToken,
};

vi.mock('@/lib/firebase/config', () => ({
  auth: {
    get currentUser() {
      return currentUser;
    },
  },
}));

describe('syncNightAction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = { uid: 'player-1', getIdToken };
    getIdToken.mockResolvedValue('id-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  it('envía la acción autenticada al endpoint servidor', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      role: 'werewolf',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { syncNightAction } = await import('@/lib/game/syncNightAction');
    const payload = { action: 'kill', targetUid: 'player-2' };
    const result = await syncNightAction('game-1', 'player-1', payload);

    expect(result).toEqual({ ok: true, role: 'werewolf' });
    expect(fetch).toHaveBeenCalledWith('/api/sync-night-action', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer id-token' }),
      body: JSON.stringify({ gameId: 'game-1', uid: 'player-1', payload }),
    }));
  });

  it('rechaza un actor distinto del usuario autenticado', async () => {
    const { syncNightAction } = await import('@/lib/game/syncNightAction');
    await expect(syncNightAction('game-1', 'attacker', { action: 'kill' }))
      .rejects.toThrow('El usuario autenticado no coincide con el actor');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechaza cuando no existe sesión autenticada', async () => {
    currentUser = null;
    const { syncNightAction } = await import('@/lib/game/syncNightAction');
    await expect(syncNightAction('game-1', 'player-1', { action: 'kill' }))
      .rejects.toThrow('El usuario autenticado no coincide con el actor');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('propaga errores del endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Acción no permitida' }), { status: 403 }));

    const { syncNightAction } = await import('@/lib/game/syncNightAction');
    await expect(syncNightAction('game-1', 'player-1', { action: 'kill' }))
      .rejects.toThrow('Acción no permitida');
  });

  it('rechaza respuestas servidoras incompletas', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const { syncNightAction } = await import('@/lib/game/syncNightAction');
    await expect(syncNightAction('game-1', 'player-1', { action: 'kill' }))
      .rejects.toThrow('Respuesta inválida del servidor al sincronizar la acción nocturna');
  });
});
