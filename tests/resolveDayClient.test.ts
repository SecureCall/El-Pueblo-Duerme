import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'lib/game/resolveDay.ts'), 'utf8');

describe('authoritative day client helper', () => {
  it('claims and commits using only server-owned identifiers', () => {
    expect(source).toContain("body: JSON.stringify({ gameId, action: 'claim' })");
    expect(source).toContain("body: JSON.stringify({ gameId, action: 'commit', leaseId, round })");
    expect(source).toContain("body: JSON.stringify({ gameId, action: 'release', leaseId })");
    expect(source).not.toContain('patch:');
    expect(source).not.toContain('votes:');
    expect(source).not.toContain('roles:');
    expect(source).not.toContain('players:');
    expect(source).not.toContain('winners:');
  });

  it('uses the authenticated Firebase token and rejects failed claim/commit responses', () => {
    expect(source).toContain('await user.getIdToken()');
    expect(source).toContain('Authorization: `Bearer ${idToken}`');
    expect(source).toContain('if (!claimResponse.ok');
    expect(source).toContain('if (!commitResponse.ok');
    expect(source).toContain("commitData?.committed !== true");
  });
});
