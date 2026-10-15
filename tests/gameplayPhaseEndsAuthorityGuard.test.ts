import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/game/play/GamePlay.tsx'),
  'utf8',
);

describe('GamePlay phase deadline authority guard', () => {
  it('does not let the legacy client write phaseEndsAt into game state', () => {
    expect(source).not.toMatch(/\bphaseEndsAt\s*:\s*(?:finalWinner|Date\.now|game\.|[A-Za-z_$][\w$]*\()/);
  });
});
