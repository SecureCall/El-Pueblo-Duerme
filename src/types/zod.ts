
import { z } from 'zod';

// Helper for Firebase Timestamps - now accepting string for client-server transfer
const TimestampSchema = z.union([
  z.object({
    seconds: z.number(),
    nanoseconds: z.number(),
  }),
  z.string().refine(val => !isNaN(Date.parse(val)), {
    message: "Invalid date string format",
  }), // ISO 8601 string
  z.date(), // Accept Date objects as well
]);


export const PlayerRoleSchema = z.enum([
  "villager", "seer", "doctor", "hunter", "cupid", "guardian", "priest", "prince", "lycanthrope", "twin",
  "hechicera", "ghost", "virginia_woolf", "leprosa", "river_siren", "lookout", "troublemaker",
  "silencer", "seer_apprentice", "elder_leader", "werewolf", "wolf_cub", "cursed", "seeker_fairy",
  "sleeping_fairy", "shapeshifter", "drunk_man", "cult_leader", "fisherman", "vampire", "witch", "banshee"
]).nullable();

export const PlayerSchema = z.object({
  userId: z.string(),
  gameId: z.string(),
  role: PlayerRoleSchema,
  isAlive: z.boolean(),
  votedFor: z.string().nullable(),
  displayName: z.string(),
  joinedAt: TimestampSchema,
  lastHealedRound: z.number(),
  isAI: z.boolean(),
  potions: z.object({
    poison: z.number().nullable().optional(),
    save: z.number().nullable().optional(),
  }).optional(),
  priestSelfHealUsed: z.boolean().optional(),
  princeRevealed: z.boolean().optional(),
  guardianSelfProtects: z.number().optional(),
  biteCount: z.number(),
  isCultMember: z.boolean(),
});

export const NightActionSchema = z.object({
  gameId: z.string(),
  round: z.number(),
  playerId: z.string(),
  actionType: z.enum(["werewolf_kill", "seer_check", "doctor_heal", "cupid_enchant", "hechicera_poison", "hechicera_save", "guardian_protect", "priest_bless", "vampire_bite", "cult_recruit", "fisherman_catch"]),
  targetId: z.string(),
  createdAt: TimestampSchema,
});

export const GameEventSchema = z.object({
    id: z.string(),
    gameId: z.string(),
    round: z.number(),
    type: z.enum(['night_result', 'vote_result', 'game_start', 'role_reveal', 'game_over', 'lover_death', 'hunter_shot', 'player_transformed', 'behavior_clue']),
    message: z.string(),
    data: z.any().optional(),
    createdAt: TimestampSchema,
});

export const ChatMessageSchema = z.object({
    id: z.string().optional(),
    senderId: z.string(),
    senderName: z.string(),
    text: z.string(),
    round: z.number(),
    createdAt: TimestampSchema,
    mentionedPlayerIds: z.array(z.string()).optional(),
});

export const GameSettingsSchema = z.object({
    werewolves: z.number(),
    fillWithAI: z.boolean(),
    seer: z.boolean(),
    doctor: z.boolean(),
    hunter: z.boolean(),
    cupid: z.boolean(),
    guardian: z.boolean(),
    priest: z.boolean(),
    prince: z.boolean(),
    lycanthrope: z.boolean(),
    twin: z.boolean(),
    hechicera: z.boolean(),
    wolf_cub: z.boolean(),
    cursed: z.boolean(),
    cult_leader: z.boolean(),
    fisherman: z.boolean(),
    vampire: z.boolean(),
    // Roles no implementados se marcan como opcionales
    ghost: z.boolean().optional(),
    virginia_woolf: z.boolean().optional(),
    leprosa: z.boolean().optional(),
    river_siren: z.boolean().optional(),
    lookout: z.boolean().optional(),
    troublemaker: z.boolean().optional(),
    silencer: z.boolean().optional(),
    seer_apprentice: z.boolean().optional(),
    elder_leader: z.boolean().optional(),
    seeker_fairy: z.boolean().optional(),
    sleeping_fairy: z.boolean().optional(),
    shapeshifter: z.boolean().optional(),
    witch: z.boolean().optional(),
    banshee: z.boolean().optional(),
});

export const GameSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["waiting", "in_progress", "finished"]),
  phase: z.enum(["waiting", "role_reveal", "night", "day", "voting", "hunter_shot", "finished"]),
  creator: z.string(),
  players: z.array(PlayerSchema),
  events: z.array(GameEventSchema),
  chatMessages: z.array(ChatMessageSchema),
  maxPlayers: z.number(),
  createdAt: TimestampSchema,
  currentRound: z.number(),
  settings: GameSettingsSchema,
  phaseEndsAt: TimestampSchema.optional(),
  lovers: z.tuple([z.string(), z.string()]).nullable(),
  twins: z.tuple([z.string(), z.string()]).nullable(),
  pendingHunterShot: z.string().nullable(),
  wolfCubRevengeRound: z.number(),
  nightActions: z.array(NightActionSchema).optional(),
  vampireKills: z.number(),
  boat: z.array(z.string()),
});

export const AIPlayerPerspectiveSchema = z.object({
  game: GameSchema,
  aiPlayer: PlayerSchema,
  trigger: z.string(),
  players: z.array(PlayerSchema),
});

export const GenerateAIChatMessageOutputSchema = z.object({
  message: z.string(),
  shouldSend: z.boolean(),
});
