import type { Timestamp } from "firebase/firestore";

export type GameStatus = "waiting" | "in_progress" | "finished";
export type GamePhase = "role_reveal" | "night" | "day" | "voting";
export type PlayerRole = "werewolf" | "villager" | "seer" | "doctor" | "hunter" | null;

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
    seer: boolean;
    doctor: boolean;
    hunter: boolean;
  };
}

export interface Player {
  userId: string;
  gameId: string;
  role: PlayerRole;
  isAlive: boolean;
  votedFor: string | null; // userId
  displayName: string;
  joinedAt: Timestamp;
}
