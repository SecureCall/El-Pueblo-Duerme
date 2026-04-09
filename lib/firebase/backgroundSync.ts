/**
 * Background Sync helpers
 *
 * Usage:
 *   import { queueVote, queueNightAction } from '@/lib/firebase/backgroundSync';
 *
 * When offline, items are saved to IndexedDB and the SW retries them once
 * the connection is restored (via the 'sync' event).
 *
 * When online, items are sent directly without queuing.
 */

const DB_NAME = 'elpueblo-sync';
const DB_VERSION = 1;
const STORES = ['pending-votes', 'pending-night-actions'] as const;
type StoreName = (typeof STORES)[number];

// ─── IndexedDB ───────────────────────────────────────────────────────────────

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

async function idbPut(store: StoreName, item: Record<string, unknown>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Background Sync registration ────────────────────────────────────────────

async function registerSync(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (reg as any).sync.register(tag);
  } catch (e) {
    console.warn('[BackgroundSync] Could not register sync tag:', tag, e);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

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

/**
 * Queue a vote for background sync.
 * When online the action is attempted immediately; on failure it's queued.
 */
export async function queueVote(vote: PendingVote): Promise<void> {
  if (navigator.onLine) {
    try {
      const res = await fetch('/api/sync-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vote),
      });
      if (res.ok) return;
    } catch {
      // fall through to queue
    }
  }
  await idbPut('pending-votes', vote);
  await registerSync('sync-vote');
}

/**
 * Queue a night action for background sync.
 */
export async function queueNightAction(action: PendingNightAction): Promise<void> {
  if (navigator.onLine) {
    try {
      const res = await fetch('/api/sync-night-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (res.ok) return;
    } catch {
      // fall through to queue
    }
  }
  await idbPut('pending-night-actions', action);
  await registerSync('sync-night-action');
}
