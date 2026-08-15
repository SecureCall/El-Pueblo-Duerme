import { describe, expect, it } from 'vitest';
import { calculateWolfCount, validateCreateGameRoles } from './createGameValidation';

describe('game creation validation', () => {
  it('rejects duplicate roles', () => {
    expect(validateCreateGameRoles(['Vidente', 'Vidente'], 'normal')).toContain('duplicados');
  });

  it('rejects unknown roles', () => {
    expect(validateCreateGameRoles(['RolInventado'], 'normal')).toContain('no válidos');
  });

  it('rejects non-casual roles in casual mode', () => {
    expect(validateCreateGameRoles(['Vidente', 'Vampiro'], 'casual')).toContain('Casual');
  });

  it('accepts valid normal roles', () => {
    expect(validateCreateGameRoles(['Vidente', 'Doctor'], 'normal')).toBeNull();
  });

  it('calculates wolves server-side deterministically', () => {
    expect(calculateWolfCount(4)).toBe(1);
    expect(calculateWolfCount(10)).toBe(2);
    expect(calculateWolfCount(20)).toBe(4);
  });
});
