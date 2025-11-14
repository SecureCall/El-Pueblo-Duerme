'use server';
import { 
  type Game, 
  type Player, 
  type PlayerRole, 
  type NightActionType
} from "@/types";
import { submitNightAction, submitVote, getAuthenticatedSdks } from "./firebase-actions";
import { getDeterministicAIAction as getAction } from './ai-logic';
import { getDoc, doc } from 'firebase/firestore';


export async function runAIActions(gameId: string, phase: 'day' | 'night') {
    const { firestore } = getAuthenticatedSdks();

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
                const { actionType, targetId } = getAction(ai, game, alivePlayers, deadPlayers);
                if (!actionType || actionType === 'NONE' || !targetId || actionType === 'VOTE' || actionType === 'SHOOT') continue;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
                await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType, targetId });
            }
        } else if (phase === 'day') {
            const aiPlayersToVote = game.players.filter(p => p.isAI && p.isAlive && !p.votedFor);
            for (const ai of aiPlayersToVote) {
                const { targetId } = getAction(ai, game, alivePlayers, deadPlayers);
                if (targetId) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 8000 + 2000));
                    await submitVote(gameId, ai.userId, targetId);
                }
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}
