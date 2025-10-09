import type { Timestamp } from "firebase/firestore";
import { z } from 'zod';

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
    fillWithAI: boolean;
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
  isAI?: boolean;
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


// AI Schemas and Types
export const TakeAITurnInputSchema = z.object({
    game: z.any().describe("The entire game state object."),
    players: z.array(z.any()).describe("An array of all player objects in the game."),
    events: z.array(z.any()).describe("An array of all game events that have occurred."),
    currentPlayer: z.any().describe("The player object for the AI that is taking its turn."),
});

export type TakeAITurnInput = z.infer<typeof TakeAITurnInputSchema>;

export const TakeAITurnOutputSchema = z.object({
    reasoning: z.string().describe("Your step-by-step thought process to arrive at this action."),
    action: z.string().describe("The action to take. Format: 'TYPE:TARGET_ID' or 'TYPE'. Examples: 'VOTE:player123', 'KILL:player456', 'HEAL:player789', 'CHECK:playerABC', 'SHOOT:playerXYZ'. If no action is possible, return 'NONE'."),
});

export type TakeAITurnOutput = z.infer<typeof TakeAITurnOutputSchema>;
