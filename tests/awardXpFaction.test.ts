import { describe, expect, it } from 'vitest';
import { didPlayerWin } from '@/app/api/award-xp/route';

describe('award XP faction eligibility', () => {
  it('awards wolf-team victory XP to a Perro Lobo that chose wolves', () => {
    expect(
      didPlayerWin('wolves', 'Perro Lobo', 'dog', {
        perroLoboChoices: { dog: 'wolves' },
      }),
    ).toBe(true);
  });

  it('does not award wolf-team victory XP to a Perro Lobo that chose the village', () => {
    expect(
      didPlayerWin('wolves', 'Perro Lobo', 'dog', {
        perroLoboChoices: { dog: 'village' },
      }),
    ).toBe(false);
  });

  it('does not infer a wolf-team choice from a missing or malformed choice map', () => {
    expect(didPlayerWin('wolves', 'Perro Lobo', 'dog', {})).toBe(false);
    expect(
      didPlayerWin('wolves', 'Perro Lobo', 'dog', {
        perroLoboChoices: ['wolves'],
      }),
    ).toBe(false);
  });
});
