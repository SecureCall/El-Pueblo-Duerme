
'use server';
import { 
  getDoc,
  doc,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type PlayerRole, 
  type NightActionType, 
  type AIPlayerPerspective
} from "@/types";
import { toPlainObject } from "./utils";
import { getSdks } from "@/firebase/server-init";
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { runAIActions, getDeterministicAIAction } from "./server-ai-actions";

export { runAIActions, getDeterministicAIAction };

export async function runAIHunterShot(gameId: string, hunter: Player) {
    const { firestore } = getSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunter.userId) return;

        const alivePlayers = game.players.filter(p => p.isAlive && p.userId !== hunter.userId);
        
        const { targetId } = getDeterministicAIAction(hunter, game, alivePlayers, []);

        if (targetId) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            // submitHunterShot is a client action and cannot be called from a server action directly.
            // This architecture needs rethinking or a way to trigger client actions from server.
            // For now, logging the intent.
             console.log(`AI Hunter ${hunter.displayName} decided to shoot ${targetId}, but cannot execute action from server.`);
        } else {
             console.error(`AI Hunter ${hunter.displayName} could not find a target to shoot.`);
        }

    } catch(e) {
         console.error("Error in runAIHunterShot:", e);
    }
}

    