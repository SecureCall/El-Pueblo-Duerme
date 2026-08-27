/**
 * Background Sync helpers
 *
 * Votes are authenticated with the current Firebase ID token. The service
 * worker cannot read Firebase Auth state, so queued votes are authenticated
 * by asking an open app window for a fresh token when the sync event runs.
 */

import { auth } from '@/lib/firebase/config';

const DB_NAME = 'elpueblo-sync';
const DB_VERSION = 1;
const STORES = ['pending-votes', 'pending-night-actions'] as const;
type StoreName = (typeof STORES)[number];

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

async function registerSync(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (reg as any).sync.register(tag);
  } catch (e) {
    console.warn('[BackgroundSync] Could not register sync tag:', tag, e);
  }
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

async function sendVote(vote: PendingVote): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== vote.uid) {
    throw new Error('Usuario no autenticado para sincronizar el voto');
  }

  const idToken = await currentUser.getIdToken();
  return fetch('/api/sync-vote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ gameId: vote.gameId, target: vote.target }),
  });
}

/** Queue a vote for background sync. */
export async function queueVote(vote: PendingVote): Promise<void> {
  if (navigator.onLine) {
    try {
      const res = await sendVote(vote);
      if (res.ok) return;
      // Server validation errors are final (for example expired voting phase).
      // Only transport/server failures should remain queued.
      if (res.status >= 400 && res.status < 500 && res.status !== 401) {
        throw new Error(`Voto rechazado por el servidor (${res.status})`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Voto rechazado')) throw error;
    }
  }

  await idbPut('pending-votes', vote);
  await registerSync('sync-vote');
}

/** Queue a night action for background sync. */
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
