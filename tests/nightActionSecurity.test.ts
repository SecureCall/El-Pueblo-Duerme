import { describe, expect, it } from 'vitest';
import {
  resolveAuthoritativeRole,
  validateNightActionPayload,
} from '@/lib/game/nightActionSecurity';

describe('night action security', () => {
  it('rejects arbitrary payload keys', () => {
    expect(validateNightActionPayload({ wolfTarget: 'player-2' })).toBe(true);
    expect(validateNightActionPayload({ roles: { hacked: 'Lobo' } })).toBe(false);
    expect(validateNightActionPayload({ phase: 'ended' })).toBe(false);
  });

  it('rejects nested executable/object payloads', () => {
    expect(validateNightActionPayload({ wolfTarget: { uid: 'player-2' } })).toBe(false);
    expect(validateNightActionPayload({ wolfTarget: ['player-2', 42] })).toBe(false);
    expect(validateNightActionPayload({ cupidTargets: ['p1', 'p2'] })).toBe(true);
  });

  it('prefers the private player role document', () => {
    expect(resolveAuthoritativeRole({ role: 'Vidente' }, { player1: 'Lobo' }, 'player1')).toBe('Vidente');
  });

  it('falls back to the server-controlled game role map during migration', () => {
    expect(resolveAuthoritativeRole(null, { player1: 'Lobo' }, 'player1')).toBe('Lobo');
  });

  it('returns no role when neither authority contains a valid role', () => {
    expect(resolveAuthoritativeRole({}, {}, 'player1')).toBeNull();
  });
});
