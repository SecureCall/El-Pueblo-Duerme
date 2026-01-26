

import { z } from 'zod';
import { PlayerRoleEnum } from './player-role.enum';

const TimestampSchema = z.union([
  z.object({
    seconds: z.number(),
    nanoseconds: z.number(),
  }),
  z.string().refine(val => !isNaN(Date.parse(val)), {
    message: "Invalid date string format",
  }),
  z.date(),
]).nullable();


export const PlayerRoleSchema = z.nativeEnum(PlayerRoleEnum).nullable();


export const PlayerPublicSchema = z.object({
  userId: z.string(),
  gameId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string(),
  isAlive: z.boolean(),
  isAI: z.boolean(),
  princeRevealed: z.boolean().optional(),
  joinedAt: z.union([TimestampSchema, z.string()]).nullable(),
  votedFor: z.string().nullable(),
  lastActiveAt: z.union([TimestampSchema, z.string()]).nullable(),
});

export const PlayerPrivateSchema = z.object({
  role: PlayerRoleSchema,
  secretObjectiveId: z.string().nullable(),
  executionerTargetId: z.string().nullable(),
  potions: z.object({
    poison: z.number().nullable().optional(),
    save: z.number().nullable().optional(),
  }).optional(),
  priestSelfHealUsed: z.boolean().optional(),
  guardianSelfProtects: z.number().optional(),
  usedNightAbility: z.boolean(),
  shapeshifterTargetId: z.string().nullable().optional(),
  virginiaWoolfTargetId: z.string().nullable().optional(),
  riverSirenTargetId: z.string().nullable().optional(),
  ghostMessageSent: z.boolean().optional(),
  resurrectorAngelUsed: z.boolean().optional(),
  bansheeScreams: z.record(z.string()).optional(),
  lookoutUsed: z.boolean().optional(),
  lastHealedRound: z.number(),
  isCultMember: z.boolean(),
  isLover: z.boolean(),
  biteCount: z.number(),
});

export const PlayerSchema = PlayerPublicSchema.merge(PlayerPrivateSchema);

export const NightActionTypeSchema = z.enum([
    "werewolf_kill", "seer_check", "doctor_heal", "hechicera_poison", 
    "hechicera_save", "guardian_protect", "priest_bless", "vampire_bite", "cult_recruit", 
    "fisherman_catch", "shapeshifter_select", "virginia_woolf_link", "river_siren_charm",
    "silencer_silence", "elder_leader_exile", "witch_hunt", "banshee_scream", "lookout_spy",
    "fairy_find", "fairy_kill", "resurrect", "cupid_love"
  ]);

export const NightActionSchema = z.object({
  gameId: z.string(),
  round: z.number(),
  playerId: z.string(),
  actionType: NightActionTypeSchema,
  targetId: z.string(),
  createdAt: z.union([TimestampSchema, z.string()]).refine((v): v is NonNullable<typeof v> => v !== null),
});

export const GameEventSchema = z.object({
    id: z.string(),
    gameId: z.string(),
    round: z.number(),
    type: z.enum(['night_result', 'vote_result', 'game_start', 'role_reveal', 'game_over', 'lover_death', 'hunter_shot', 'player_transformed', 'behavior_clue', 'special', 'vampire_kill', 'werewolf_kill', 'troublemaker_duel']),
    message: z.string(),
    data: z.any().optional(),
    createdAt: z.union([TimestampSchema, z.string()]).refine((v): v is NonNullable<typeof v> => v !== null),
});

export const ChatMessageSchema = z.object({
    id: z.string().optional(),
    senderId: z.string(),
    senderName: z.string(),
    text: z.string(),
    round: z.number(),
    createdAt: z.union([TimestampSchema, z.string()]).refine((v): v is NonNullable<typeof v> => v !== null),
    mentionedPlayerIds: z.array(z.string()).optional(),
});

