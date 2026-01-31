
'use server';

import { getAdminDb } from './firebase-admin';
import { runTransaction, FieldValue } from 'firebase-admin/firestore';
import { toPlainObject, getMillis } from './utils';
import type { Game, Player, GameEvent, PlayerPrivateData, NightActionType, ChatMessage } from '@/types';
// AI flow imports are now dynamic within each function to prevent premature initialization
import { 
    submitNightAction, 
    submitVote, 
    sendChatMessageForAI, 
    submitJuryVote 
} from './ai-callable-actions';


export async function runNightAIActions(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    
    try {
        const gameSnap = await gameRef.get();
        if (!gameSnap.exists()) return;
        const game = gameSnap.data() as Game;

        if (game.status !== 'in_progress' || game.phase !== 'night') {
            return;
        }

        const privateDataCol = adminDb.collection('games').doc(gameId).collection('playerData');
        const privateDataSnap = await privateDataCol.get();
        const allPrivateData: Record<string, PlayerPrivateData> = {};
        privateDataSnap.forEach(doc => {
            allPrivateData[doc.id] = doc.data() as PlayerPrivateData;
        });

        const fullPlayers = game.players.map(p => ({
            ...p,
            ...(allPrivateData[p.userId] || {})
        })) as Player[];

        const aliveAIPlayers = fullPlayers.filter(p => p.isAI && p.isAlive);
        
        const voteHistory = fullPlayers
            .filter(p => p.votedFor)
            .map(p => {
                const target = fullPlayers.find(t => t.userId === p.votedFor);
                return {
                    voterName: p.displayName,
                    targetName: target?.displayName || 'Nadie',
                };
            });

        for (const aiPlayer of aliveAIPlayers) {
             if (aiPlayer.usedNightAbility || !aiPlayer.role) continue;
            
             const canPerformAction = (
                ['werewolf', 'wolf_cub', 'seer', 'doctor', 'hechicera', 'guardian', 'priest', 
                 'vampire', 'cult_leader', 'fisherman', 'silencer', 'elder_leader', 'witch', 
                 'banshee', 'lookout', 'seeker_fairy', 'resurrector_angel'].includes(aiPlayer.role) ||
                (aiPlayer.role === 'seer_apprentice' && !!game.seerDied) ||
                (game.currentRound === 1 && ['cupid', 'shapeshifter', 'virginia_woolf', 'river_siren'].includes(aiPlayer.role))
            );

            if (canPerformAction) {
                const perspective = {
                    game: toPlainObject(game),
                    aiPlayer: toPlainObject(aiPlayer),
                    possibleTargets: toPlainObject(fullPlayers.filter(p => p.isAlive)),
                    voteHistory: voteHistory,
                };
                
                await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 2000));
                
                try {
                    const { generateAIAction } = await import('@/ai/flows/generate-ai-action-flow');
                    const action = await generateAIAction(perspective);
                    if (action && action.actionType && action.targetIds.length > 0) {
                        const currentPrivateSnap = await adminDb.collection('games').doc(gameId).collection('playerData').doc(aiPlayer.userId).get();
                        if(currentPrivateSnap.exists() && !currentPrivateSnap.data()?.usedNightAbility) {
                            await submitNightAction({
                                gameId,
                                round: game.currentRound,
                                playerId: aiPlayer.userId,
                                actionType: action.actionType,
                                targetId: action.targetIds.join('|'),
                            });
                        }
                    }
                } catch (err) {
                     console.error(`Error generating AI action for ${aiPlayer.displayName}:`, err);
                }
            }
        }
    } catch (e) {
        console.error(`Error running night AI actions for game ${gameId}:`, e);
    }
}

