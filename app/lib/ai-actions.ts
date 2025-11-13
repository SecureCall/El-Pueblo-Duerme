
'use server';
import { 
  getDoc,
  doc,
  type Firestore
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
} from "@/types";
import { runAIActions as runAIActionsServer } from "./server-ai-actions";
import { submitHunterShot } from "./firebase-actions";


export async function runAIActions(gameId: string, phase: 'day' | 'night') {
  await runAIActionsServer(gameId, phase);
}

export async function runAIHunterShot(gameId: string, hunter: Player) {
    const { firestore } = await import('@/lib/firebase-actions').then(m => m.getAuthenticatedSdks());
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunter.userId) return;

        const alivePlayers = game.players.filter(p => p.isAlive && p.userId !== hunter.userId);
        
        const { getDeterministicAIAction } = await import('./server-ai-actions');
        const { targetId } = getDeterministicAIAction(hunter, game, alivePlayers, []);

        if (targetId) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            await submitHunterShot(gameId, hunter.userId, targetId);
        } else {
             console.error(`AI Hunter ${hunter.displayName} could not find a target to shoot.`);
        }

    } catch(e) {
         console.error("Error in runAIHunterShot:", e);
    }
}
