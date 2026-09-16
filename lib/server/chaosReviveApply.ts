import { chooseChaosReviveTarget } from '@/lib/server/chaosRevive';

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);

export interface ChaosReviveApplyPlayer {
  uid: string;
  isAlive: boolean;
  [key: string]: unknown;
}

export interface ChaosReviveApplyHistoryEntry {
  uid: string;
  name: string;
  role: string;
  round?: number;
}

export interface ChaosReviveApplyResult {
  targetUid: string | null;
  players: ChaosReviveApplyPlayer[];
  eliminatedHistory: ChaosReviveApplyHistoryEntry[];
  wolfTeam: Record<string, boolean>;
}

/**
 * Applies a server-selected chaos resurrection to a copied day-resolution
 * state. A resurrected player is removed from the elimination history so the
 * committed state cannot simultaneously describe that player as dead.
 */
export function applyChaosRevive(
  gameId: string,
  roundNumber: number,
  players: ChaosReviveApplyPlayer[],
  eliminatedHistory: ChaosReviveApplyHistoryEntry[],
  roles: Record<string, string>,
  wolfTeam: Record<string, boolean>,
): ChaosReviveApplyResult {
  const nextPlayers = players.map((player) => ({ ...player }));
  const nextHistory = eliminatedHistory.map((entry) => ({ ...entry }));
  const nextWolfTeam = { ...wolfTeam };
  const { targetUid } = chooseChaosReviveTarget(gameId, roundNumber, nextPlayers, nextHistory);

  if (!targetUid) return { targetUid: null, players: nextPlayers, eliminatedHistory: nextHistory, wolfTeam: nextWolfTeam };

  const target = nextPlayers.find((player) => player.uid === targetUid);
  if (!target || target.isAlive) return { targetUid: null, players: nextPlayers, eliminatedHistory: nextHistory, wolfTeam: nextWolfTeam };

  target.isAlive = true;
  const remainingHistory = nextHistory.filter((entry) => entry.uid !== targetUid);

  for (const uid of Object.keys(nextWolfTeam)) delete nextWolfTeam[uid];
  for (const [uid, role] of Object.entries(roles)) {
    if (WOLF_ROLES.has(role)) nextWolfTeam[uid] = true;
  }

  return {
    targetUid,
    players: nextPlayers,
    eliminatedHistory: remainingHistory,
    wolfTeam: nextWolfTeam,
  };
}
