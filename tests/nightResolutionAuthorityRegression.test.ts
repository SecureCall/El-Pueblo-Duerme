import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');
const resolveNight = readFileSync(resolve(repoRoot, 'app/api/resolve-night/route.ts'), 'utf8');
const syncNight = readFileSync(resolve(repoRoot, 'app/api/sync-night-action/route.ts'), 'utf8');

describe('night resolution authority regressions', () => {
  it('does not allow an alive caller to resolve before every alive player submitted or the deadline', () => {
    expect(resolveNight).toContain("if (!caller || caller.isAlive !== true)");
    expect(resolveNight).toContain("const complete = aliveUids.length > 0 &&");
    expect(resolveNight).toContain('const submittedUids = new Set');
    expect(resolveNight).toContain('const deadlineReached = phaseEndsAt !== null && Date.now() >= phaseEndsAt;');
    expect(resolveNight).toContain('if (!complete && !deadlineReached)');
  });

  it('uses the private role snapshot as the final role authority', () => {
    expect(resolveNight).toContain('const roleSnapshot = await readNightRoleSnapshot');
    expect(resolveNight).toContain('const roleTampering = groupedSubmissions.find');
    expect(resolveNight).toContain('night_submission_role_mismatch');
    expect(resolveNight).toContain('resolveNightActions(input, roleSnapshot)');
  });

  it('fences submissions once the current round is resolving or resolved', () => {
    expect(syncNight).toContain("const resolutionLockRef = gameRef.collection('nightResolutions').doc(String(roundNumber));");
    expect(syncNight).toContain('const [existing, resolutionLock] = await Promise.all');
    expect(syncNight).toContain("lockData.status === 'resolving' || lockData.status === 'resolved'");
    expect(syncNight).toContain("throw new Error('night_resolution_in_progress')");
    expect(syncNight).toContain("status: 409");
  });

  it('keeps the lease fencing and expiry check at the final atomic commit', () => {
    expect(resolveNight).toContain("lockData.status !== 'resolving' || lockData.leaseId !== claimedLeaseId");
    expect(resolveNight).toContain("leaseExpiresMillis(lockData.expiresAt) <= Date.now()");
    expect(resolveNight).toContain("tx.update(lockSnap.ref, { status: 'resolved'");
  });
});
