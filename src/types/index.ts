
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export type GameStatus = "waiting" | "in_progress" | "finished";
export type GamePhase = "role_reveal" | "night" | "day" | "voting" | "hunter_shot" | "finished";
export type PlayerRole = 
  // Aldeanos
  "villager" | 
  "seer" | 
  "doctor" | 
  "hunter" | 
  "cupid" |
  "guardian" |
  "priest" |
  "prince" |
  "lycanthrope" |
  "twin" |
  "hechicera" |
  "ghost" |
  "virginia_woolf" |
  "leprosa" |
  "river_siren" |
  "lookout" |
  "troublemaker" |
  "silencer" |
  "seer_apprentice" |
  "elder_leader" |
  // Lobos
  "werewolf" |
  "wolf_cub" |
  "cursed" |
  "seeker_fairy" |
  "sleeping_fairy" |
  // Especiales
  "shapeshifter" |
  "drunk_man" |
  "cult_leader" |
  "fisherman" |
  "vampire" |
  "witch" |
  "banshee" |
  null;


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
    fillWithAI: boolean;
    // Roles from user
    seer: boolean;
    doctor: boolean;
    hunter: boolean;
    cupid: boolean;
    guardian: boolean;
    priest: boolean;
    prince: boolean;
    lycanthrope: boolean;
    twin: boolean;
    hechicera: boolean;
    ghost: boolean;
    virginia_woolf: boolean;
    leprosa: boolean;
    river_siren: boolean;
    lookout: boolean;
    troublemaker: boolean;
    silencer: boolean;
    seer_apprentice: boolean;
    elder_leader: boolean;
    wolf_cub: boolean;
    cursed: boolean;
    seeker_fairy: boolean;
    sleeping_fairy: boolean;
    shapeshifter: boolean;
    drunk_man: boolean;
    cult_leader: boolean;
    fisherman: boolean;
    vampire: boolean;
    witch: boolean;
    banshee: boolean;
  };
  phaseEndsAt?: Timestamp;
  lovers: [string, string] | null;
  twins?: [string, string];
  pendingHunterShot: string | null; // userId of the hunter who needs to shoot
  wolfCubRevengeRound: number; // The round where werewolves get an extra kill
}

export interface Player {
  id: string; // The document ID
  userId: string;
  gameId: string;
  role: PlayerRole;
  isAlive: boolean;
  votedFor: string | null; // userId
  displayName: string;
  joinedAt: Timestamp;
  lastHealedRound: number;
  isAI: boolean;
  potions?: {
    poison?: number | null, // round it was used
    save?: number | null, // round it was used
  }
  priestSelfHealUsed?: boolean;
  princeRevealed?: boolean;
}

export type NightActionType = "werewolf_kill" | "seer_check" | "doctor_heal" | "cupid_enchant" | "hechicera_poison" | "hechicera_save" | "guardian_protect" | "priest_bless";

export interface NightAction {
    gameId: string;
    round: number;
    playerId: string; // The player performing the action
    actionType: NightActionType;
    targetId: string; // The player targeted by the action. Can be multiple for wolf cub revenge, separated by |
    createdAt: Timestamp;
}

export interface GameEvent {
    id: string; // document id
    gameId: string;
    round: number;
    type: 'night_result' | 'vote_result' | 'game_start' | 'role_reveal' | 'game_over' | 'lover_death' | 'hunter_shot' | 'player_transformed';
    message: string;
    data?: any;
    createdAt: Timestamp;
}

// AI Input/Output Types
export const TakeAITurnInputSchema = z.object({
    game: z.string().describe("A JSON string representing the entire game state object."),
    players: z.string().describe("A JSON string representing an array of all player objects in the game."),
    events: z.string().describe("A JSON string representing an array of all game events that have occurred."),
    currentPlayer: z.string().describe("A JSON string representing the player object for the AI that is taking its turn."),
});

export type TakeAITurnInput = z.infer<typeof TakeAITurnInputSchema>;

export const TakeAITurnOutputSchema = z.object({
    reasoning: z.string().describe("Your step-by-step thought process to arrive at this action."),
    action: z.string().describe("The action to take. Format: 'TYPE:TARGET_ID' or 'TYPE:TARGET_ID1|TARGET_ID2' or 'TYPE'. Examples: 'VOTE:player123', 'KILL:player456', 'KILL:player456|player789', 'HEAL:player789', 'CHECK:playerABC', 'SHOOT:playerXYZ', 'POISON:player111', 'SAVE:player222', 'PROTECT:player333', 'ENCHANT:playerABC|playerDEF'. If no action is possible, return 'NONE'."),
});

export type TakeAITurnOutput = z.infer<typeof TakeAITurnOutputSchema>;
