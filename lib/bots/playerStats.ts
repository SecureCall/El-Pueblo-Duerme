import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface PlayerStats {
  uid: string;
  totalVoteTimeMs: number;
  voteCount: number;
  gamesPlayed: number;
  gamesWon: number;
  lastRole: string;
  lastUpdated: number;
}

export interface PlayerBehaviorProfile {
  aggressionLevel: 'fast' | 'medium' | 'slow';
  followsLeader: boolean;
  winRate: number;
  gamesPlayed: number;
}

export async function recordVote(uid: string, dayStartedAt: number): Promise<void> {
  try {
    const voteTimeMs = Date.now() - dayStartedAt;
    if (voteTimeMs < 0 || voteTimeMs > 600000) return;
    const ref = doc(db, 'playerBehavior', uid);
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data() as PlayerStats) : null;
    await setDoc(ref, {
      uid,
      totalVoteTimeMs: (current?.totalVoteTimeMs ?? 0) + voteTimeMs,
      voteCount: (current?.voteCount ?? 0) + 1,
      gamesPlayed: current?.gamesPlayed ?? 0,
      gamesWon: current?.gamesWon ?? 0,
      lastRole: current?.lastRole ?? 'Aldeano',
      lastUpdated: Date.now(),
    }, { merge: true });
  } catch { /* silencioso */ }
}

export async function recordGameResult(uid: string, won: boolean, role: string): Promise<void> {
  try {
    const ref = doc(db, 'playerBehavior', uid);
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data() as PlayerStats) : null;
    await setDoc(ref, {
      uid,
      totalVoteTimeMs: current?.totalVoteTimeMs ?? 0,
      voteCount: current?.voteCount ?? 0,
      gamesPlayed: (current?.gamesPlayed ?? 0) + 1,
      gamesWon: (current?.gamesWon ?? 0) + (won ? 1 : 0),
      lastRole: role,
      lastUpdated: Date.now(),
    }, { merge: true });
  } catch { /* silencioso */ }
}

export async function getBehaviorProfile(uid: string): Promise<PlayerBehaviorProfile> {
  try {
    const snap = await getDoc(doc(db, 'playerBehavior', uid));
    if (!snap.exists()) return { aggressionLevel: 'medium', followsLeader: false, winRate: 0.5, gamesPlayed: 0 };
    const s = snap.data() as PlayerStats;
    const avgVoteMs = s.voteCount > 0 ? s.totalVoteTimeMs / s.voteCount : 30000;
    const aggressionLevel = avgVoteMs < 15000 ? 'fast' : avgVoteMs < 40000 ? 'medium' : 'slow';
    const winRate = s.gamesPlayed > 0 ? s.gamesWon / s.gamesPlayed : 0.5;
    const followsLeader = aggressionLevel === 'slow';
    return { aggressionLevel, followsLeader, winRate, gamesPlayed: s.gamesPlayed };
  } catch {
    return { aggressionLevel: 'medium', followsLeader: false, winRate: 0.5, gamesPlayed: 0 };
  }
}
