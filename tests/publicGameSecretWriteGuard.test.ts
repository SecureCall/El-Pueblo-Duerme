import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('public game secret write guards', () => {
  it('does not persist roles or wolfTeam in resolve-night public game update', () => {
    const source = read('app/api/resolve-night/route.ts');
    expect(source).not.toMatch(/tx\.update\(gameRef,\s*\{[\s\S]*\broles\s*:/);
    expect(source).not.toMatch(/tx\.update\(gameRef,\s*\{[\s\S]*\bwolfTeam\s*:/);
    expect(source).toContain("collection('playerRoles').doc(uid)");
  });
});
