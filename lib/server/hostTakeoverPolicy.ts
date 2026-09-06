export const HOST_ABSENCE_MS = 5 * 60 * 1000;

export interface TakeoverPlayer {
  uid?: unknown;
  isAlive?: unknown;
  isAI?: unknown;
}

export type TakeoverDecision =
  | { ok: true; takenOver: false; hostUid: string }
  | { ok: true; takenOver: true; hostUid: string; players: Record<string, unknown>[] }
  | { ok: false; code: string };

export function getTakeoverDecision(
  game: Record<string, unknown>,
  uid: string,
  hostLastSeen: number,
  now: number,
): TakeoverDecision {
  const players = Array.isArray(game.players)
    ? game.players.filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object' && !Array.isArray(p)))
    : [];

  const caller = players.find((p) => p.uid === uid);
  if (!caller) return { ok: false, code: 'NOT_PLAYER' };
  if (caller.isAlive === false || caller.isAI === true) return { ok: false, code: 'NOT_ELIGIBLE' };
  if (game.phase === 'lobby' || game.phase === 'ended') return { ok: false, code: 'TAKEOVER_NOT_ALLOWED' };

  const currentHostUid = typeof game.hostUid === 'string' ? game.hostUid : '';
  if (!currentHostUid) return { ok: false, code: 'HOST_MISSING' };
  if (currentHostUid === uid) return { ok: true, takenOver: false, hostUid: uid };

  if (now - hostLastSeen < HOST_ABSENCE_MS) return { ok: false, code: 'HOST_STILL_ACTIVE' };

  const candidates = players
    .filter((p) => p.uid !== currentHostUid && p.isAlive !== false && p.isAI !== true && typeof p.uid === 'string')
    .map((p) => p.uid as string)
    .sort((a, b) => a.localeCompare(b));

  if (candidates[0] !== uid) return { ok: false, code: 'NOT_NEXT_CANDIDATE' };

  const newPlayers = players.map((p) => ({ ...p, isHost: p.uid === uid }));
  return { ok: true, takenOver: true, hostUid: uid, players: newPlayers };
}
