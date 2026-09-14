import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const nightRoute = readFileSync(resolve(process.cwd(), 'app/api/resolve-night/route.ts'), 'utf8');
const dayRoute = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');

describe('authoritative chaos event lifecycle guard', () => {
  it('generates the event only from the authoritative night commit path', () => {
    expect(nightRoute).toMatch(/drawChaosEvent\(\)/);
    expect(nightRoute).toMatch(/currentEvent:\s*chaosEvent/);
    expect(nightRoute).toMatch(/eventRound:\s*chaosEvent \? roundNumber : null/);
  });

  it('does not let day resolution invent a second event', () => {
    expect(dayRoute).not.toMatch(/drawChaosEvent\(/);
  });

  it('carries only a server-classified night event into the next round', () => {
    expect(dayRoute).toMatch(/chaosEventAppliesToPhase\(currentEvent, 'night'\)/);
    expect(dayRoute).toMatch(/currentEvent:\s*nextNightEvent/);
    expect(dayRoute).toMatch(/eventRound:\s*nextNightEvent \? Number\(result\.roundNumber\) \+ 1 : null/);
  });

  it('never trusts a client patch for event state', () => {
    expect(dayRoute).toMatch(/currentEvent:\s*nextNightEvent/);
    expect(dayRoute).not.toMatch(/currentEvent:\s*result\.statePatch\.currentEvent/);
    expect(dayRoute).not.toMatch(/eventRound:\s*result\.statePatch\.eventRound/);
  });
});
