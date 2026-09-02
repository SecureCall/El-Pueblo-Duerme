import { describe, expect, it } from 'vitest';
import { canonicalizeWolfTeam } from '@/lib/server/wolfTeam';

describe('canonicalizeWolfTeam', () => {
  it('never persists non-wolf roles as wolf team members', () => {
    expect(
      canonicalizeWolfTeam(
        {
          wolf: 'Lobo',
          whiteWolf: 'Lobo Blanco',
          cub: 'Cría de Lobo',
          witch: 'Bruja',
          villager: 'Aldeano',
        },
        { witch: true, villager: true, wolf: true },
      ),
    ).toEqual({
      wolf: true,
      whiteWolf: true,
      cub: true,
    });
  });

  it('rebuilds membership when a dynamic role becomes a wolf', () => {
    expect(
      canonicalizeWolfTeam(
        { changed: 'Lobo', villager: 'Aldeano' },
        { changed: true },
      ),
    ).toEqual({ changed: true });
  });
});
