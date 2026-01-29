

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
  z.null(),
]);

export const PlayerRoleSchema = z.nativeEnum(PlayerRoleEnum).nullable();


export const PlayerPublicDataSchema = z.object({
  userId: z.string(),
  gameId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string(),
  isAlive: z.boolean(),
  isAI: z.boolean(),
  princeRevealed: z.boolean(),
  joinedAt: TimestampSchema,
  votedFor: z.string().nullable(),
  lastActiveAt: TimestampSchema,
});


export const PlayerPrivateDataSchema = z.object({
    role: PlayerRoleSchema,
    isLover: z.boolean(),
    isCultMember: z.boolean(),
    biteCount: z.number(),
    potions: z.object({
      poison: z.number().nullable(),
      save: z.number().nullable(),
    }),
    guardianSelfProtects: z.number(),
    priestSelfHealUsed: z.boolean(),
    lastHealedRound: z.number(),
    usedNightAbility: z.boolean(),
    shapeshifterTargetId: z.string().nullable(),
    virginiaWoolfTargetId: z.string().nullable(),
    riverSirenTargetId: z.string().nullable(),
    ghostMessageSent: z.boolean(),
    resurrectorAngelUsed: z.boolean(),
    bansheeScreams: z.record(z.string()),
    bansheePoints: z.number().optional(),
    lookoutUsed: z.boolean(),
    executionerTargetId: z.string().nullable(),
    secretObjectiveId: z.string().nullable(),
    seerChecks: z.array(z.object({
        targetName: z.string(),
        isWerewolf: z.boolean(),
    })).optional(),
});

export const PlayerSchema = PlayerPublicDataSchema.merge(PlayerPrivateDataSchema);

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
  players: z.array(PlayerPublicDataSchema),
  events: z.array(GameEventSchema),
  chatMessages: z.array(ChatMessageSchema),
  wolfChatMessages: z.array(ChatMessageSchema),
  fairyChatMessages: z.array(ChatMessageSchema),
  twinChatMessages: z.array(ChatMessageSchema),
  loversChatMessages: z.array(ChatMessageSchema),
  ghostChatMessages: z.array(ChatMessageSchema),
  maxPlayers: z.number(),
  createdAt: z.union([TimestampSchema, z.string()]).refine((val): val is { seconds: number; nanoseconds: number } | Date | string => val !== null, {
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

export const AIChatPerspectiveSchema = z.object({
  game: GameSchema,
  aiPlayer: PlayerSchema,
  trigger: z.string(),
  players: z.array(PlayerSchema),
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

export const AIActionPerspectiveSchema = z.object({
  game: GameSchema,
  aiPlayer: PlayerSchema,
  possibleTargets: z.array(PlayerSchema),
});

export const AIActionOutputSchema = z.object({
  actionType: NightActionTypeSchema.nullable().describe("The type of night action the AI should perform. Null if no action is to be taken."),
  targetIds: z.array(z.string()).describe("An array of user IDs for the target(s) of the action. Empty if no target is needed or action is null."),
  reasoning: z.string().describe("A brief, in-character thought process for the chosen action."),
});

export const AIVotePerspectiveSchema = z.object({
  game: GameSchema,
  aiPlayer: PlayerSchema,
  votablePlayers: z.array(PlayerSchema),
  chatHistory: z.array(z.string()).describe("A summary of recent chat messages to gauge sentiment."),
});
export type AIVotePerspective = z.infer<typeof AIVotePerspectiveSchema>;

export const AIVoteOutputSchema = z.object({
  targetId: z.string().nullable().describe("The userId of the player to vote for. Null if abstaining."),
  reasoning: z.string().describe("A brief, in-character thought process for the vote."),
});
export type AIVoteOutput = z.infer<typeof AIVoteOutputSchema>;
