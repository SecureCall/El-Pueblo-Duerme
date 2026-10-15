import { canonicalizeWolfTeam } from '@/lib/server/wolfTeam';

const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);

export interface RoleSwapPlayer {
  uid: string;
  isAlive: boolean;
}

export interface RoleSwapResult {
  roles: Record<string, string>;
  wolfTeam: Record<string, boolean>;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: number): { state: number; value: number } {
  let next = state + 0x6d2b79f5;
  next = Math.imul(next ^ (next >>> 15), next | 1);
  next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
  const value = ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  return { state: next >>> 0, value };
}

/**
 * Deterministically shuffles roles among living players for the server-owned
 * `roleSwap` chaos event. Dead players retain their authoritative roles.
 * The seed is derived only from immutable game/round inputs so retries and
 * scheduler execution produce exactly the same result.
 */
export function applyRoleSwap(
  gameId: string,
  roundNumber: number,
  players: RoleSwapPlayer[],
  currentRoles: Record<string, string>,
): RoleSwapResult {
  const roles = { ...currentRoles };
  const livingUids = players
    .filter((player) => player?.isAlive === true && typeof player.uid === 'string' && player.uid.length > 0)
    .map((player) => player.uid)
    .sort();

  if (livingUids.length < 2) {
    return { roles, wolfTeam: canonicalizeWolfTeam(roles) };
  }

  const shuffledUids = [...livingUids];
  let state = hashSeed(`${gameId}:${roundNumber}:roleSwap`);

  for (let i = shuffledUids.length - 1; i > 0; i -= 1) {
    const result = nextRandom(state);
    state = result.state;
    const j = Math.floor(result.value * (i + 1));
    [shuffledUids[i], shuffledUids[j]] = [shuffledUids[j], shuffledUids[i]];
  }

  const livingRoles = livingUids.map((uid) => currentRoles[uid] ?? 'Aldeano');
  for (let i = 0; i < livingUids.length; i += 1) {
    roles[livingUids[i]] = livingRoles[livingUids.indexOf(shuffledUids[i])];
  }

  const wolfTeam = canonicalizeWolfTeam(roles);
  return { roles, wolfTeam };
}

export function isWolfRole(role: string | undefined): boolean {
  return typeof role === 'string' && WOLF_ROLES.has(role);
}
