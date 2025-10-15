

import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import type { GameSchema, PlayerSchema } from './zod';

export type GameStatus = "waiting" | "in_progress" | "finished";
export type GamePhase = "waiting" | "role_reveal" | "night" | "day" | "voting" | "hunter_shot" | "finished";
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
  players: Player[]; // Array of Player objects
  events: GameEvent[]; // Array of GameEvent objects
  chatMessages: ChatMessage[]; // Array of ChatMessage objects
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
    wolf_cub: boolean;
    cursed: boolean;
    cult_leader: boolean;
    fisherman: boolean;
    vampire: boolean;

    // Roles no implementados (pueden estar presentes en la configuración pero no se usan)
    ghost?: boolean;
    virginia_woolf?: boolean;
    leprosa?: boolean;
    river_siren?: boolean;
    lookout?: boolean;
    troublemaker?: boolean;
    silencer?: boolean;
    seer_apprentice?: boolean;
    elder_leader?: boolean;
    seeker_fairy?: boolean;
    sleeping_fairy?: boolean;
    shapeshifter?: boolean;
    witch?: boolean;
    banshee?: boolean;
  };
  phaseEndsAt?: Timestamp;
  lovers: [string, string] | null;
  twins: [string, string] | null;
  pendingHunterShot: string | null; // userId of the hunter who needs to shoot
  wolfCubRevengeRound: number; // The round where werewolves get an extra kill
  nightActions?: NightAction[];
  vampireKills: number;
  boat: string[];
}

export interface Player {
  userId: string;
  gameId: string; // Still useful for context, though not for querying
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
  guardianSelfProtects?: number;
  biteCount: number;
  isCultMember: boolean;
}

export type NightActionType = "werewolf_kill" | "seer_check" | "doctor_heal" | "cupid_enchant" | "hechicera_poison" | "hechicera_save" | "guardian_protect" | "priest_bless" | "vampire_bite" | "cult_recruit" | "fisherman_catch";

export interface NightAction {
    gameId: string;
    round: number;
    playerId: string; // The player performing the action
    actionType: NightActionType;
    targetId: string; // The player targeted by the action. Can be multiple for wolf cub revenge, separated by |
    createdAt: Timestamp;
}

export interface GameEvent {
    id: string; // unique id for the event, can be generated on client
    gameId: string;
    round: number;
    type: 'night_result' | 'vote_result' | 'game_start' | 'role_reveal' | 'game_over' | 'lover_death' | 'hunter_shot' | 'player_transformed' | 'behavior_clue';
    message: string;
    data?: any;
    createdAt: Timestamp;
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  round: number;
  createdAt: Timestamp;
  mentionedPlayerIds?: string[];
}


export interface AIPlayerPerspective {
  game: z.infer<typeof GameSchema>;
  aiPlayer: z.infer<typeof PlayerSchema>;
  trigger: string;
  players: z.infer<typeof PlayerSchema>[];
};


export interface GenerateAIChatMessageOutput {
    message: string;
    shouldSend: boolean;
};
