
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import { 
    GameSchema, 
    PlayerSchema, 
    NightActionSchema, 
    PlayerRoleEnum,
    RoleDataSchema,
    GameEventSchema,
    ChatMessageSchema,
    GameSettingsSchema,
    NightActionTypeSchema
} from './zod';

export { PlayerRoleEnum };

// Main data structures inferred from Zod schemas
export type Game = z.infer<typeof GameSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type NightAction = z.infer<typeof NightActionSchema>;
export type PlayerRole = z.infer<typeof PlayerRoleEnum>;
export type GameEvent = z.infer<typeof GameEventSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type GameSettings = z.infer<typeof GameSettingsSchema>;
export type NightActionType = z.infer<typeof NightActionTypeSchema>;


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
  playerUpdates?: Partial<Player>[]; // Updates to specific players by userId
  events?: GameEvent[];
  pendingDeaths?: { playerId: string; cause: GameEvent['type'] }[];
}
