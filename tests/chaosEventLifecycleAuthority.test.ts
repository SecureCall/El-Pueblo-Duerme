import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const nightRoute = readFileSync(resolve(process.cwd(), 'app/api/resolve-night/route.ts'), 'utf8');
const dayRoute = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');
const roleSwapModule = readFileSync(resolve(process.cwd(), 'lib/server/roleSwap.ts'), 'utf8');

describe('authoritative chaos event lifecycle guard', () => {
  it('generates the event only from the authoritative night commit path', () => {
    expect(nightRoute).toMatch(/drawChaosEvent\(\)/);
    expect(nightRoute).toMatch(/currentEvent:\s*chaosEvent/);
    expect(nightRoute).toMatch(/eventRound:\s*chaosEvent \? roundNumber : null/);
  });

  it('does not return private night resolution roles to the caller', () => {
    expect(nightRoute).toMatch(/Do not serialize the authoritative result/);
    expect(nightRoute).toMatch(/return NextResponse\.json\(\{ ok: true, gameId \}\)/);
    expect(nightRoute).not.toMatch(/return NextResponse\.json\(\{ ok: true, gameId, result/);
  });

  it('applies a day roleSwap before entering the day and keeps public player data role-free', () => {
    expect(nightRoute).toMatch(/chaosEvent\?\.phase === 'day' && chaosEvent\.mechanical === 'roleSwap'/);
    expect(nightRoute).toMatch(/applyRoleSwap\(/);
    expect(nightRoute).toMatch(/playerRoles'\)\.doc\(uid\)/);
    expect(nightRoute).toMatch(/const publicPlayers = patch\.players\.map\(\(\{ role: _privateRole, \.\.\.player \}\) => player\)/);
    expect(roleSwapModule).toContain('role_swap_snapshot_incomplete');
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
