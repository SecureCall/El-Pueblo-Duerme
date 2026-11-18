import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('public game secret write guards', () => {
  it('does not persist roles or wolfTeam in resolve-night public game update', () => {
    const source = read('app/api/resolve-night/route.ts');
    expect(source).toContain('roles: FieldValue.delete()');
    expect(source).toContain('wolfTeam: FieldValue.delete()');
    expect(source).not.toMatch(/roles:\s*patch\.roles/);
    expect(source).not.toMatch(/wolfTeam:\s*patch\.wolfTeam/);
    expect(source).toContain("collection('playerRoles').doc(uid)");
  });

  it('does not persist roles or wolfTeam in day resolution public state', () => {
    const source = read('app/api/day-resolve/route.ts');
    expect(source).toContain('result.statePatch.roles');
    expect(source).toMatch(/Object\.entries\(result\.statePatch\)\.filter\(\(\[key\]\)\s*=>/);
    expect(source).toMatch(/!\[['"]roles['"],\s*['"]wolfTeam['"],\s*['"]nightActions['"],\s*['"]nightSubmissions['"]\]\.includes\(key\)/);
    expect(source).toMatch(/const sanitizedPlayers = result\.statePatch\.players\.map/);
    expect(source).toMatch(/key !== ['"]role['"]/);
    expect(source).toContain("tx.set(gr.collection('playerRoles').doc(uid)");
  });

  it('removes legacy public role maps when starting or resolving legacy games', () => {
    const start = read('app/api/game-start/route.ts');
    const night = read('app/api/resolve-night/route.ts');
    const day = read('app/api/day-resolve/route.ts');

    for (const source of [start, night, day]) {
      expect(source).toContain('roles: FieldValue.delete()');
      expect(source).toContain('wolfTeam: FieldValue.delete()');
    }
  });
});
