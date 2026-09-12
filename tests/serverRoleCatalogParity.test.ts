import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const uiRoles = readFileSync(resolve(process.cwd(), 'components/game/play/roles.ts'), 'utf8');
const serverRoles = readFileSync(resolve(process.cwd(), 'lib/server/roleCatalog.ts'), 'utf8');

function parseUiRoles(source: string): Map<string, string> {
  const result = new Map<string, string>();
  const re = /'([^']+)'\s*:\s*\{\s*name:\s*'[^']+'\s*,\s*team:\s*'(village|wolves|solo)'/g;
  for (const match of source.matchAll(re)) result.set(match[1], match[2]);
  return result;
}

function parseServerRoles(source: string): Map<string, string> {
  const result = new Map<string, string>();
  const re = /'([^']+)'\s*:\s*\{\s*team:\s*'(village|wolves|solo)'\s*\}/g;
  for (const match of source.matchAll(re)) result.set(match[1], match[2]);
  return result;
}

describe('server role catalog parity', () => {
  it('contains every gameplay role from the UI catalog', () => {
    const ui = parseUiRoles(uiRoles);
    const server = parseServerRoles(serverRoles);
    expect([...server.keys()].sort()).toEqual([...ui.keys()].sort());
  });

  it('preserves the gameplay team classification for every role', () => {
    const ui = parseUiRoles(uiRoles);
    const server = parseServerRoles(serverRoles);
    for (const [role, team] of ui) {
      expect(server.get(role), `missing server role: ${role}`).toBe(team);
    }
  });
});
