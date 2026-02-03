
'use server';
import { 
  type Game, 
  type Player, 
  type PlayerPublicData,
  type PlayerPrivateData,
  type NightAction, 
  type GameEvent, 
  type PlayerRole, 
  type NightActionType, 
  type ChatMessage,
} from "@/types";
import { adminDb, FieldValue } from "./server-init";
import { toPlainObject, splitPlayerData, getMillis, PHASE_DURATION_SECONDS, sanitizeHTML } from "./utils";
import { masterActions } from "./master-actions";
import { processJuryVotesEngine, killPlayer, killPlayerUnstoppable, checkGameOver, processVotesEngine, processNightEngine, generateRoles } from './game-engine';

export async function sendChatMessage(gameId: string, senderId: string, senderName: string, text: string, isFromAI: boolean = false) {
    if (!text?.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };
    
    const sanitizedText = sanitizeHTML(text.trim());
    if (!sanitizedText) return { success: false, error: 'Mensaje inválido.' };

    const gameRef = adminDb.collection('games').doc(gameId);
    const playersRef = gameRef.collection('players');
    const chatCollectionRef = gameRef.collection('publicChat');

    try {
        await adminDb.runTransaction(async (transaction) => {
            const senderRef = playersRef.doc(senderId);
            const [gameSnap, senderSnap] = await transaction.getAll(gameRef, senderRef);

            if (!gameSnap.exists()) throw new Error('Game not found');
            const game = gameSnap.data() as Game;

            if (!senderSnap.exists()) throw new Error("Player not found.");
            const senderData = senderSnap.data() as PlayerPublicData;
            
            if (!senderData.isAlive) {
                throw new Error("Los muertos no hablan.");
            }
            
            if (game.silencedPlayerId === senderId) throw new Error("No puedes hablar, has sido silenciado esta ronda.");
            
            const allPlayersSnap = await transaction.get(playersRef);
            const allPlayers = allPlayersSnap.docs.map(doc => doc.data() as PlayerPublicData);

            const mentionedPlayerIds = allPlayers
                .filter(p => p.isAlive && sanitizedText.toLowerCase().includes(p.displayName.toLowerCase()))
                .map(p => p.userId);
            
            const messageData: Omit<ChatMessage, 'id'> = { senderId, senderName, text: sanitizedText, round: game.currentRound, createdAt: new Date(), mentionedPlayerIds};
            
            const newMessageRef = chatCollectionRef.doc();
            transaction.set(newMessageRef, toPlainObject(messageData));
        });

        if (!isFromAI) {
            const { triggerAIChat } = await import('./firebase-ai-actions');
            await triggerAIChat(gameId, `${senderName} dijo: "${sanitizedText}"`, 'public');
        }
        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

async function sendSpecialChatMessage(gameId: string, senderId: string, senderName: string, text: string, chatType: 'wolf' | 'fairy' | 'twin' | 'lovers' | 'ghost' ) {
    if (!text?.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };

    const sanitizedText = sanitizeHTML(text.trim());
    if (!sanitizedText) return { success: false, error: 'Mensaje inválido.'};

    const gameRef = adminDb.collection('games').doc(gameId);
    
    try {
        await adminDb.runTransaction(async (transaction) => {
            const privateRef = gameRef.collection('playerData').doc(senderId);
            const [gameSnap, privateSnap] = await transaction.getAll(gameRef, privateRef);

            if (!gameSnap.exists()) throw new Error('Game not found');
            const game = gameSnap.data() as Game;

            if (!privateSnap.exists()) throw new Error('Player not found');
            const privateData = privateSnap.data() as PlayerPrivateData;

            let canSend = false;
            let chatCollectionName: string | null = null;
            
            switch (chatType) {
                case 'wolf':
                    if (['werewolf', 'wolf_cub'].includes(privateData.role || '')) {
                        canSend = true; chatCollectionName = 'wolfChat';
                    }
                    break;
                case 'fairy':
                    if (game.fairiesFound && ['seeker_fairy', 'sleeping_fairy'].includes(privateData.role || '')) {
                        canSend = true; chatCollectionName = 'fairyChat';
                    }
                    break;
                case 'twin':
                     if (game.twins?.includes(senderId)) {
                        canSend = true; chatCollectionName = 'twinChat';
                     }
                    break;
                case 'lovers':
                    if (privateData.isLover) {
                        canSend = true; chatCollectionName = 'loversChat';
                    }
                    break;
                case 'ghost':
                    const publicPlayerSnap = await transaction.get(gameRef.collection('players').doc(senderId));
                    if (publicPlayerSnap.exists() && !publicPlayerSnap.data()!.isAlive) {
                         canSend = true; chatCollectionName = 'ghostChat';
                    }
                    break;
            }

            if (!canSend || !chatCollectionName) throw new Error("No tienes permiso para enviar mensajes en este chat.");

            const chatCollectionRef = gameRef.collection(chatCollectionName);
            const messageData: Omit<ChatMessage, 'id'> = { senderId, senderName, text: sanitizedText, round: game.currentRound, createdAt: new Date() };
            
            const newMessageRef = chatCollectionRef.doc();
            transaction.set(newMessageRef, toPlainObject(messageData));
        });
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}


export async function submitNightAction(data: {gameId: string, round: number, playerId: string, actionType: NightActionType, targetId: string}) {
    const { gameId, playerId, actionType, targetId } = data;
    const gameRef = adminDb.collection('games').doc(gameId);
    const privateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(playerId);

    try {
        await adminDb.runTransaction(async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            const privateSnap = await transaction.get(privateRef);
            if (!gameSnap.exists() || !privateSnap.exists()) throw new Error("Game or player data not found");
            
            let game = gameSnap.data() as Game;
            let privateData = privateSnap.data() as PlayerPrivateData;

            if (game.phase !== 'night' || game.status === 'finished') return;
            if (game.exiledPlayerId === playerId) throw new Error("Has sido exiliado esta noche y no puedes usar tu habilidad.");
            if (privateData.usedNightAbility) return;
            
            privateData.usedNightAbility = true;
            transaction.update(privateRef, { usedNightAbility: true });
            
            const newAction: NightAction = { ...data, createdAt: new Date() };
            transaction.update(gameRef, { nightActions: FieldValue.arrayUnion(toPlainObject(newAction)) });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function submitVote(gameId: string, voterId: string, targetId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    const playerRef = gameRef.collection('players').doc(voterId);
    try {
        await adminDb.runTransaction(async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            const game = gameSnap.data() as Game;
            if (game.phase !== 'day' || game.status === 'finished') return;

            const playerSnap = await transaction.get(playerRef);
            const playerData = playerSnap.data();

            if (!playerData || !playerData.isAlive) throw new Error("Player not found or is not alive");
            
            if (playerData.votedFor) return; // Already voted

            // Client-side handles most of the siren logic UI.
            // The authoritative decision is made in processVotesEngine to ensure server-side enforcement.
            transaction.update(playerRef, { votedFor: targetId });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting vote: ", error);
        return { success: false, error: (error as Error).message || "No se pudo registrar tu voto." };
    }
}

export async function submitJuryVote(gameId: string, voterId: string, targetId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await adminDb.runTransaction(async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) {
                throw new Error("Game not found.");
            }
            const game = gameSnap.data() as Game;

            if (game.phase !== 'jury_voting') {
                throw new Error("No es la fase de voto del jurado.");
            }
            if (game.juryVotes && game.juryVotes[voterId]) {
                return;
            }

            transaction.update(gameRef, { [`juryVotes.${voterId}`]: targetId });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting jury vote: ", error);
        return { success: false, error: (error as Error).message || "No se pudo registrar tu voto del jurado." };
    }
}

export async function sendGhostMessage(gameId: string, ghostId: string, recipientId: string, template: string, subjectId?: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await adminDb.runTransaction(async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;
            const ghostPrivateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(ghostId);
            const ghostPrivateSnap = await transaction.get(ghostPrivateRef);
            const ghostPrivate = ghostPrivateSnap.data();

            if (!ghostPrivate || ghostPrivate.role !== 'ghost' || ghostPrivate.ghostMessageSent) {
                throw new Error("No tienes permiso para realizar esta acción.");
            }
            
            const playersSnap = await transaction.get(gameRef.collection('players'));
            const players = playersSnap.docs.map(doc => doc.data());
            
            const subjectName = subjectId ? players.find(p => p.userId === subjectId)?.displayName : 'alguien';
            const finalMessage = template.replace('{player}', subjectName || 'alguien');

            const ghostEvent: GameEvent = {
                id: `evt_ghost_${Date.now()}`,
                gameId, round: game.currentRound, type: 'special',
                message: `Has recibido un misterioso mensaje desde el más allá: "${finalMessage}"`,
                data: { targetId: recipientId },
                createdAt: new Date(),
            };
            
            transaction.update(ghostPrivateRef, { ghostMessageSent: true });
            transaction.update(gameRef, { events: FieldValue.arrayUnion(toPlainObject(ghostEvent)) });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}


export async function processNight(gameId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await adminDb.runTransaction(async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;
            
            const publicPlayersSnap = await transaction.get(gameRef.collection('players'));
            const publicPlayers = publicPlayersSnap.docs.map(d => d.data());

            const privateDataSnapshots = await transaction.getAll(...publicPlayers.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = publicPlayers.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));

            await processNightEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const updatedGameDoc = await gameRef.get();
        if (updatedGameDoc.exists()) {
            const game = updatedGameDoc.data() as Game;
            
            const aiActions = await import('./firebase-ai-actions');
            
            if (game.phase === 'night') {
                 await aiActions.runNightAIActions(gameId);
            }
            
            if(game.phase === 'day') {
                const latestNightResult = [...game.events]
                    .filter(e => e.type === 'night_result' && e.round === game.currentRound)
                    .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))[0];
                
                if (latestNightResult) {
                    await aiActions.triggerAIReactionToGameEvent(gameId, latestNightResult);
                }
            }
        }
    } catch (e) { console.error("Failed to process night", e); }
}

export async function processVotes(gameId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        const { runAIVotes } = await import('./firebase-ai-actions');
        await runAIVotes(gameId);

        await adminDb.runTransaction(async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            const publicPlayersSnap = await transaction.get(gameRef.collection('players'));
            const publicPlayers = publicPlayersSnap.docs.map(d => d.data());

            const privateDataSnapshots = await transaction.getAll(...publicPlayers.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = publicPlayers.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));
            
            await processVotesEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const updatedGameSnap = await gameRef.get();
        if (updatedGameSnap.exists()) {
            const game = updatedGameSnap.data() as Game;
            const voteEvent = [...game.events]
                .filter(e => e.type === 'vote_result' && e.round === (game.phase === 'night' ? game.currentRound - 1 : game.currentRound))
                .sort((a,b) => getMillis(b.createdAt) - getMillis(a.createdAt))[0];

            const aiActions = await import('./firebase-ai-actions');
            
            if (voteEvent) {
                await aiActions.triggerAIReactionToGameEvent(gameId, voteEvent);
            }

            if (game.phase === 'night') {
                await aiActions.runNightAIActions(gameId);
            }
        }
    } catch (e) { console.error("Failed to process votes", e); }
}

export async function getSeerResult(gameId: string, seerId: string, targetId: string) {
    const privateSeerRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(seerId);
    const privateTargetRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(targetId);
    const targetPublicRef = adminDb.collection('games').doc(gameId).collection('players').doc(targetId);
    const gameRef = adminDb.collection('games').doc(gameId);
    
    try {
        const result = await adminDb.runTransaction(async (transaction) => {
            const [gameSnap, seerSnap, targetSnap, targetPublicSnap] = await transaction.getAll(
                gameRef,
                privateSeerRef,
                privateTargetRef,
                targetPublicRef
            );

            if (!gameSnap.exists()) throw new Error("Game not found");
            const game = gameSnap.data() as Game;

            if (!seerSnap.exists() || !targetSnap.exists() || !targetPublicSnap.exists()) throw new Error("Data not found");

            const seerData = seerSnap.data() as PlayerPrivateData;
            const targetData = targetSnap.data() as PlayerPrivateData;
            const targetPublicData = targetPublicSnap.data() as PlayerPublicData;

            const isSeerOrApprentice = seerData.role === 'seer' || (seerData.role === 'seer_apprentice' && game.seerDied);
            if (!isSeerOrApprentice) throw new Error("No tienes el don de la videncia.");

            // Check if this check has already been performed in this transaction/state
            const existingCheck = seerData.seerChecks?.find(c => c.targetName === targetPublicData.displayName);
            if (existingCheck) {
                return { isWerewolf: existingCheck.isWerewolf, targetName: targetPublicData.displayName };
            }

            const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'lycanthrope'];
            const isWerewolf = !!(targetData.role && wolfRoles.includes(targetData.role));

            const newCheck = { targetName: targetPublicData.displayName, isWerewolf };
            const updatedChecks = [...(seerData.seerChecks || []), newCheck];

            transaction.update(privateSeerRef, { seerChecks: updatedChecks });

            return { isWerewolf, targetName: targetPublicData.displayName };
        });
        
        return { success: true, ...result };
    } catch(e: any) {
        console.error("Error in getSeerResult:", e);
        return { success: false, error: e.message };
    }
}

export async function submitTroublemakerSelection(gameId: string, troublemakerId: string, target1Id: string, target2Id: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await adminDb.runTransaction(async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada");
            let game = gameSnap.data() as Game;
            
            const privateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(troublemakerId);
            const privateSnap = await transaction.get(privateRef);
            const playerPrivate = privateSnap.data();

            if (!playerPrivate || playerPrivate.role !== 'troublemaker' || game.troublemakerUsed) throw new Error("No puedes realizar esta acción.");
            
            transaction.update(gameRef, toPlainObject({
                troublemakerUsed: true,
                pendingTroublemakerDuel: { target1Id, target2Id }
            }));
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function processJuryVotes(gameId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        const aiActions = await import('./firebase-ai-actions');
        await aiActions.runAIJuryVotes(gameId);

        await adminDb.runTransaction(async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;
            
            const publicPlayersSnap = await transaction.get(gameRef.collection('players'));
            const publicPlayers = publicPlayersSnap.docs.map(d => d.data());

            const privateDataSnapshots = await transaction.getAll(...publicPlayers.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = publicPlayers.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));

            await processJuryVotesEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const { runNightAIActions } = await import('./firebase-ai-actions');
        await runNightAIActions(gameId);
    } catch (e) { console.error("Failed to process jury votes", e); }
}

export async function submitHunterShot(gameId: string, hunterId: string, targetId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await adminDb.runTransaction(async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data() as Game;

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId) return;

            const publicPlayersSnap = await transaction.get(gameRef.collection('players'));
            const publicPlayers = publicPlayersSnap.docs.map(d => d.data());
            const targetPlayer = publicPlayers.find(p=>p.userId === targetId);
            
            const privateDataSnapshots = await transaction.getAll(...publicPlayers.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = publicPlayers.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() as PlayerPrivateData }));

            let { updatedGame, updatedPlayers, triggeredHunterId: anotherHunterId } = await killPlayer(transaction, gameRef, game, fullPlayers as Player[], targetId, 'hunter_shot', `En su último aliento, el Cazador dispara y se lleva consigo a ${targetPlayer?.displayName}.`);
            
            // Add notable play event for the hunter
            updatedGame.events.push({
                id: `evt_notable_hunter_${Date.now()}`,
                gameId: game.id,
                round: updatedGame.currentRound,
                type: 'special',
                message: 'El cazador se venga.', // Internal message
                createdAt: new Date(),
                data: {
                  notablePlayerId: hunterId,
                  notablePlay: {
                      title: '¡Última Bala!',
                      description: `Caíste, pero te llevaste a ${targetPlayer?.displayName} contigo.`,
                  },
                },
            });

            if(anotherHunterId) {
                updatedGame.pendingHunterShot = anotherHunterId;
                transaction.update(gameRef, toPlainObject(updatedGame));
            } else {
                 // Game over check or next phase logic
                 const gameOverInfo = await checkGameOver(updatedGame, updatedPlayers);
                 if (gameOverInfo.isGameOver) {
                    updatedGame.status = "finished";
                    updatedGame.phase = "finished";
                    updatedGame.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: updatedGame.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
                 } else {
                     updatedGame.phase = 'day';
                     updatedGame.pendingHunterShot = null;
                 }
                 transaction.update(gameRef, toPlainObject(updatedGame));
            }
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting hunter shot:", error);
        return { success: false, error: (error as Error).message };
    }
}
export async function executeMasterAction(gameId: string, actionId: MasterActionId, sourceId: string | null, targetId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
     try {
        await adminDb.runTransaction(async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            let game = gameDoc.data() as Game;

            const publicPlayersSnap = await transaction.get(gameRef.collection('players'));
            const publicPlayers = publicPlayersSnap.docs.map(p => p.data());
            const targetPlayer = publicPlayers.find(p=>p.userId === targetId);
            
            const privateDataSnapshots = await transaction.getAll(...publicPlayers.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = publicPlayers.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() as PlayerPrivateData }));


            if (actionId === 'master_kill') {
                 if (game.masterKillUsed) throw new Error("El Zarpazo del Destino ya ha sido utilizado.");
                 const { updatedGame } = await killPlayerUnstoppable(transaction, gameRef, game, fullPlayers, targetId, 'special', `Por intervención divina, ${targetPlayer?.displayName} ha sido eliminado.`);
                 game = updatedGame;
                 game.masterKillUsed = true;
            } else {
                const action = masterActions[actionId as keyof typeof masterActions];
                if (action) {
                    const { updatedGame } = action.execute(game, sourceId!, targetId, fullPlayers);
                    game = updatedGame;
                }
            }
            transaction.update(gameRef, toPlainObject(game));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error executing master action:", error);
        return { success: false, error: (error as Error).message };
    }
}

export const sendWolfChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'wolf');
export const sendFairyChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'fairy');
export const sendTwinChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'twin');
export const sendLoversChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'lovers');
export const sendGhostChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'ghost');

    

    

