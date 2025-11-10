
'use server';
import { 
  doc,
  type Firestore,
} from "firebase/firestore";
import { 
  type Player, 
} from "@/types";
import { runAIActions as runAIActionsServer } from "./server-ai-actions";
import { submitHunterShot } from "./firebase-actions";
import { getSdks } from "@/firebase/server-init";


export async function runAIActions(gameId: string, phase: 'day' | 'night') {
  await runAIActionsServer(gameId, phase);
}

export async function runAIHunterShot(gameId: string, hunter: Player) {
    const { firestore } = getSdks();
    await submitHunterShot(firestore, gameId, hunter.userId, 'some-random-id-for-now');
}

    