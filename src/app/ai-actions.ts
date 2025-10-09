
"use server";

import { collection, doc, getDoc, getDocs, query, where, orderBy, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Player, GameEvent, TakeAITurnInput } from "@/types";
import { takeAITurn } from "@/ai/flows/take-ai-turn-flow";
import { submitNightAction, submitVote, submitHunterShot } from "./actions";

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

            const [actionType, targetId] = aiResult.action.split(':');

            if (!actionType || actionType === 'NONE') continue;

            const isValidTarget = (targetId: string) => alivePlayers.some(p => p.userId === targetId);

            switch(actionType) {
                case 'KILL':
                    if (phase === 'night' && ai.role === 'werewolf' && targetId && isValidTarget(targetId)) {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'werewolf_kill', targetId });
                    }
                    break;
                case 'CHECK':
                     if (phase === 'night' && ai.role === 'seer' && targetId && isValidTarget(targetId)) {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'seer_check', targetId });
                    }
                    break;
                case 'HEAL':
                     if (phase === 'night' && ai.role === 'doctor' && targetId && isValidTarget(targetId)) {
                         const targetPlayerRef = await getPlayerRef(game.id, targetId);
                         if (targetPlayerRef) {
                            const targetPlayerDoc = await getDoc(targetPlayerRef);
                             if (targetPlayerDoc.exists() && targetPlayerDoc.data().lastHealedRound !== game.currentRound - 1) {
                                await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'doctor_heal', targetId });
                             }
                         }
                    }
                    break;
                case 'VOTE':
                    if (phase === 'day' && targetId && isValidTarget(targetId)) {
                        await submitVote(gameId, ai.userId, targetId);
                    }
                    break;
                case 'SHOOT':
                    if (phase === 'hunter_shot' && ai.userId === game.pendingHunterShot && targetId && isValidTarget(targetId)) {
                        await submitHunterShot(gameId, ai.userId, targetId);
                    }
                    break;
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}
