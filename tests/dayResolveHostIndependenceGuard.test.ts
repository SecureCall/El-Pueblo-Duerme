import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');

describe('day resolve host-independence guard', () => {
  it('does not grant the host an early claim bypass', () => {
    expect(route).not.toMatch(/if\s*\(.*hostUid\s*!==\s*actorUid.*\)\s*\{/s);
    expect(route).not.toMatch(/if\s*\(.*x\.hostUid\s*===\s*actorUid.*\)/s);
  });

  it('requires the same vote-completeness/deadline gate for every authenticated player resolver', () => {
    expect(route).toContain('INCOMPLETE_DAY');
    expect(route).toContain('deadlineReached');
    expect(route).toContain('authoritativeVotes');
    expect(route).toContain('eligible');
  });

  it('keeps the scheduler as the only trusted non-player resolver path', () => {
    expect(route).toContain("const SCHEDULER_OWNER = '__scheduler__';");
    expect(route).toContain('isAuthorizedServerRequest(req)');
    expect(route).toContain('actorUid = SCHEDULER_OWNER;');
  });
});