export async function runAIJuryVotes(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);

    try {
        const gameSnap = await gameRef.get();
        if (!gameSnap.exists()) return;
        const game = gameSnap.data() as Game;

        if (game.status !== 'in_progress' || game.phase !== 'jury_voting') {
            return;
        }
        
        const lastVoteEvent = [...game.events].sort((a,b) => getMillis(b.createdAt) - getMillis(a.createdAt)).find(e => e.type === 'vote_result');
        const tiedPlayerIds = lastVoteEvent?.data?.tiedPlayerIds;
        if (!tiedPlayerIds || tiedPlayerIds.length === 0) return;

        const privateDataCol = adminDb.collection('games').doc(gameId).collection('playerData');
        const privateDataSnap = await privateDataCol.get();
        const allPrivateData: Record<string, PlayerPrivateData> = {};
        privateDataSnap.forEach(doc => {
            allPrivateData[doc.id] = doc.data() as PlayerPrivateData;
        });

        const fullPlayers = game.players.map(p => ({
            ...p,
            ...(allPrivateData[p.userId] || {})
        })) as Player[];

        const deadAIPlayers = fullPlayers.filter(p => p.isAI && !p.isAlive && !game.juryVotes?.[p.userId]);

        const voteHistory = fullPlayers
            .filter(p => p.votedFor)
            .map(p => {
                const target = fullPlayers.find(t => t.userId === p.votedFor);
                return {
                    voterName: p.displayName,
                    targetName: target?.displayName || 'Nadie',
                };
            });

        for (const aiPlayer of deadAIPlayers) {
            const votablePlayers = fullPlayers.filter(p => tiedPlayerIds.includes(p.userId));
            if (votablePlayers.length === 0) continue;

            const chatSummary = game.chatMessages
                .slice(-10)
                .map(m => `${m.senderName}: ${m.text}`);
            
            const perspective = {
                game: toPlainObject(game),
                aiPlayer: toPlainObject(aiPlayer),
                votablePlayers: toPlainObject(votablePlayers),
                chatHistory: chatSummary,
                voteHistory: voteHistory,
                seerChecks: aiPlayer.seerChecks,
                loverName: undefined,
                executionerTargetName: undefined,
            };

            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
            
            try {
                const { generateAIVote } = await import('@/ai/flows/generate-ai-vote-flow');
                const vote = await generateAIVote(perspective);
                const targetId = vote.targetId;

                const isValidTarget = votablePlayers.some(p => p.userId === targetId);
                if (targetId && isValidTarget) {
                    await submitJuryVote(gameId, aiPlayer.userId, targetId);
                } else {
                    const randomTarget = votablePlayers[Math.floor(Math.random() * votablePlayers.length)];
                    await submitJuryVote(gameId, aiPlayer.userId, randomTarget.userId);
                }
            } catch (err) {
                 console.error(`Error generating AI jury vote for ${aiPlayer.displayName}:`, err);
                 const randomTarget = votablePlayers[Math.floor(Math.random() * votablePlayers.length)];
                 await submitJuryVote(gameId, aiPlayer.userId, randomTarget.userId);
            }
        }
    } catch (e) {
        console.error(`Error running AI jury votes for game ${gameId}:`, e);
    }
}

export async function runAIVotes(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);

    try {
        const gameSnap = await gameRef.get();
        if (!gameSnap.exists()) return;
        const game = gameSnap.data() as Game;

        if (game.status !== 'in_progress' || game.phase !== 'day') {
            return;
        }

        const privateDataCol = adminDb.collection('games').doc(gameId).collection('playerData');
        const privateDataSnap = await privateDataCol.get();
        const allPrivateData: Record<string, PlayerPrivateData> = {};
        privateDataSnap.forEach(doc => {
            allPrivateData[doc.id] = doc.data() as PlayerPrivateData;
        });

        const fullPlayers = game.players.map(p => ({
            ...p,
            ...(allPrivateData[p.userId] || {})
        })) as Player[];

        const aliveAIPlayers = fullPlayers.filter(p => p.isAI && p.isAlive && !p.votedFor);

        const voteHistory = fullPlayers
            .filter(p => p.votedFor)
            .map(p => {
                const target = fullPlayers.find(t => t.userId === p.votedFor);
                return {
                    voterName: p.displayName,
                    targetName: target?.displayName || 'Nadie',
                };
            });

        for (const aiPlayer of aliveAIPlayers) {
            const votablePlayers = fullPlayers.filter(p => p.isAlive && p.userId !== aiPlayer.userId);
            if (votablePlayers.length === 0) continue;

            const chatSummary = game.chatMessages
                .slice(-10)
                .map(m => `${m.senderName}: ${m.text}`);
            
            const loverId = game.lovers?.find(id => id !== aiPlayer.userId) && aiPlayer.isLover ? game.lovers.find(id => id !== aiPlayer.userId) : undefined;
            const loverName = loverId ? fullPlayers.find(p => p.userId === loverId)?.displayName : undefined;
            const executionerTargetName = aiPlayer.executionerTargetId ? fullPlayers.find(p => p.userId === aiPlayer.executionerTargetId)?.displayName : undefined;

            const perspective = {
                game: toPlainObject(game),
                aiPlayer: toPlainObject(aiPlayer),
                votablePlayers: toPlainObject(votablePlayers),
                chatHistory: chatSummary,
                voteHistory: voteHistory,
                seerChecks: aiPlayer.seerChecks,
                loverName,
                executionerTargetName,
            };

            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
            
            try {
                const { generateAIVote } = await import('@/ai/flows/generate-ai-vote-flow');
                const vote = await generateAIVote(perspective);
                const targetId = vote.targetId;

                const isValidTarget = votablePlayers.some(p => p.userId === targetId);
                if (targetId && isValidTarget) {
                    await submitVote(gameId, aiPlayer.userId, targetId);

                    if (vote.reasoning && Math.random() < 0.4) { // 40% chance
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));
                        await sendChatMessageForAI(gameId, aiPlayer.userId, aiPlayer.displayName, vote.reasoning);
                    }
                } else {
                    const randomTarget = votablePlayers[Math.floor(Math.random() * votablePlayers.length)];
                    await submitVote(gameId, aiPlayer.userId, randomTarget.userId);
                }
            } catch (err) {
                 console.error(`Error generating AI vote for ${aiPlayer.displayName}:`, err);
                 const randomTarget = votablePlayers[Math.floor(Math.random() * votablePlayers.length)];
                 await submitVote(gameId, aiPlayer.userId, randomTarget.userId);
            }
        }
    } catch (e) {
        console.error(`Error running AI votes for game ${gameId}:`, e);
    }
}


