import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');
const voteRoute = readFileSync(resolve(process.cwd(), 'app/api/day-vote/route.ts'), 'utf8');

describe('day resolution concurrency guards', () => {
  it('uses an expiring lease and verifies ownership before commit', () => {
    expect(route).toMatch(/const LEASE_MS\s*=\s*30_000/);
    expect(route).toMatch(/l\.ownerUid\s*!==\s*actorUid\s*\|\|\s*l\.leaseId\s*!==\s*leaseId/);
    expect(route).toMatch(/if\s*\(l\.expiresAt\s*<=\s*now\)\s*throw Error\('LEASE_EXPIRED'\)/);
  });

  it('revalidates round, phase, host and player set before applying the result', () => {
    expect(route).toMatch(/Number\(current\.roundNumber\s*\?\?\s*1\)\s*!==\s*submitted/);
    expect(route).toMatch(/current\.phase\s*!==\s*'day'\s*&&\s*current\.phase\s*!==\s*'voting'/);
    expect(route).toMatch(/current\.hostUid\s*!==\s*actorUid/);
    expect(route).toContain("throw Error('PLAYER_SET_CHANGED')");
  });

  it('prevents vote mutations while day resolution holds the active lock', () => {
    expect(voteRoute).toContain('lockSnap.exists');
    expect(voteRoute).toContain("throw new Error('RESOLUTION_LOCKED')");
  });

  it('deletes the resolution lock atomically with the committed state', () => {
    expect(route).toMatch(/tx\.update\(gr,\s*patch\)/);
    expect(route).toContain('tx.delete(lr)');
  });

  it('rebuilds the result from private server roles instead of trusting client roles', () => {
    expect(route).toContain('readNightRoleSnapshot(gameId, uids)');
    expect(route).toContain('snapshot.rolesByUid');
    expect(route).toContain('resolveDay(createDayResolutionInput(gameId, g, snapshot.rolesByUid');
  });

  it('never applies a client-supplied patch to the authoritative game state', () => {
    expect(route).not.toMatch(/\bb\.patch\b|\bbody\.patch\b|\bsubmittedPatch\b/);
    expect(route).toMatch(/const result = resolveDay\(/);
    expect(route).toMatch(/const patch = \{[\s\S]*?\.\.\.publicPatch/);
  });
});
