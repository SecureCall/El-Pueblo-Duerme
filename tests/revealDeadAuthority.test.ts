import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');

describe('reveal-dead authority guard', () => {
  it('resolves the revealed dead player only on the server', () => {
    expect(route).toMatch(/currentEvent\?\.mechanical === 'revealDead'/);
    expect(route).toMatch(/chooseRevealDead\(result\.statePatch\.eliminatedHistory, gameId, round\)/);
    expect(route).toMatch(/revealDeadResult,/);
  });

  it('does not use the client patch as the source of the revealed role', () => {
    expect(route).not.toMatch(/revealDeadResult:\s*result\.statePatch\.revealDeadResult/);
  });

  it('chooses deterministically from previously eliminated players', () => {
    expect(route).toMatch(/\(entry\.round \?\? 0\) < round/);
    expect(route).toMatch(/hash \^= char\.charCodeAt\(0\)/);
    expect(route).toMatch(/\(hash >>> 0\) % ordered\.length/);
  });
});
