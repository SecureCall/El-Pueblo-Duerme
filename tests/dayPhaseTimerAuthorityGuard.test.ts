import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/game/play/DayPhase.tsx'),
  'utf8',
);

describe('DayPhase authoritative timer guard', () => {
  it('reads the server-owned phaseEndsAt deadline', () => {
    expect(source).toContain('game.phaseEndsAt');
  });

  it('does not calculate the authoritative deadline from dayStartedAt', () => {
    expect(source).not.toMatch(/const\s+startedAt\s*=\s*game\.dayStartedAt/);
    expect(source).not.toMatch(/dayDurationRef\.current\s*=\s*mech\s*===\s*['\"]extraTime['\"]/);
  });
});
