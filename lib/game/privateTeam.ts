import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Private team membership for the current game.
 * This is intentionally stored outside games/{gameId}, so the public game
 * document never needs to expose the wolf roster.
 */
export async function getPrivateTeam(gameId: string, uid: string): Promise<'wolves' | 'village' | null> {
  if (!gameId || !uid) return null;
  const snap = await getDoc(doc(db, 'games', gameId, 'privateTeams', uid));
  if (!snap.exists()) return null;
  const team = snap.data()?.team;
  return team === 'wolves' || team === 'village' ? team : null;
}

/**
 * Writes private team membership. Call this only from the trusted game setup
 * path (currently the host path); Firestore rules remain the final authority.
 */
export async function setPrivateTeam(
  gameId: string,
  uid: string,
  team: 'wolves' | 'village',
): Promise<void> {
  if (!gameId || !uid) throw new Error('gameId and uid are required');
  await setDoc(doc(db, 'games', gameId, 'privateTeams', uid), {
    team,
    updatedAt: Date.now(),
  });
}
