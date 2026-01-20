

'use server';
import { runAIActions as runAIActionsServer, runAIHunterShot as runAIHunterShotServer } from "./firebase-actions";
import type { Player } from '@/types';

export async function runAIActions(gameId: string, phase: 'day' | 'night' | 'hunter_shot') {
  await runAIActionsServer(gameId, phase);
}

export async function runAIHunterShot(gameId: string, hunter: Player) {
    await runAIHunterShotServer(gameId, hunter);
}