export async function triggerAIChat(gameId: string, triggerMessage: string, chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost') {
    const adminDb = getAdminDb();
    try {
        const gameDoc = await adminDb.collection('games').doc(gameId).get();
        if (!gameDoc.exists()) return;

        let game = gameDoc.data() as Game;
        if (game.status === 'finished') return;

        const aiPlayersToTrigger = game.players.filter(p => p.isAI && p.isAlive);
        
        for (const publicAiPlayer of aiPlayersToTrigger) {
             const isAccused = triggerMessage.toLowerCase().includes(publicAiPlayer.displayName.toLowerCase());
             const shouldTrigger = isAccused ? Math.random() < 0.95 : Math.random() < 0.35;

             if (shouldTrigger) {
                 const privateDataSnap = await adminDb.collection('games').doc(gameId).collection('playerData').doc(publicAiPlayer.userId).get();
                 if (!privateDataSnap.exists()) continue;
                 
                 const aiPlayer: Player = { ...publicAiPlayer, ...(privateDataSnap.data() as PlayerPrivateData) };

                const perspective = {
                    game: toPlainObject(game),
                    aiPlayer: toPlainObject(aiPlayer),
                    trigger: triggerMessage,
                    players: toPlainObject(game.players),
                    chatType,
                    seerChecks: (privateDataSnap.data() as PlayerPrivateData)?.seerChecks,
                };
                
                try {
                    const { generateAIChatMessage } = await import('@/ai/flows/generate-ai-chat-flow');
                    const { message, shouldSend } = await generateAIChatMessage(perspective);
                    if (shouldSend && message) {
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 1000));
                        await sendChatMessageForAI(gameId, aiPlayer.userId, aiPlayer.displayName, message);
                    }
                } catch (aiError) {
                    console.error(`Error generating AI chat for ${aiPlayer.displayName}:`, aiError);
                }
            }
        }
    } catch (e) {
        console.error("Error in triggerAIChat:", e);
    }
}

export async function triggerAIReactionToGameEvent(gameId: string, event: GameEvent) {
    const adminDb = getAdminDb();
    try {
        const gameDoc = await adminDb.collection('games').doc(gameId).get();
        if (!gameDoc.exists()) return;

        let game = gameDoc.data() as Game;
        if (game.status === 'finished') return;
        
        if (event.type === 'special' || !event.message) return;

        const aiPlayersToTrigger = game.players.filter(p => p.isAI && p.isAlive);
        const isStartOfDay = event.type === 'night_result';
        
        for (const publicAiPlayer of aiPlayersToTrigger) {
             const shouldTrigger = isStartOfDay ? Math.random() < 0.65 : Math.random() < 0.35;

             if (shouldTrigger) {
                 const privateDataSnap = await adminDb.collection('games').doc(gameId).collection('playerData').doc(publicAiPlayer.userId).get();
                 if (!privateDataSnap.exists()) continue;
                 
                 const aiPlayer: Player = { ...publicAiPlayer, ...(privateDataSnap.data() as PlayerPrivateData) };
                 
                const perspective = {
                    game: toPlainObject(game),
                    aiPlayer: toPlainObject(aiPlayer),
                    trigger: `Ha ocurrido un evento: "${event.message}"`,
                    players: toPlainObject(game.players),
                    chatType: 'public' as const,
                    seerChecks: (privateDataSnap.data() as PlayerPrivateData)?.seerChecks,
                };

                try {
                    const { generateAIChatMessage } = await import('@/ai/flows/generate-ai-chat-flow');
                    const { message, shouldSend } = await generateAIChatMessage(perspective);
                    if (shouldSend && message) {
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 1000));
                        await sendChatMessageForAI(gameId, aiPlayer.userId, aiPlayer.displayName, message);
                    }
                } catch (aiError) {
                    console.error(`Error generating AI event reaction for ${aiPlayer.displayName}:`, aiError);
                }
            }
        }
    } catch (e) {
        console.error("Error in triggerAIReactionToGameEvent:", e);
    }
}
