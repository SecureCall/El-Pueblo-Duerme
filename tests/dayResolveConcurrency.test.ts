import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');
const voteRoute = readFileSync(resolve(process.cwd(), 'app/api/day-vote/route.ts'), 'utf8');

describe('day resolution concurrency guards', () => {
  it('uses an expiring lease and verifies ownership before commit', () => {
    expect(route).toContain('const LEASE_MS=30_000');
    expect(route).toContain("l.ownerUid!==token||l.leaseId!==leaseId");
    expect(route).toContain("if(l.expiresAt<=now)throw Error('LEASE_EXPIRED')");
  });

  it('revalidates round, phase, host and player set before applying the result', () => {
    expect(route).toContain("Number(current.roundNumber??1)!==submitted");
    expect(route).toContain("current.phase!=='day'&&current.phase!=='voting'");
    expect(route).toContain('current.hostUid!==token');
    expect(route).toContain("throw Error('PLAYER_SET_CHANGED')");
  });

  it('prevents vote mutations while day resolution holds the active lock', () => {
    expect(voteRoute).toContain("lockSnap.exists");
    expect(voteRoute).toContain("throw new Error('RESOLUTION_LOCKED')");
  });

  it('deletes the resolution lock atomically with the committed state', () => {
    expect(route).toContain('tx.update(gr,patch)');
    expect(route).toContain('tx.delete(lr)');
  });

  it('does not trust a client-provided role when rebuilding player state', () => {
    expect(route).toContain('readNightRoleSnapshot(gameId,uids)');
    expect(route).toContain('snapshot.rolesByUid');
  });
});
