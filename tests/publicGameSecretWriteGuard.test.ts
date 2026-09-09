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

  it('does not persist roles or wolfTeam in day resolution public state', () => {
    const source = read('app/api/day-resolve/route.ts');
    expect(source).toContain('result.statePatch.roles');
    expect(source).toContain('const { roles: _privateRoles, wolfTeam: _privateWolfTeam, players: resolvedPlayers');
    expect(source).not.toMatch(/tx\.update\(gr,\s*patch\);[\s\S]{0,300}\bwolfTeam\s*:/);
    expect(source).toContain('const sanitizedPlayers = resolvedPlayers.map(({ role: _privateRole, ...player }) => player);');
    expect(source).toContain("tx.set(gr.collection('playerRoles').doc(uid)");
  });
});
