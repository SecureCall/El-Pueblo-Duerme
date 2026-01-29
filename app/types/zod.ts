import { z } from 'zod';

export const GamePhaseSchema = z.enum(['lobby', 'night', 'day', 'vote', 'ended']);

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAlive: z.boolean(),
  role: z.string().nullable(), // Simplificado por ahora
});

export const GameSchema = z.object({
  id: z.string(),
  phase: GamePhaseSchema,
  players: z.record(PlayerSchema),
  round: z.number(),
});
