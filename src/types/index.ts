import type { Timestamp } from "firebase/firestore";

export type GameStatus = "waiting" | "in_progress" | "finished";
export type GamePhase = "role_reveal" | "night" | "day" | "voting" | "hunter_shot" | "finished";
export type PlayerRole = "werewolf" | "villager" | "seer" | "doctor" | "hunter" | "cupid" | null;

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  phase: GamePhase;
  creator: string;
  players: string[]; // Array of userIds
  maxPlayers: number;
  createdAt: Timestamp;
  currentRound: number;
  settings: {
    werewolves: number;
    seer: boolean;
    doctor: boolean;
    hunter: boolean;
    cupid: boolean;
  };
  phaseEndsAt?: Timestamp;
  lovers?: [string, string];
  pendingHunterShot?: string; // userId of the hunter who needs to shoot
}

export interface Player {
  userId: string;
  gameId: string;
  role: PlayerRole;
  isAlive: boolean;
  votedFor: string | null; // userId
  displayName: string;
  joinedAt: Timestamp;
  lastHealedRound?: number;
}

export type NightActionType = "werewolf_kill" | "seer_check" | "doctor_heal" | "cupid_enchant";

export interface NightAction {
    gameId: string;
    round: number;
    playerId: string; // The player performing the action
    actionType: NightActionType;
    targetId: string; // The player targeted by the action
    createdAt: Timestamp;
}

export interface GameEvent {
    gameId: string;
    round: number;
    type: 'night_result' | 'vote_result' | 'game_start' | 'role_reveal' | 'game_over' | 'lover_death' | 'hunter_shot';
    message: string;
    data?: any;
    createdAt: Timestamp;
}
