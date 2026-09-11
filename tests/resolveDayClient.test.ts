import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'lib/game/resolveDay.ts'), 'utf8');

describe('authoritative day client helper', () => {
  it('only sends the game id to the server', () => {
    expect(source).toContain("body: JSON.stringify({ gameId })");
    expect(source).not.toContain('patch');
    expect(source).not.toContain('votes');
    expect(source).not.toContain('roles');
  });

  it('uses the authenticated Firebase token and rejects non-ok responses', () => {
    expect(source).toContain('await user.getIdToken()');
    expect(source).toContain('Authorization: `Bearer ${idToken}`');
    expect(source).toContain('if (!response.ok)');
    expect(source).toContain("data?.ok !== true");
  });
});
