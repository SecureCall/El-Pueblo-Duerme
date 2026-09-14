import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');

describe('day-resolve public state guard', () => {
  it('strips legacy night state before updating the public game document', () => {
    expect(source).toMatch(/nightActions:\s*_legacyNightActions/);
    expect(source).toMatch(/nightSubmissions:\s*_legacyNightSubmissions/);
    expect(source).toMatch(/roles:\s*_privateRoles/);
    expect(source).toMatch(/wolfTeam:\s*_privateWolfTeam/);
  });
});
