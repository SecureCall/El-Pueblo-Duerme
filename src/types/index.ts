
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import type { GameSchema, PlayerSchema, PlayerRoleEnumSchema } from './zod';

export type GameStatus = "waiting" | "in_progress" | "finished";
export type GamePhase = "waiting" | "role_reveal" | "night" | "day" | "voting" | "hunter_shot" | "jury_voting" | "finished";
export type PlayerRole = z.infer<typeof PlayerRoleEnumSchema>;
export { PlayerRoleEnum } from './zod';


export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  phase: GamePhase;
  creator: string;
  players: Player[];
  events: GameEvent[];
  chatMessages: ChatMessage[];
  wolfChatMessages: ChatMessage[];
  fairyChatMessages: ChatMessage[];
  twinChatMessages: ChatMessage[];
  loversChatMessages: ChatMessage[];
  ghostChatMessages: ChatMessage[];
  maxPlayers: number;
  createdAt: Timestamp | Date | string;
  lastActiveAt: Timestamp | Date | string;
  currentRound: number;
  settings: {
    werewolves: number;
    fillWithAI: boolean;
    isPublic: boolean;
    juryVoting: boolean;
    [key: string]: boolean | number;
  };
  phaseEndsAt: Timestamp | Date | string | null;
  twins: [string, string] | null;
  lovers: [string, string] | null;
  pendingHunterShot: string | null;
  wolfCubRevengeRound: number;
  nightActions?: NightAction[];
  vampireKills: number;
  boat: string[];
  leprosaBlockedRound: number;
  witchFoundSeer: boolean;
  seerDied: boolean;
  silencedPlayerId: string | null;
  exiledPlayerId: string | null;
  troublemakerUsed: boolean;
  fairiesFound: boolean;
  fairyKillUsed: boolean;
  juryVotes?: Record<string, string>;
  masterKillUsed?: boolean;
}

export interface Player {
  userId: string;
  gameId: string;
  role: PlayerRole;
  isAlive: boolean;
  votedFor: string | null;
  displayName: string;
  avatarUrl: string;
  joinedAt: Timestamp | Date | string | null;
  lastHealedRound: number;
  isAI: boolean;
  isExiled: boolean;
  potions?: {
    poison?: number | null;
    save?: number | null;
  }
  priestSelfHealUsed?: boolean;
  princeRevealed?: boolean;
  guardianSelfProtects?: number;
  biteCount: number;
  isCultMember: boolean;
  isLover: boolean;
  usedNightAbility: boolean;
  shapeshifterTargetId?: string | null;
  virginiaWoolfTargetId?: string | null;
  riverSirenTargetId?: string | null;
  ghostMessageSent?: boolean;
  resurrectorAngelUsed?: boolean;
  bansheeScreams?: Record<string, string>;
  lookoutUsed?: boolean;
  executionerTargetId: string | null;
  secretObjectiveId: string | null;
}

export type NightActionType = 
  "werewolf_kill" | 
  "seer_check" | 
  "doctor_heal" | 
  "hechicera_poison" | 
  "hechicera_save" | 
  "guardian_protect" | 
  "priest_bless" | 
  "vampire_bite" | 
  "cult_recruit" | 
  "fisherman_catch" |
  "shapeshifter_select" |
  "virginia_woolf_link" |
  "river_siren_charm" |
  "silencer_silence" |
  "elder_leader_exile" |
  "witch_hunt" |
  "banshee_scream" |
  "lookout_spy" |
  "fairy_find" |
  "fairy_kill" |
  "resurrect" |
  "cupid_love";


export interface NightAction {
    gameId: string;
    round: number;
    playerId: string;
    actionType: NightActionType;
    targetId: string;
    createdAt: Timestamp | Date | string;
}

export interface GameEvent {
    id: string;
    gameId: string;
    round: number;
    type: 'night_result' | 'vote_result' | 'game_start' | 'role_reveal' | 'game_over' | 'lover_death' | 'hunter_shot' | 'player_transformed' | 'behavior_clue' | 'special' | 'vampire_kill' | 'werewolf_kill' | 'troublemaker_duel';
    message: string;
    data?: any;
    createdAt: Timestamp | Date | string;
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  round: number;
  createdAt: Timestamp | Date | string;
  mentionedPlayerIds?: string[];
}


export interface AIPlayerPerspective {
  game: z.infer<typeof GameSchema>;
  aiPlayer: z.infer<typeof PlayerSchema>;
  trigger: string;
  players: z.infer<typeof PlayerSchema>[];
  chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost';
};


export interface GenerateAIChatMessageOutput {
    message: string;
    shouldSend: boolean;
};

// ===============================================================================================
// Role-specific logic interfaces
// ===============================================================================================

export type Team = 'Aldeanos' | 'Lobos' | 'Neutral';
export type Alliance = Team;


export interface IRole {
  readonly name: PlayerRole;
  readonly description: string;
  readonly team: Team;
  readonly alliance: Alliance;

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null;
  onDeath(context: GameContext): GameStateChange | null;
  checkWinCondition(context: GameContext): boolean;
  getWinMessage(player: Player): string;
  
  toJSON(): RoleData;
}

export interface RoleData {
  name: PlayerRole;
  description: string;
  team: Team;
  alliance: Alliance;
}

export interface GameContext {
  game: Game;
  players: Player[];
  player: Player; // The player instance this role belongs to
}

export interface GameStateChange {
  game?: Partial<Game>;
  players?: Player[]; // Full replacement of players array
  playerUpdates?: Partial<Player>[]; // Updates to specific players by userId
  events?: GameEvent[];
  pendingDeaths?: { playerId: string; cause: GameEvent['type'] }[];
}

// Action sent from the client
export interface PlayerAction {
    type: NightActionType;
    payload: {
        targetId?: string | string[];
        [key: string]: any;
    };
}
