import { describe, expect, it } from 'vitest';
import { validateNightAction } from '@/lib/game/nightActionValidation';

const players = [
  { uid: 'a', isAlive: true },
  { uid: 'b', isAlive: true },
  { uid: 'dead', isAlive: false },
];

describe('validateNightAction', () => {
  it('rejects actions outside night', () => {
    expect(validateNightAction({ phase: 'day', round: 1, actor: players[0], targetIds: ['b'], players })).toEqual({ ok: false, code: 'INVALID_PHASE' });
  });

  it('rejects dead actors', () => {
    expect(validateNightAction({ phase: 'night', round: 1, actor: players[2], targetIds: ['b'], players })).toEqual({ ok: false, code: 'ACTOR_DEAD' });
  });

  it('rejects missing and dead targets', () => {
    expect(validateNightAction({ phase: 'night', round: 1, actor: players[0], targetIds: ['missing'], players })).toEqual({ ok: false, code: 'TARGET_NOT_FOUND' });
    expect(validateNightAction({ phase: 'night', round: 1, actor: players[0], targetIds: ['dead'], players })).toEqual({ ok: false, code: 'TARGET_DEAD' });
  });

  it('rejects self-targeting by default', () => {
    expect(validateNightAction({ phase: 'night', round: 1, actor: players[0], targetIds: ['a'], players })).toEqual({ ok: false, code: 'SELF_TARGET' });
  });

  it('rejects duplicate and excessive targets', () => {
    expect(validateNightAction({ phase: 'night', round: 1, actor: players[0], targetIds: ['b', 'b'], players })).toEqual({ ok: false, code: 'DUPLICATE_TARGET' });
    expect(validateNightAction({ phase: 'night', round: 1, actor: players[0], targetIds: ['b', 'b', 'b'], players, maxTargets: 2 })).not.toEqual({ ok: true });
  });

  it('accepts a valid target', () => {
    expect(validateNightAction({ phase: 'night', round: 1, actor: players[0], targetIds: ['b'], players })).toEqual({ ok: true });
  });
});
