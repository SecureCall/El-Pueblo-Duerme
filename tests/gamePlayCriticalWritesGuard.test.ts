import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('GamePlay critical write guard', () => {
  it('does not directly write narrator broadcasts to the game document', () => {
    expect(source).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"][\s\S]{0,800}narratorBroadcast/);
  });
});
