/**
 * Background Sync helpers.
 *
 * Authenticated game mutations must be replayed by the page, not by the
 * service worker: Firebase ID tokens are user/session credentials and the
 * service worker cannot safely obtain a fresh token for an arbitrary user.
 *
 * Items are kept in IndexedDB while offline and flushed from the page when
 * connectivity returns. Every replay obtains a fresh Firebase ID token.
 */

import { auth } from '@/lib/firebase/config';

const DB_NAME = 'elpueblo-sync';
const DB_VERSION = 1;
const STORES = ['pending-votes', 'pending-night-actions'] as const;
type StoreName = (typeof STORES)[number];

type QueuedItem = Record<string, unknown> & { id: string };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store: StoreName, item: QueuedItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(store: StoreName): Promise<QueuedItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as QueuedItem[]);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(store: StoreName, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type PendingVote = {
  id: string;
  gameId: string;
  uid: string;
  target: string;
  round: number;
  submittedAt: number;
};

export type PendingNightAction = {
  id: string;
  gameId: string;
  uid: string;
  role: string;
  payload: Record<string, unknown>;
  submittedAt: number;
};

async function authenticatedPost(path: string, body: unknown): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Flushes queued authenticated mutations from the page using a fresh token. */
export async function flushPendingMutations(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine || !auth.currentUser) return;

  const [votes, nightActions] = await Promise.all([
    idbGetAll('pending-votes'),
    idbGetAll('pending-night-actions'),
  ]);

  for (const vote of votes) {
    if (await authenticatedPost('/api/sync-vote', vote)) {
      await idbDelete('pending-votes', vote.id);
    }
  }

  for (const action of nightActions) {
    if (await authenticatedPost('/api/sync-night-action', action)) {
      await idbDelete('pending-night-actions', action.id);
    }
  }
}

/**
 * Queue a vote. Online submissions are authenticated immediately; offline
 * submissions remain in IndexedDB until the page regains connectivity.
 */
export async function queueVote(vote: PendingVote): Promise<void> {
  if (navigator.onLine && await authenticatedPost('/api/sync-vote', vote)) return;
  await idbPut('pending-votes', vote);
}

/** Queue a night action for authenticated page-side replay. */
export async function queueNightAction(action: PendingNightAction): Promise<void> {
  if (navigator.onLine && await authenticatedPost('/api/sync-night-action', action)) return;
  await idbPut('pending-night-actions', action);
}

// Register the page-side connectivity handler only in the browser.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushPendingMutations();
  });
}
