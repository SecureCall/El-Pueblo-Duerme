import { create } from 'zustand';
import { Player, Room, GameState, ChatMessage, Role } from '@/types';

interface StoreState {
  room: Room | null;
  players: Player[];
  gameState: GameState;
  chat: ChatMessage[];
  myRole: Role | null;
  error: string | null;
  setRoom: (room: Room | null) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updatePlayer: (player: Player) => void;
  setGameState: (gameState: GameState) => void;
  addChatMessage: (message: ChatMessage) => void;
  setMyRole: (role: Role | null) => void;
  setError: (error: string | null) => void;
}

export const useGameStore = create<StoreState>((set, get) => ({
  room: null,
  players: [],
  gameState: {
    phase: 'waiting',
    round: 0,
    isDay: true,
  },
  chat: [],
  myRole: null,
  error: null,
  setRoom: (room) => set({ room }),
  setPlayers: (players) => set({ players }),
  addPlayer: (player) => set((state) => ({ players: [...state.players, player] })),
  removePlayer: (playerId) => set((state) => ({
    players: state.players.filter((p) => p.id !== playerId),
  })),
  updatePlayer: (player) => set((state) => ({
    players: state.players.map((p) => (p.id === player.id ? player : p)),
  })),
  setGameState: (gameState) => set({ gameState }),
  addChatMessage: (message) => set((state) => ({ chat: [...state.chat, message] })),
  setMyRole: (role) => set({ myRole: role }),
  setError: (error) => set({ error }),
}));
