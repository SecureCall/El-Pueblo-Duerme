
import type { Timestamp } from 'firebase/firestore';

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
  lovers?: [string, string];
  twins?: [string, string];
  pendingHunterShot?: string | null; // userId of the hunter who needs to shoot
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
