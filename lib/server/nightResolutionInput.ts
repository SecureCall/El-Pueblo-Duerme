import type { NightActionSubmission } from '@/lib/game/nightResolution';

export interface NightResolutionPlayer {
  uid: string;
  name?: string;
  isAlive: boolean;
}

export interface NightResolutionInput {
  gameId: string;
  roundNumber: number;
  phase: 'night';
  players: NightResolutionPlayer[];
  submissions: NightActionSubmission[];
}

/**
 * Builds the smallest server-owned input accepted by the future night engine.
 * No client-supplied game state is trusted here.
 */
export function createNightResolutionInput(
  gameId: string,
  roundNumber: number,
  players: Array<Record<string, unknown>>,
  submissions: NightActionSubmission[],
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
