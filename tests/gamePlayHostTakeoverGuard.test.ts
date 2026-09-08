import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('GamePlay host takeover authority guard', () => {
  it('routes automatic host takeover through the server helper', () => {
    expect(source).toContain("requestHostTakeover(gameId)");
    expect(source).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"][\s\S]{0,500}hostUid:\s*user\.uid[\s\S]{0,500}players:\s*newPlayers/);
  });
});
