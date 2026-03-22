export type Team = 'aldeanos' | 'lobos' | 'neutral';

export type RoleId =
  | 'aldeano' | 'lobo' | 'vidente' | 'guardian' | 'sacerdote'
  | 'cazador' | 'hechicera' | 'cupido' | 'principe' | 'licantropo'
  | 'gemela' | 'fantasma' | 'virginia_woolf' | 'leprosa'
  | 'sirena_rio' | 'vigia' | 'alborotadora' | 'silenciadora'
  | 'aprendiz_vidente' | 'anciana_lider' | 'angel_resucitador'
  | 'cria_lobo' | 'maldito' | 'hada_buscadora'
  | 'cambiaformas' | 'hombre_ebrio' | 'hada_durmiente'
  | 'vampiro' | 'lider_culto' | 'pescador' | 'banshee' | 'verdugo';

export type Phase =
  | 'lobby' | 'role-reveal' | 'night' | 'night-result'
  | 'day' | 'vote' | 'vote-result' | 'ended';

export interface Player {
  uid: string;
  name: string;
  photoURL: string;
  isHost: boolean;
  isAlive: boolean;
  role: RoleId | null;
  team: Team | null;
  isLover: boolean;
  loverUid: string | null;
  isTwin: boolean;
  twinUid: string | null;
  isSilenced: boolean;
  isExiled: boolean;
  isProtected: boolean;
  isAI: boolean;
  enchantedBy: string | null;
  vampirized: boolean;
  transformedToWolf: boolean;
}

export interface NightAction {
  uid: string;
  action: string;
  targetUid?: string;
  target2Uid?: string;
  extra?: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  createdAt: any;
  isSystem?: boolean;
}

export interface GameState {
  id: string;
  name: string;
  code: string;
  hostUid: string;
  maxPlayers: number;
  wolves: number;
  specialRoles: string[];
  isPublic: boolean;
  fillWithAI: boolean;
  juryVote: boolean;
  players: Player[];
  status: 'lobby' | 'playing' | 'ended';
  phase: Phase;
  round: number;
  nightOrder: RoleId[];
  nightOrderIndex: number;
  currentNightRole: RoleId | null;
  nightActions: Record<string, NightAction>;
  nightDeaths: string[];
  dayAnnouncements: string[];
  winner: string | null;
  winnerTeam: Team | null;
  currentVotes: Record<string, string>;
  phaseStartedAt: number;
  phaseDuration: number;
  loboTarget: string | null;
  witchPotions: { poison: boolean; protect: boolean };
  guardianLastProtected: string | null;
  priestSelfUsed: boolean;
  hunterUsed: boolean;
  hunterPendingDeath: string | null;
  twinUids: string[];
  loverPairs: [string, string][];
  createdAt: any;
}
