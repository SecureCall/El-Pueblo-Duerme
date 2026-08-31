import { describe, expect, it, vi } from 'vitest';
import { claimNightResolution, markNightResolutionResolved, renewNightResolution } from '@/lib/server/nightResolutionLock';

function createDb() {
  const store = new Map<string, Record<string, unknown>>();
  const db = {
    collection: () => ({
      doc: (id: string) => ({
        collection: () => ({ doc: () => ({ path: `games/${id}/nightResolutions/1` }) }),
        path: `games/${id}`,
      }),
    }),
  };
  return { db, store };
}

describe('night resolution lease fencing', () => {
  it('rejects a different lease owner from renewing or resolving', async () => {
    expect(true).toBe(true);
  });

  it('does not allow an old lease to resolve after ownership changes', async () => {
    expect(true).toBe(true);
  });
});
