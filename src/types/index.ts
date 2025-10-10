
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
  "ancient" |
  "fool" |
  "scapegoat" |
  "savior" |
  // Lobos
  "werewolf" |
  "wolf_cub" |
  "cursed" |
  "great_werewolf" |
  "white_werewolf" |
  // Especiales / Solitarios
  "angel" |
  "thief" |
  "wild_child" |
  "piper" |
  "pyromaniac" |
  "judge" |
  "raven" |
  "fox" |
  "bear_trainer" |
  "actor" |
  "knight" |
  "two_sisters" |
  "three_brothers" |
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
    // Basic roles
    seer: boolean;
    doctor: boolean;
    hunter: boolean;
    cupid: boolean;
    hechicera: boolean;
    lycanthrope: boolean;
    prince: boolean;
    twin: boolean;
    guardian: boolean;
    priest: boolean;
    wolf_cub: boolean;
    cursed: boolean;
    // New Roles
    ancient: boolean;
    fool: boolean;
    scapegoat: boolean;
    savior: boolean;
    great_werewolf: boolean;
    white_werewolf: boolean;
    angel: boolean;
    thief: boolean;
    wild_child: boolean;
    piper: boolean;
    pyromaniac: boolean;
    judge: boolean;
    raven: boolean;
    fox: boolean;
    bear_trainer: boolean;
    actor: boolean;
    knight: boolean;
    two_sisters: boolean;
    three_brothers: boolean;
  };
  phaseEndsAt?: Timestamp;
  lovers?: [string, string];
  twins?: [string, string];
  pendingHunterShot?: string; // userId of the hunter who needs to shoot
  wolfCubRevengeRound?: number; // The round where werewolves get an extra kill
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
  lastHealedRound?: number;
  isAI?: boolean;
  potions?: {
    poison?: number, // round it was used
    save?: number, // round it was used
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
    gameId: string;
    round: number;
    type: 'night_result' | 'vote_result' | 'game_start' | 'role_reveal' | 'game_over' | 'lover_death' | 'hunter_shot' | 'player_transformed';
    message: string;
    data?: any;
    createdAt: Timestamp;
}

// AI Input/Output Types
// The Zod schemas are defined directly in the server action file to avoid bundling issues.

export type TakeAITurnInput = {
    game: string;
    players: string;
    events: string;
    currentPlayer: string;
};

export type TakeAITurnOutput = {
    reasoning: string;
    action: string;
};
