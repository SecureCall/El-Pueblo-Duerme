
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import type { GameSchema, PlayerSchema, PlayerRoleEnumSchema, RoleDataSchema, NightActionSchema } from './zod';

export type GameStatus = "waiting" | "in_progress" | "finished";
export type GamePhase = "waiting" | "role_reveal" | "night" | "day" | "voting" | "hunter_shot" | "jury_voting" | "finished";
export type PlayerRole = z.infer<typeof PlayerRoleEnumSchema>;
export { PlayerRoleEnum } from './zod';

// Main data structures
export type Game = z.infer<typeof GameSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type NightAction = z.infer<typeof NightActionSchema>;

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
  game: Game;
  aiPlayer: Player;
  trigger: string;
  players: Player[];
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
export type NightActionType = z.infer<typeof NightActionSchema>['actionType'];

export type RoleData = z.infer<typeof RoleDataSchema>;

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
