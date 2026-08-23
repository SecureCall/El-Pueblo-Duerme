import { getSdks } from '@/lib/server/firebase-admin';

export interface NightRoleSnapshot {
  rolesByUid: Record<string, string>;
}

/** Reads private role documents with Admin SDK; never accepts roles from the client. */
export async function readNightRoleSnapshot(gameId: string, playerUids: string[]): Promise<NightRoleSnapshot> {
  const { db } = getSdks();
  const rolesByUid: Record<string, string> = {};

  const refs = playerUids.map((uid) => db.collection('games').doc(gameId).collection('playerRoles').doc(uid));
  const docs = refs.length > 0 ? await db.getAll(...refs) : [];

  for (const doc of docs) {
    if (!doc.exists) continue;
    const data = doc.data() as Record<string, unknown>;
    if (typeof data.role === 'string' && data.role.length > 0) {
      rolesByUid[doc.id] = data.role;
    }
  }

  return { rolesByUid };
}
