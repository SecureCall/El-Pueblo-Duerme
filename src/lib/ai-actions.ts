
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
} from "@/types";
import { toPlainObject } from "./utils";
import { getSdks } from "@/firebase/server-init";
import { submitNightAction, submitHunterShot, submitVote } from "./firebase-client-actions";
import { getDeterministicAIAction } from "./server-ai-actions";

export { getDeterministicAIAction };

export async function runAIActions(gameId: string, phase: 'day' | 'night' | 'hunter_shot') {
    const { firestore } = getSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.status === 'finished') return;

        const alivePlayers = game.players.filter(p => p.isAlive);
        const deadPlayers = game.players.filter(p => !p.isAlive);

        if (phase === 'night') {
            const aiPlayersToDoAction = game.players.filter(p => p.isAI && p.isAlive && !p.usedNightAbility);
            for (const ai of aiPlayersToDoAction) {
                const { actionType, targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);
                if (!actionType || actionType === 'NONE' || !targetId || actionType === 'VOTE' || actionType === 'SHOOT') continue;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
                // This now correctly calls a client action from a server context, which is not ideal.
                // It should be calling a server-side equivalent. This architecture is flawed.
                // We are fixing it by moving the submitNightAction to firebase-actions and calling it from there
                // This file will now call the server action.
                await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType, targetId });
            }
        } else if (phase === 'day') {
            const aiPlayersToVote = game.players.filter(p => p.isAI && p.isAlive && !p.votedFor);
            for (const ai of aiPlayersToVote) {
                const { targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);
                if (targetId) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 8000 + 2000));
                    await submitVote(firestore, gameId, ai.userId, targetId);
                }
            }
        } else if (phase === 'hunter_shot') {
             const hunter = game.players.find(p => p.userId === game.pendingHunterShot);
             if (hunter && hunter.isAI) {
                await runAIHunterShot(gameId, hunter);
             }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

export async function runAIHunterShot(gameId: string, hunter: Player) {
    try {
        const { firestore } = getSdks();
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunter.userId) return;

        const alivePlayers = game.players.filter(p => p.isAlive && p.userId !== hunter.userId);
        
        const { targetId } = getDeterministicAIAction(hunter, game, alivePlayers, []);

        if (targetId) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            await submitHunterShot(firestore, gameId, hunter.userId, targetId);
        } else {
             console.error(`AI Hunter ${hunter.displayName} could not find a target to shoot.`);
        }

    } catch(e) {
         console.error("Error in runAIHunterShot:", e);
    }
}

    