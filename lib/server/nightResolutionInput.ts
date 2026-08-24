import type { NightActionSubmission } from '@/lib/game/nightResolution';

export interface NightResolutionPlayer {
  uid: string;
  name?: string;
  isAlive: boolean;
}

export interface NightResolutionSubmission {
  actorUid: string;
  role: string;
  actions: NightActionSubmission[];
}

export interface NightResolutionInput {
  gameId: string;
  roundNumber: number;
  phase: 'night';
  players: NightResolutionPlayer[];
  submissions: NightResolutionSubmission[];
}

/** Builds the server-owned input from persisted submissions. */
export function createNightResolutionInput(
  gameId: string,
  roundNumber: number,
  players: Array<Record<string, unknown>>,
  submissions: NightResolutionSubmission[],
): NightResolutionInput {
  return {
    gameId,
    roundNumber,
    phase: 'night',
    players: players
      .filter((player) => typeof player.uid === 'string')
      .map((player) => ({
        uid: player.uid as string,
        ...(typeof player.name === 'string' ? { name: player.name } : {}),
        isAlive: player.isAlive !== false,
      })),
    submissions,
  };
}