export const GameSettingsSchema = z.object({
    werewolves: z.number(),
    fillWithAI: z.boolean(),
    isPublic: z.boolean(),
    juryVoting: z.boolean(),
    seer: z.boolean(),
    doctor: z.boolean(),
    hunter: z.boolean(),
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
    ghost: z.boolean(),
    virginia_woolf: z.boolean(),
    leprosa: z.boolean(),
    river_siren: z.boolean(),
    lookout: z.boolean(),
    troublemaker: z.boolean(),
    silencer: z.boolean(),
    seer_apprentice: z.boolean(),
    elder_leader: z.boolean(),
    seeker_fairy: z.boolean(),
    sleeping_fairy: z.boolean(),
    shapeshifter: z.boolean(),
    witch: z.boolean(),
    banshee: z.boolean(),
    drunk_man: z.boolean(),
    resurrector_angel: z.boolean(),
    cupid: z.boolean(),
    executioner: z.boolean(),
}).catchall(z.union([z.string(), z.number(), z.boolean()]));

export const GameSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["waiting", "in_progress", "finished"]),
  phase: z.enum(["waiting", "role_reveal", "night", "day", "voting", "hunter_shot", "jury_voting", "finished"]),
  creator: z.string(),
  players: z.array(PlayerPublicSchema),
  events: z.array(GameEventSchema),
  chatMessages: z.array(ChatMessageSchema),
  wolfChatMessages: z.array(ChatMessageSchema),
  fairyChatMessages: z.array(ChatMessageSchema),
  twinChatMessages: z.array(ChatMessageSchema),
  loversChatMessages: z.array(ChatMessageSchema),
  ghostChatMessages: z.array(ChatMessageSchema),
  maxPlayers: z.number(),
  createdAt: z.union([TimestampSchema, z.string()]).refine((val): val is { seconds: number; nanoseconds: number; } | Date | string => val !== null, {
    message: "createdAt cannot be null",
  }),
  lastActiveAt: z.union([TimestampSchema, z.string()]).refine((val): val is NonNullable<typeof val> => val !== null),
  currentRound: z.number(),
  settings: GameSettingsSchema,
  phaseEndsAt: z.union([TimestampSchema, z.string()]).nullable(),
  twins: z.tuple([z.string(), z.string()]).nullable(),
  lovers: z.tuple([z.string(), z.string()]).nullable(),
  pendingHunterShot: z.string().nullable(),
  wolfCubRevengeRound: z.number(),
  nightActions: z.array(NightActionSchema).optional(),
  vampireKills: z.number(),
  boat: z.array(z.string()),
  leprosaBlockedRound: z.number(),
  witchFoundSeer: z.boolean(),
  seerDied: z.boolean(),
  silencedPlayerId: z.string().nullable(),
  exiledPlayerId: z.string().nullable(),
  troublemakerUsed: z.boolean(),
  fairiesFound: z.boolean(),
  fairyKillUsed: z.boolean(),
  juryVotes: z.record(z.string()).optional(),
  masterKillUsed: z.boolean().optional(),
});


export const RoleDataSchema = z.object({
  name: PlayerRoleSchema,
  description: z.string(),
  team: z.enum(['Aldeanos', 'Lobos', 'Neutral']),
  alliance: z.enum(['Aldeanos', 'Lobos', 'Neutral', 'Enamorados']),
});


const AIPlayerPublicSchema = PlayerPublicSchema.extend({
    role: PlayerRoleSchema.optional().transform(() => 'unknown'),
});

export const AIPlayerPerspectiveSchema = z.object({
  game: GameSchema,
  aiPlayer: PlayerSchema,
  trigger: z.string(),
  players: z.array(AIPlayerPublicSchema),
  chatType: z.enum(['public', 'wolf', 'twin', 'lovers', 'ghost']),
  seerChecks: z.array(z.object({
    targetName: z.string(),
    isWerewolf: z.boolean(),
  })).optional(),
});


export const GenerateAIChatMessageOutputSchema = z.object({
  message: z.string(),
  shouldSend: z.boolean(),
});
