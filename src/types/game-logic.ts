
import type { Game, Player, NightAction, GameEvent } from ".";

// Representa un cambio en el estado del juego que debe aplicarse
export interface GameStateChange {
  game?: Partial<Game>;
  playerUpdates?: Partial<Player>[]; // Aplica actualizaciones a jugadores específicos por userId
  events?: GameEvent[];
  pendingDeaths?: { playerId: string; cause: GameEvent['type'] }[];
}

// Representa un payload de acción de un jugador
export type ActionPayload = {
    targetId?: string | string[];
    [key: string]: any;
};

// Representa una acción de un jugador
export interface Action {
  type: string;
  payload: ActionPayload;
  playerId: string;
}
