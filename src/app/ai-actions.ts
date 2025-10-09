
"use server";

import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Player, GameEvent, TakeAITurnInput } from "@/types";
import { takeAITurn } from "@/ai/flows/take-ai-turn-flow";
import { submitNightAction, submitVote, submitHunterShot } from "./actions";

// Helper to convert Firestore Timestamps to something JSON-serializable (ISO strings)
const toJSONCompatible = (obj: any): any => {
    if (!obj) return obj;
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(toJSONCompatible);
    }
    if (typeof obj === 'object' && obj.constructor === Object) {
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
    "use server";
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        const playersSnap = await getDocs(query(collection(db, 'players'), where('gameId', '==', gameId)));
        const players = playersSnap.docs.map(p => p.data() as Player);
        
        const eventsSnap = await getDocs(query(collection(db, 'game_events'), where('gameId', '==', gameId), orderBy('createdAt', 'asc')));
        const events = eventsSnap.docs.map(e => e.data() as GameEvent);

        const aiPlayers = players.filter(p => p.isAI && p.isAlive);

        for (const ai of aiPlayers) {
             const nightActionsQuery = query(collection(db, 'night_actions'), where('gameId', '==', gameId), where('round', '==', game.currentRound), where('playerId', '==', ai.userId));
            const existingNightActions = await getDocs(nightActionsQuery);
            if (phase === 'night' && !existingNightActions.empty) continue;

            const playerDocSnap = await getDoc(doc(db, 'players', `${ai.userId}_${gameId}`));
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

            const [actionType, targetId] = aiResult.action.split(':');

            if (!actionType || actionType === 'NONE' || !targetId) continue;

            const alivePlayers = players.filter(p => p.isAlive);
            const validTarget = alivePlayers.some(p => p.userId === targetId);

            if (!validTarget && actionType !== 'NONE') {
                console.log(`AI (${ai.displayName}) chose an invalid target: ${targetId}. Skipping turn.`);
                continue;
            }

            switch(actionType) {
                case 'KILL':
                    if (phase === 'night' && ai.role === 'werewolf') {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'werewolf_kill', targetId });
                    }
                    break;
                case 'CHECK':
                     if (phase === 'night' && ai.role === 'seer') {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'seer_check', targetId });
                    }
                    break;
                case 'HEAL':
                     if (phase === 'night' && ai.role === 'doctor') {
                         const targetPlayerDoc = await getDoc(doc(db, 'players', `${targetId}_${gameId}`));
                         if (targetPlayerDoc.exists() && targetPlayerDoc.data().lastHealedRound !== game.currentRound - 1) {
                            await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'doctor_heal', targetId });
                         }
                    }
                    break;
                case 'VOTE':
                    if (phase === 'day') {
                        await submitVote(gameId, ai.userId, targetId);
                    }
                    break;
                case 'SHOOT':
                    if (phase === 'hunter_shot' && ai.userId === game.pendingHunterShot) {
                        await submitHunterShot(gameId, ai.userId, targetId);
                    }
                    break;
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}
