export interface GamePlayer {
  uid: string;
  name: string;
  photoURL: string;
  isHost: boolean;
  isAlive: boolean;
  role: string | null;
  isAI?: boolean;
  botType?: string;
}

export interface GameStateForServer {
  players: GamePlayer[];
  roundNumber?: number;
  voteBanned?: string[];
}
