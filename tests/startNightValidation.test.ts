import { describe, expect, it } from 'vitest';
import { validateRoleSnapshot } from '@/lib/server/startNightValidation';

describe('validateRoleSnapshot', () => {
  const players = [{ uid: 'a' }, { uid: 'b', isAI: true }];

  it('accepts a complete matching public/private role snapshot', () => {
    expect(validateRoleSnapshot({
      players,
      publicRoles: { a: 'Vidente', b: 'Lobo' },
      privateRoles: { a: 'Vidente', b: 'Lobo' },
    })).toBe(true);
  });

  it('rejects a missing private role', () => {
    expect(validateRoleSnapshot({
      players,
      publicRoles: { a: 'Vidente', b: 'Lobo' },
      privateRoles: { a: 'Vidente' },
    })).toBe(false);
  });

  it('rejects public/private role divergence', () => {
    expect(validateRoleSnapshot({
      players,
      publicRoles: { a: 'Vidente', b: 'Lobo' },
      privateRoles: { a: 'Lobo', b: 'Lobo' },
    })).toBe(false);
  });

  it('rejects duplicate or missing player identities', () => {
    expect(validateRoleSnapshot({
      players: [{ uid: 'a' }, { uid: 'a' }],
      publicRoles: { a: 'Vidente' },
      privateRoles: { a: 'Vidente' },
    })).toBe(false);
  });

  it('rejects extra private roles not belonging to the game', () => {
    expect(validateRoleSnapshot({
      players,
      publicRoles: { a: 'Vidente', b: 'Lobo' },
      privateRoles: { a: 'Vidente', b: 'Lobo', attacker: 'Lobo' },
    })).toBe(false);
  });
});
