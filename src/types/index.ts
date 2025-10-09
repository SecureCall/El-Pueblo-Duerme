
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export type GameStatus = "waiting" | "in_progress" | "finished";
export type GamePhase = "role_reveal" | "night" | "day" | "voting" | "hunter_shot" | "finished";
export type PlayerRole = 
  // Aldeanos (Azul)
  "villager" | 
  "seer" | 
  "doctor" | 
  "hunter" | 
  "cupid" |
  "guardian" |
  "ghost" |
  "priest" |
  "virginia_woolf" |
  "leper" |
  "prince" |
  "lycanthrope" |
  "river_mermaid" |
  "lookout" |
  "troublemaker" |
  "silencer" |
  "twin" |
  "seer_apprentice" |
  "elder_leader" |
  "hechicera" |
  // Lobos (Rojo)
  "werewolf" |
  "wolf_cub" |
  "seeker_fairy" |
  "cursed" |
  "sleeping_fairy" |
  // Especiales (Verde/Morado)
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
    // Basic roles
    seer: boolean;
    doctor: boolean;
// Roles especiales
    hunter: boolean;
    cupid: boolean;
    hechicera: boolean;
    lycanthrope: boolean;
    prince: boolean;
    twin: boolean;
    guardian: boolean;
    ghost: boolean;
    priest: boolean;
    virginia_woolf: boolean;
    leper: boolean;
    river_mermaid: boolean;
    lookout: boolean;
    troublemaker: boolean;
    silencer: boolean;
    seer_apprentice: boolean;
    elder_leader: boolean;
    wolf_cub: boolean;
    seeker_fairy: boolean;
    cursed: boolean;
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
  lovers?: [string, string];
  twins?: [string, string];
  pendingHunterShot?: string; // userId of the hunter who needs to shoot
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
}

export type NightActionType = "werewolf_kill" | "seer_check" | "doctor_heal" | "cupid_enchant" | "hechicera_poison" | "hechicera_save";

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
