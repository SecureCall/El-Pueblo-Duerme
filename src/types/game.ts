
export type Role = 'aldeano' | 'lobo' | 'vidente' | 'médico' | 'cazador';
export type GamePhase = 'lobby' | 'noche' | 'dia' | 'votacion' | 'finalizado';

export interface Player {
  id: string;
  uid: string;           // Firebase Auth UID
  displayName: string;
  role: Role;
  isAlive: boolean;
  votedFor?: string;     // ID del jugador votado
  nightAction?: string;  // ID objetivo de acción nocturna
}

export interface Game {
  id: string;
  code: string;          // Código para unirse (ej: "ABC123")
  phase: GamePhase;
  turnNumber: number;
  players: Record<string, Player>;
  createdBy: string;
  createdAt: Date;
  winner?: 'aldeanos' | 'lobos';
}
