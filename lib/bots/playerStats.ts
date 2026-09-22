import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

export interface GameHistoryEntry {
  won: boolean;
  role: string;
  survived: boolean;
  ts: number;
}

export interface PlayerStats {
  uid: string;
  totalVoteTimeMs: number;
  voteCount: number;
  gamesPlayed: number;
  gamesWon: number;
  consecutiveWins: number;
  lastRole: string;
  lastUpdated: number;
  winsAsWolf: number;
  winsAsVillage: number;
  survivedGames: number;
  rolePlayCount: Record<string, number>;
  lastGameDrama: string;
  gameHistory?: GameHistoryEntry[];
}

export interface PlayerBehaviorProfile {
  aggressionLevel: 'fast' | 'medium' | 'slow';
  followsLeader: boolean;
  winRate: number;
  gamesPlayed: number;
  consecutiveWins: number;
}

/**
 * Read-only client helper. All playerBehavior writes are server-authoritative:
 * day votes are recorded by /api/day-vote and game results by /api/award-xp.
 */
export async function getBehaviorProfile(uid: string): Promise<PlayerBehaviorProfile> {
  try {
    const snap = await getDoc(doc(db, 'playerBehavior', uid));
    if (!snap.exists()) return { aggressionLevel: 'medium', followsLeader: false, winRate: 0.5, gamesPlayed: 0, consecutiveWins: 0 };
    const s = snap.data() as PlayerStats;
    const avgVoteMs = s.voteCount > 0 ? s.totalVoteTimeMs / s.voteCount : 30000;
    const aggressionLevel = avgVoteMs < 15000 ? 'fast' : avgVoteMs < 40000 ? 'medium' : 'slow';
    const winRate = s.gamesPlayed > 0 ? s.gamesWon / s.gamesPlayed : 0.5;
    const followsLeader = aggressionLevel === 'slow';
    return { aggressionLevel, followsLeader, winRate, gamesPlayed: s.gamesPlayed, consecutiveWins: s.consecutiveWins ?? 0 };
  } catch {
    return { aggressionLevel: 'medium', followsLeader: false, winRate: 0.5, gamesPlayed: 0, consecutiveWins: 0 };
  }
}
