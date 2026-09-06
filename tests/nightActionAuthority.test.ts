import { describe, expect, it } from 'vitest';
import { validateCanonicalNightAction, validateCanonicalNightSubmissions } from '@/lib/game/nightActionAuthority';

const players = [
  { uid: 'wolf', isAlive: true },
  { uid: 'seer', isAlive: true },
  { uid: 'villager', isAlive: true },
  { uid: 'dead', isAlive: false },
];

describe('canonical night action authority', () => {
  it('rejects unknown action keys instead of silently dropping them', () => {
    const result = validateCanonicalNightAction({
      players,
      actorUid: 'wolf',
      actorRole: 'Lobo',
      roundNumber: 1,
      payload: { exploit: 'villager' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('unknown_action:exploit');
  });

  it('rejects duplicate actions', () => {
    const result = validateCanonicalNightSubmissions(
      players,
      'wolf',
      'Lobo',
      1,
      [
        { actorUid: 'wolf', action: 'wolfTarget', targetUid: 'villager' },
        { actorUid: 'wolf', action: 'wolfTarget', targetUid: 'seer' },
      ],
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duplicate_action:wolfTarget');
  });

  it('requires exactly two targets for Cupido/Flautista multi-target actions', () => {
    const result = validateCanonicalNightAction({
      players,
      actorUid: 'seer',
      actorRole: 'Cupido',
      roundNumber: 1,
      payload: { cupidTargets: ['wolf'] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('exactly_two_targets:cupidTargets');
  });

  it('rejects duplicate targets in a multi-target action', () => {
    const result = validateCanonicalNightAction({
      players,
      actorUid: 'seer',
      actorRole: 'Cupido',
      roundNumber: 1,
      payload: { cupidTargets: ['wolf', 'wolf'] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duplicate_targets:cupidTargets');
  });

  it('allows dead targets only for roles whose action explicitly supports corpses', () => {
    const result = validateCanonicalNightAction({
      players: [...players, { uid: 'angel', isAlive: true }],
      actorUid: 'angel',
      actorRole: 'Ángel Resucitador',
      roundNumber: 2,
      payload: { angelResucitarTarget: 'dead' },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects Lobo Blanco cide on odd nights', () => {
    const result = validateCanonicalNightAction({
      players,
      actorUid: 'wolf',
      actorRole: 'Lobo Blanco',
      roundNumber: 1,
      payload: { loboBlancoCide: 'villager' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('lobo_blanco_cide_only_even_nights');
  });

  it('accepts Lobo Blanco cide on an even night against a living wolf', () => {
    const result = validateCanonicalNightAction({
      players,
      actorUid: 'wolf',
      actorRole: 'Lobo Blanco',
      roundNumber: 2,
      payload: { loboBlancoCide: 'wolf' },
    });
    expect(result.valid).toBe(true);
  });

  it('does not allow _skip together with another action', () => {
    const result = validateCanonicalNightAction({
      players,
      actorUid: 'wolf',
      actorRole: 'Lobo',
      roundNumber: 1,
      payload: { _skip: true, wolfTarget: 'villager' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('skip_must_be_exclusive');
  });
});
