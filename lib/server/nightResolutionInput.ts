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

export interface NightResolutionHistory {
  guardianLastTarget: string | null;
  doctorLastTarget: string | null;
  doctorSelfUsed: boolean;
  brujaProtectedUid: string | null;
  hechiceraLifeUsed: boolean;
  hechiceraPoisonUsed: boolean;
}

export interface NightResolutionInput {
  gameId: string;
  roundNumber: number;
  phase: 'night';
  players: NightResolutionPlayer[];
  submissions: NightResolutionSubmission[];
  history: NightResolutionHistory;
}

/** Builds the server-owned input from persisted submissions and game history. */
export function createNightResolutionInput(
  gameId: string,
  roundNumber: number,
  players: Array<Record<string, unknown>>,
  submissions: NightResolutionSubmission[],
  game: Record<string, unknown>,
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
    history: {
      guardianLastTarget: typeof game.guardianLastTarget === 'string' ? game.guardianLastTarget : null,
      doctorLastTarget: typeof game.doctorLastTarget === 'string' ? game.doctorLastTarget : null,
      doctorSelfUsed: game.doctorSelfUsed === true,
      brujaProtectedUid: typeof game.brujaProtectedUid === 'string' ? game.brujaProtectedUid : null,
      hechiceraLifeUsed: game.hechiceraLifeUsed === true,
      hechiceraPoisonUsed: game.hechiceraPoisonUsed === true,
    },
  };
}
