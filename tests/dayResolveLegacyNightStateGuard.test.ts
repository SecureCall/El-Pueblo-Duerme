import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');

describe('day-resolve public state guard', () => {
  it('strips legacy night state before updating the public game document', () => {
    expect(source).toMatch(/Object\.entries\(result\.statePatch\)\.filter\(\(\[key\]\)\s*=>/);
    expect(source).toMatch(/!\[['"]roles['"],\s*['"]wolfTeam['"],\s*['"]nightActions['"],\s*['"]nightSubmissions['"]\]\.includes\(key\)/);
    expect(source).toMatch(/const sanitizedPlayers = result\.statePatch\.players\.map/);
    expect(source).toMatch(/key !== ['"]role['"]/);
  });
});
