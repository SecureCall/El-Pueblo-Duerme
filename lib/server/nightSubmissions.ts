import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';

export interface ServerNightSubmission {
  actorUid: string;
  role: string;
  actions: string[];
  targetUid?: string | null;
  targetUids?: string[];
  submittedAt?: number;
  syncedAt?: number;
  [key: string]: unknown;
}

/**
 * Reads only the per-player submissions for a game using the Admin SDK.
 * This must stay server-side: clients never receive the full submission set.
 */
export async function readNightSubmissions(gameId: string): Promise<ServerNightSubmission[]> {
  if (!gameId) return [];

  initAdminApp();
  const db = getFirestore();
  const snapshot = await db
    .collection('games')
    .doc(gameId)
    .collection('nightSubmissions')
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const actorUid = typeof data.actorUid === 'string' ? data.actorUid : doc.id;
      const role = typeof data.role === 'string' ? data.role : '';
      const actions = Array.isArray(data.actions)
        ? data.actions.filter((value): value is string => typeof value === 'string')
        : [];

      return {
        ...data,
        actorUid,
        role,
        actions,
      };
    })
    .filter((submission) => Boolean(submission.actorUid && submission.role));
}
