import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export type PrivateTeam = 'wolves' | 'village';

/** Reads only one player's private team membership. */
export async function getPrivatePlayerTeam(gameId: string, uid: string): Promise<PrivateTeam | null> {
  if (!gameId || !uid) return null;
  const snap = await getDoc(doc(db, 'games', gameId, 'privateTeams', uid));
  if (!snap.exists()) return null;
  const team = snap.data()?.team;
  return team === 'wolves' || team === 'village' ? team : null;
}
