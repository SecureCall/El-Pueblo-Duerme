import { z } from 'zod';
import { GameSchema, PlayerSchema, GamePhaseSchema } from './zod';


export type Game = z.infer<typeof GameSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type GamePhase = z.infer<typeof GamePhaseSchema>;
