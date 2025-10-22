
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import type { GameSchema, PlayerSchema } from './zod';

export type GameStatus = "waiting" | "in_progress" | "finished";
export type GamePhase = "waiting" | "role_reveal" | "night" | "day" | "voting" | "hunter_shot" | "jury_voting" | "finished";
export type PlayerRole = 
  // Aldeanos
  "villager" | 
  "seer" | 
  "doctor" | 
  "hunter" | 
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
  "resurrector_angel" |
  // Lobos
  "werewolf" |
  "wolf_cub" |
  "cursed" |
  "witch" |
  "seeker_fairy" |
  // Especiales
  "shapeshifter" |
  "drunk_man" |
  "cult_leader" |
  "fisherman" |
  "vampire" |
  "banshee" |
  "cupid" |
  "executioner" |
  "sleeping_fairy" | // Neutral/Caótico hasta que se encuentre
  null;


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
  createdAt: Timestamp;
  currentRound: number;
  settings: {
    werewolves: number;
    fillWithAI: boolean;
    isPublic: boolean;
    // Roles from user
    seer: boolean;
    doctor: boolean;
    hunter: boolean;
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
    ghost: boolean;
    virginia_woolf: boolean;
    leprosa: boolean;
    river_siren: boolean;
    lookout: boolean;
    troublemaker: boolean;
    silencer: boolean;
    seer_apprentice: boolean;
    elder_leader: boolean;
    seeker_fairy: boolean;
    sleeping_fairy: boolean;
    shapeshifter: boolean;
    witch: boolean;
    banshee: boolean;
    drunk_man: boolean;
    resurrector_angel: boolean;
    cupid: boolean;
    executioner: boolean;
  };
  phaseEndsAt: Timestamp;
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
}

export interface Player {
  userId: string;
  gameId: string;
  role: PlayerRole;
  isAlive: boolean;
  votedFor: string | null;
  displayName: string;
  avatarUrl: string;
  joinedAt: Timestamp | null;
  lastHealedRound: number;
  isAI: boolean;
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
  // Stats
  victories: number;
  defeats: number;
  roleStats: Partial<Record<NonNullable<PlayerRole>, { played: number; won: number; }>>;
  achievements: string[];
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
    createdAt: Timestamp;
}

export interface GameEvent {
    id: string;
    gameId: string;
    round: number;
    type: 'night_result' | 'vote_result' | 'game_start' | 'role_reveal' | 'game_over' | 'lover_death' | 'hunter_shot' | 'player_transformed' | 'behavior_clue' | 'special' | 'vampire_kill' | 'werewolf_kill' | 'troublemaker_duel';
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
  chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost';
};


export interface GenerateAIChatMessageOutput {
    message: string;
    shouldSend: boolean;
};
