import { describe, expect, it } from 'vitest';
import { claimNightResolution, markNightResolutionResolved, renewNightResolution } from '@/lib/server/nightResolutionLock';

type Stored = Record<string, unknown>;
type Ref = { key: string };

function fakeFirestore() {
  const store = new Map<string, Stored>();
  const db = {
    collection: (_name: string) => ({
      doc: (gameId: string) => ({
        collection: (_sub: string) => ({ doc: (round: string): Ref => ({ key: `${gameId}/${round}` }) }),
      }),
    }),
    runTransaction: async <T>(work: (tx: any) => Promise<T>) => {
      const writes: Array<() => void> = [];
      const tx = {
        get: async (ref: Ref) => ({ exists: store.has(ref.key), data: () => store.get(ref.key) }),
        create: (ref: Ref, data: Stored) => writes.push(() => store.set(ref.key, { ...data })),
        update: (ref: Ref, data: Stored) => writes.push(() => store.set(ref.key, { ...store.get(ref.key), ...data })),
        delete: (ref: Ref) => writes.push(() => store.delete(ref.key)),
      };
      const result = await work(tx);
      writes.forEach((write) => write());
      return result;
    },
  } as unknown as Parameters<typeof claimNightResolution>[0];
  return { db, store };
}

describe('night resolution lease fencing', () => {
  it('allows the current owner to renew and resolve, but rejects another owner', async () => {
    const { db } = fakeFirestore();
    const first = await claimNightResolution(db, 'game-1', 1);
    expect(first.acquired).toBe(true);
    const owner = first.leaseId!;

    expect(await renewNightResolution(db, 'game-1', 1, owner)).toBe(true);
    expect(await renewNightResolution(db, 'game-1', 1, 'attacker')).toBe(false);
    expect(await markNightResolutionResolved(db, 'game-1', 1, 'attacker')).toBe(false);
    expect(await markNightResolutionResolved(db, 'game-1', 1, owner)).toBe(true);
  });

  it('rejects a stale owner after the lease is reclaimed', async () => {
    const { db, store } = fakeFirestore();
    const first = await claimNightResolution(db, 'game-2', 2);
    const oldLease = first.leaseId!;
    const key = 'game-2/2';
    store.get(key)!.expiresAt = { toMillis: () => Date.now() - 1 };

    const second = await claimNightResolution(db, 'game-2', 2);
    expect(second.acquired).toBe(true);
    expect(second.leaseId).not.toBe(oldLease);
    expect(await renewNightResolution(db, 'game-2', 2, oldLease)).toBe(false);
    expect(await markNightResolutionResolved(db, 'game-2', 2, oldLease)).toBe(false);
    expect(await markNightResolutionResolved(db, 'game-2', 2, second.leaseId!)).toBe(true);
  });
});
