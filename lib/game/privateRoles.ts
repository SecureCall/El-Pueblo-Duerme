import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Reads the authenticated player's private role.
 * The Firestore rules restrict this document to the player (and host).
 */
export async function getPrivatePlayerRole(gameId: string, uid: string): Promise<string | null> {
  if (!gameId || !uid) return null;
  const snap = await getDoc(doc(db, 'games', gameId, 'playerRoles', uid));
  if (!snap.exists()) return null;
  const role = snap.data()?.role;
  return typeof role === 'string' ? role : null;
}
