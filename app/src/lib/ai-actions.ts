
'use server';
import { 
  type Game, 
  type Player, 
} from "@/types";
import { runAIActions as runAIActionsServer, runAIHunterShot as runAIHunterShotServer } from "./server-ai-actions";


export async function runAIActions(gameId: string, phase: 'day' | 'night') {
  await runAIActionsServer(gameId, phase);
}

export async function runAIHunterShot(gameId: string, hunter: Player) {
   await runAIHunterShotServer(gameId, hunter);
}
