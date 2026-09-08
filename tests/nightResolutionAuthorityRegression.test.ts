import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');
const resolveNight = readFileSync(resolve(repoRoot, 'app/api/resolve-night/route.ts'), 'utf8');
const syncNight = readFileSync(resolve(repoRoot, 'app/api/sync-night-action/route.ts'), 'utf8');

describe('night resolution authority regressions', () => {
  it('does not allow a non-host to resolve before every alive player submitted', () => {
    expect(resolveNight).toContain("const isHost = game.hostUid === user.uid;");
    expect(resolveNight).toContain("if (!isHost && caller.isAlive !== true)");
    expect(resolveNight).toContain("if (!aliveUids.every((aliveUid) => submittedUids.has(aliveUid)))");
    expect(resolveNight).toContain("return NextResponse.json({ error: 'Night submissions are not complete' }, { status: 409 });");
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
