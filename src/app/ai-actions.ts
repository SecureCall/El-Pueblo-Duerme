
"use server";

import { collection, doc, getDoc, getDocs, query, where, orderBy, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Player, GameEvent, TakeAITurnInput } from "@/types";
import { takeAITurn } from "@/ai/flows/take-ai-turn-flow";
import { submitNightAction, submitVote, submitHunterShot, submitCupidAction } from "./actions";

async function getPlayerRef(gameId: string, userId: string) {
    const q = query(collection(db, 'players'), where('gameId', '==', gameId), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].ref;
}

// Helper to convert Firestore Timestamps to something JSON-serializable (ISO strings)
const toJSONCompatible = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj.toDate === 'function') {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(toJSONCompatible);
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = toJSONCompatible(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
};

export async function runAIActions(gameId: string, phase: Game['phase']) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        const playersSnap = await getDocs(query(collection(db, 'players'), where('gameId', '==', gameId)));
        const players = playersSnap.docs.map(p => p.data() as Player);
        
        const eventsSnap = await getDocs(query(collection(db, 'game_events'), where('gameId', '==', gameId), orderBy('createdAt', 'asc')));
        const events = eventsSnap.docs.map(e => e.data() as GameEvent);

        const aiPlayers = players.filter(p => p.isAI && p.isAlive);
        const alivePlayers = players.filter(p => p.isAlive);

        for (const ai of aiPlayers) {
             const nightActionsQuery = query(collection(db, 'night_actions'), where('gameId', '==', gameId), where('round', '==', game.currentRound), where('playerId', '==', ai.userId));
            const existingNightActions = await getDocs(nightActionsQuery);
            if (phase === 'night' && !existingNightActions.empty) continue;
            
            if (phase === 'hunter_shot' && ai.userId !== game.pendingHunterShot) continue;

            const playerRef = await getPlayerRef(game.id, ai.userId);
            if (!playerRef) continue;

            const playerDocSnap = await getDoc(playerRef);
            if (phase === 'day' && playerDocSnap.exists() && playerDocSnap.data().votedFor) continue;

            const serializableGame = toJSONCompatible(game);
            const serializablePlayers = toJSONCompatible(players);
            const serializableEvents = toJSONCompatible(events);
            const serializableCurrentPlayer = toJSONCompatible(ai);

            const aiInput: TakeAITurnInput = {
                game: JSON.stringify(serializableGame),
                players: JSON.stringify(serializablePlayers),
                events: JSON.stringify(serializableEvents),
                currentPlayer: JSON.stringify(serializableCurrentPlayer),
            };

            const aiResult = await takeAITurn(aiInput);
            console.log(`AI (${ai.displayName} as ${ai.role}) action: ${aiResult.action}. Reasoning: ${aiResult.reasoning}`);

            const [actionType, targetData] = aiResult.action.split(':');

            if (!actionType || actionType === 'NONE') continue;

            const isValidTarget = (id: string | undefined): id is string => {
                return !!id && alivePlayers.some(p => p.userId === id);
            }
            
             const isValidMultiTarget = (ids: string | undefined): ids is string => {
                if (!ids) return false;
                return ids.split('|').every(id => isValidTarget(id) || players.some(p => p.userId === id)); // Cupid can pick self
            }

            switch(actionType) {
                case 'KILL':
                    if (phase === 'night' && (ai.role === 'werewolf' || ai.role === 'wolf_cub') && isValidMultiTarget(targetData)) {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'werewolf_kill', targetId: targetData });
                    }
                    break;
                case 'CHECK':
                     if (phase === 'night' && ai.role === 'seer' && isValidTarget(targetData)) {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'seer_check', targetId: targetData });
                    }
                    break;
                case 'HEAL':
                     if (phase === 'night' && ai.role === 'doctor' && isValidTarget(targetData)) {
                        const targetPlayerDoc = await getDoc(doc(db, 'players', players.find(p => p.userId === targetData)!.id));
                         if (targetPlayerDoc.exists() && targetPlayerDoc.data().lastHealedRound !== game.currentRound - 1) {
                            await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'doctor_heal', targetId: targetData });
                         }
                    }
                    break;
                case 'PROTECT':
                     if (phase === 'night' && ai.role === 'guardian' && isValidTarget(targetData) && targetData !== ai.userId) {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'guardian_protect', targetId: targetData });
                    }
                    break;
                case 'BLESS':
                     if (phase === 'night' && ai.role === 'priest' && isValidTarget(targetData)) {
                         if(targetData === ai.userId && ai.priestSelfHealUsed) continue;
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'priest_bless', targetId: targetData });
                    }
                    break;
                case 'POISON':
                    if (phase === 'night' && ai.role === 'hechicera' && isValidTarget(targetData) && !ai.potions?.poison) {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'hechicera_poison', targetId: targetData });
                    }
                    break;
                case 'SAVE':
                    if (phase === 'night' && ai.role === 'hechicera' && isValidTarget(targetData) && !ai.potions?.save) {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'hechicera_save', targetId: targetData });
                    }
                    break;
                case 'ENCHANT':
                    if (phase === 'night' && ai.role === 'cupid' && game.currentRound === 1 && isValidMultiTarget(targetData)) {
                        const [target1Id, target2Id] = targetData.split('|');
                        await submitCupidAction(gameId, ai.userId, target1Id, target2Id);
                    }
                    break;
                case 'VOTE':
                    if (phase === 'day' && isValidTarget(targetData)) {
                        await submitVote(gameId, ai.userId, targetData);
                    }
                    break;
                case 'SHOOT':
                    if (phase === 'hunter_shot' && ai.userId === game.pendingHunterShot && isValidTarget(targetData)) {
                        await submitHunterShot(gameId, ai.userId, targetData);
                    }
                    break;
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

    