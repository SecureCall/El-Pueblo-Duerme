// Este archivo es la única fuente de verdad para los tipos compartidos
// entre el cliente (Next.js) y el servidor (Socket.IO).

// Fases del juego
export type GamePhase = 'waiting' | 'role_reveal' | 'night' | 'day' | 'voting' | 'hunter_shot' | 'finished';

// Estado general del juego, gestionado por el servidor.
export interface GameState {
  phase: GamePhase;
  round: number;
  isDay: boolean;
  winCondition?: string; // Mensaje de victoria/derrota
  lynchedPlayerId?: string | null; // ID del jugador linchado en la última votación
}

// Roles posibles en el juego
export type RoleId = 
  // Aldeanos
  'villager' | 'seer' | 'doctor' | 'hunter' | 'guardian' | 'priest' | 'prince' |
  'lycanthrope' | 'twin' | 'hechicera' | 'ghost' | 'virginia_woolf' | 'leprosa' |
  'river_siren' | 'lookout' | 'troublemaker' | 'silencer' | 'seer_apprentice' |
  'elder_leader' | 'resurrector_angel' |
  // Lobos
  'werewolf' | 'wolf_cub' | 'cursed' | 'witch' | 'seeker_fairy' |
  // Especiales/Neutrales
  'shapeshifter' | 'drunk_man' | 'cult_leader' | 'fisherman' | 'vampire' |
  'banshee' | 'cupid' | 'executioner' | 'sleeping_fairy';

// Objeto que define un rol
export interface Role {
  id: RoleId;
  name: string;
  description: string;
  hasNightAction: boolean;
  actionPrompt: string;
}

// Representa a un jugador en una sala
export interface Player {
  id: string; // socket.id
  name: string;
  isHost: boolean;
  isAlive: boolean;
  role: Role | null;
  votedFor: string | null; // ID del jugador por el que ha votado
  votes: number; // Número de votos recibidos
}

// Representa una sala de juego
export interface Room {
  id: string;
  players: Player[];
  gameState: GameState;
}

// Mensaje en el chat
export interface ChatMessage {
  sender: string;
  text: string;
  type: 'player' | 'system';
}

// Acción de un jugador durante la noche
export interface PlayerAction {
    role: RoleId;
    target?: string;
}
