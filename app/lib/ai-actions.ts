
'use server';
import { getDoc, doc } from "firebase/firestore";
import { 
  type Game, 
  type Player, 
} from "@/types";
import { submitNightAction, submitHunterShot, submitVote } from "@/lib/firebase-actions";
import { aiNightActionLogic, aiDayActionLogic, aiHunterActionLogic } from './ai-role-logic';
import { adminDb } from "./firebase-admin";

export async function runAIActions(gameId: string, phase: 'day' | 'night') {
    try {
        const gameDoc = await getDoc(doc(adminDb, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.status === 'finished') return;

        const fullPlayers = await getFullPlayers(gameId, game);
        const alivePlayers = fullPlayers.filter(p => p.isAlive);
        const deadPlayers = fullPlayers.filter(p => !p.isAlive);

        if (phase === 'night') {
            const aiPlayersToDoAction = alivePlayers.filter(p => p.isAI && !p.usedNightAbility);
            for (const ai of aiPlayersToDoAction) {
                if (!ai.role) continue;
                const actionLogic = aiNightActionLogic[ai.role];
                if (!actionLogic) continue;

                const { actionType, targetId } = actionLogic(ai, game, alivePlayers, deadPlayers);
                if (!actionType || actionType === 'NONE' || !targetId || actionType === 'VOTE' || actionType === 'SHOOT') continue;
                
                await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
                await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType, targetId });
            }
        } else if (phase === 'day') {
            const aiPlayersToVote = alivePlayers.filter(p => p.isAI && !p.votedFor);
            for (const ai of aiPlayersToVote) {
                const { targetId } = aiDayActionLogic(ai, game, alivePlayers);
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

export async function runAIHunterShot(gameId: string) {
    try {
        const gameDoc = await getDoc(doc(adminDb, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || !game.pendingHunterShot) return;
        
        const fullPlayers = await getFullPlayers(gameId, game);
        const hunter = fullPlayers.find(p => p.userId === game.pendingHunterShot);

        if (!hunter || !hunter.isAI) return;

        const alivePlayers = fullPlayers.filter(p => p.isAlive && p.userId !== hunter.userId);
        
        const { targetId } = aiHunterActionLogic(hunter, game, alivePlayers);

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

async function getFullPlayers(gameId: string, game: Game): Promise<Player[]> {
    const privateDataSnapshot = await getDocs(collection(adminDb, 'games', gameId, 'playerData'));
    const privateDataMap = new Map<string, PlayerPrivateData>();
    privateDataSnapshot.forEach(doc => {
        privateDataMap.set(doc.id, doc.data() as PlayerPrivateData);
    });

    const fullPlayers: Player[] = game.players.map(publicData => {
        const privateData = privateDataMap.get(publicData.userId);
        return { ...publicData, ...privateData } as Player;
    });

    return fullPlayers;
}
