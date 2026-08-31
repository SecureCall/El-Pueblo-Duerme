import type { Firestore } from 'firebase-admin/firestore';

export interface NightResolutionLockResult {
  acquired: boolean;
  reason?: 'already_resolving' | 'already_resolved';
  leaseId?: string;
}

// Five-minute lease plus heartbeat. A live resolver renews ownership, so it
// cannot be replaced merely because the resolution takes longer than a minute.
const RESOLUTION_LEASE_MS = 5 * 60_000;

function lockRef(db: Firestore, gameId: string, roundNumber: number) {
  return db.collection('games').doc(gameId).collection('nightResolutions').doc(String(roundNumber));
}

export async function claimNightResolution(db: Firestore, gameId: string, roundNumber: number): Promise<NightResolutionLockResult> {
  const ref = lockRef(db, gameId, roundNumber);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) {
      const data = snapshot.data() as Record<string, unknown>;
      if (data.status === 'resolved') return { acquired: false, reason: 'already_resolved' };
      const expiresAt = data.expiresAt;
      const expiresMillis = expiresAt && typeof (expiresAt as { toMillis?: unknown }).toMillis === 'function'
        ? (expiresAt as { toMillis: () => number }).toMillis() : 0;
      if (expiresMillis > Date.now()) return { acquired: false, reason: 'already_resolving' };
      const leaseId = crypto.randomUUID();
      const now = new Date();
      tx.update(ref, { status: 'resolving', leaseId, startedAt: now, expiresAt: new Date(now.getTime() + RESOLUTION_LEASE_MS), reclaimedAt: now });
      return { acquired: true, leaseId };
    }
    const leaseId = crypto.randomUUID();
    const now = new Date();
    tx.create(ref, { status: 'resolving', roundNumber, leaseId, startedAt: now, expiresAt: new Date(now.getTime() + RESOLUTION_LEASE_MS) });
    return { acquired: true, leaseId };
  });
}

export async function renewNightResolution(db: Firestore, gameId: string, roundNumber: number, leaseId: string): Promise<boolean> {
  const ref = lockRef(db, gameId, roundNumber);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;
    const data = snapshot.data() as Record<string, unknown>;
    if (data.status !== 'resolving' || data.leaseId !== leaseId) return false;
    const now = new Date();
    tx.update(ref, { expiresAt: new Date(now.getTime() + RESOLUTION_LEASE_MS), renewedAt: now });
    return true;
  });
}

export async function markNightResolutionResolved(db: Firestore, gameId: string, roundNumber: number, leaseId: string): Promise<boolean> {
  const ref = lockRef(db, gameId, roundNumber);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;
    const data = snapshot.data() as Record<string, unknown>;
    if (data.status !== 'resolving' || data.leaseId !== leaseId) return false;
    tx.update(ref, { status: 'resolved', resolvedAt: new Date(), expiresAt: null });
    return true;
  });
}

export async function releaseNightResolution(db: Firestore, gameId: string, roundNumber: number, leaseId: string): Promise<boolean> {
  const ref = lockRef(db, gameId, roundNumber);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;
    const data = snapshot.data() as Record<string, unknown>;
    if (data.status !== 'resolving' || data.leaseId !== leaseId) return false;
    tx.delete(ref);
    return true;
  });
}
