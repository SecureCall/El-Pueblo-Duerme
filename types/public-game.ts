import type { BotType } from '@/types';

/** Data safe to expose to every participant in a game. */
export type PublicPlayer = {
  uid: string;
  name: string;
  photoURL?: string;
  isHost: boolean;
  isAlive: boolean;
  isAI?: boolean;
  botType?: BotType;
};

/** Publicly revealed role information (for example after a death). */
export type PublicRoleReveal = {
  uid: string;
  role: string;
  revealedAt: unknown;
};

/** Private state that may only be delivered to the owning player. */
export type PrivatePlayerState = {
  uid: string;
  role: string | null;
  team?: string | null;
  secretObjectiveId?: string | null;
};

/** Public projection of a game. Secrets and authoritative server state are intentionally absent. */
export type PublicGameState = {
  gameId: string;
  gameName?: string;
  hostUid: string;
  status: string;
  phase: string;
  roundNumber: number;
  players: PublicPlayer[];
  maxPlayers?: number;
  phaseEndsAt?: unknown;
  currentEvent?: unknown;
  eventRound?: number;
  eliminatedHistory?: unknown[];
  winners?: string[];
  winMessage?: string;
  publicRoleReveals?: PublicRoleReveal[];
};
