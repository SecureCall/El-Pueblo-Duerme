import { getSdks } from '@/lib/server/firebase-admin';

export interface NightRoleSnapshot {
  rolesByUid: Record<string, string>;
}

/** Reads private role documents with Admin SDK; never accepts roles from the client. */
export async function readNightRoleSnapshot(gameId: string, playerUids: string[]): Promise<NightRoleSnapshot> {
  const { db } = getSdks();
  const uniqueUids = [...new Set(playerUids.filter((uid) => typeof uid === 'string' && uid.length > 0))];
  const rolesByUid: Record<string, string> = {};

  const refs = uniqueUids.map((uid) => db.collection('games').doc(gameId).collection('playerRoles').doc(uid));
  const docs = refs.length > 0 ? await db.getAll(...refs) : [];

  for (const doc of docs) {
    if (!doc.exists) continue;
    const data = doc.data() as Record<string, unknown>;
    const role = typeof data.role === 'string'
      ? data.role
      : typeof data.rol === 'string' ? data.rol : null;
    if (role && role.length > 0) rolesByUid[doc.id] = role;
  }

  const missingUids = uniqueUids.filter((uid) => !rolesByUid[uid]);
  if (missingUids.length > 0) {
    // Never resolve a night with a partial role snapshot. A partial snapshot
    // could silently turn a missing role into a villager and produce an
    // irreversible, incorrect game state.
    throw new Error(`night_role_snapshot_incomplete:${missingUids.join(',')}`);
  }

  return { rolesByUid };
}