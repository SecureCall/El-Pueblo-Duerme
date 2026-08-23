import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import type { NightActionSubmission, NightPlayerForValidation } from '@/lib/game/nightResolution';

export interface ServerNightSubmission {
  actorUid: string;
  role: string;
  actions: NightActionSubmission[];
  submittedAt?: number;
  syncedAt?: number;
  [key: string]: unknown;
}

function normalizeStoredActions(value: unknown, actorUid: string): NightActionSubmission[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): NightActionSubmission[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    if (raw.actorUid !== actorUid || typeof raw.action !== 'string') return [];

    const submission: NightActionSubmission = {
      actorUid,
      action: raw.action,
    };

    if (typeof raw.targetUid === 'string') submission.targetUid = raw.targetUid;
    if (Array.isArray(raw.targetUids)) {
      submission.targetUids = raw.targetUids.filter(
        (uid): uid is string => typeof uid === 'string' && uid.length > 0,
      );
    }
    if (
      typeof raw.value === 'string' ||
      typeof raw.value === 'boolean' ||
      typeof raw.value === 'number' ||
      raw.value === null
    ) {
      submission.value = raw.value;
    }

    return [submission];
  });
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

      return {
        ...data,
        actorUid,
        role,
        actions: normalizeStoredActions(data.actions, actorUid),
      };
    })
    .filter((submission) => Boolean(submission.actorUid && submission.role && submission.actions.length));
}

/**
 * Converts the stored submissions into the shape consumed by the resolver.
 * The caller must still perform the complete game-specific resolution.
 */
export function flattenNightSubmissions(
  submissions: ServerNightSubmission[],
): NightActionSubmission[] {
  return submissions.flatMap((submission) => submission.actions);
}

/**
 * Returns the minimal player representation needed for server-side validation.
 */
export function toNightValidationPlayers(
  players: unknown,
): NightPlayerForValidation[] {
  if (!Array.isArray(players)) return [];
  return players.flatMap((player): NightPlayerForValidation[] => {
    if (!player || typeof player !== 'object' || Array.isArray(player)) return [];
    const raw = player as Record<string, unknown>;
    if (typeof raw.uid !== 'string') return [];
    return [{ uid: raw.uid, isAlive: raw.isAlive === true }];
  });
}
