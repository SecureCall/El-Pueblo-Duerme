import { describe, expect, it } from 'vitest';
import { canUseRoleAtRound, getRoleAuthorityRule } from '@/lib/game/roleAuthority';

describe('role authority', () => {
  it('allows doctor self-targeting', () => {
    expect(getRoleAuthorityRule('Doctor')).toMatchObject({ maxTargets: 1, allowSelfTarget: true });
  });

  it('limits Cupido to two targets on first night', () => {
    expect(getRoleAuthorityRule('Cupido')).toMatchObject({ maxTargets: 2, firstNightOnly: true });
    expect(canUseRoleAtRound('Cupido', 1)).toBe(true);
    expect(canUseRoleAtRound('Cupido', 2)).toBe(false);
  });

  it('limits first-night roles', () => {
    expect(canUseRoleAtRound('Ladrón', 1)).toBe(true);
    expect(canUseRoleAtRound('Ladrón', 2)).toBe(false);
  });

  it('enforces every-other-round roles', () => {
    expect(canUseRoleAtRound('Lobo Blanco', 2)).toBe(true);
    expect(canUseRoleAtRound('Lobo Blanco', 3)).toBe(false);
  });

  it('rejects non-night roles', () => {
    expect(getRoleAuthorityRule('Aldeano')).toBeNull();
    expect(canUseRoleAtRound('Aldeano', 1)).toBe(false);
  });
});
