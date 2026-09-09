import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('GamePlay public-secret guard', () => {
  it('does not add a second client-side source of truth for private roles', () => {
    expect(source).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"][\s\S]{0,1000}(roles|wolfTeam)\s*:/);
  });
});
