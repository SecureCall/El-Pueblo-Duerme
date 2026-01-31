
'use server';
import { 
  Timestamp,
  runTransaction,
  FieldValue,
} from "firebase-admin/firestore";
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
import { getAdminDb } from "./firebase-admin";
import { toPlainObject } from "./utils";

async function sendSpecialChatMessage(gameId: string, senderId: string, senderName: string, text: string, chatType: 'wolf' | 'fairy' | 'twin' | 'lovers' | 'ghost' ) {
    const adminDb = getAdminDb();
    if (!text?.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };
    const gameRef = adminDb.collection('games').doc(gameId);

    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;

            const privateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(senderId);
            const privateSnap = await transaction.get(privateRef);
            const privateData = privateSnap.data();
            
            let canSend = false;
            let chatField: keyof Game = 'chatMessages';

            switch (chatType) {
                case 'wolf':
                    if (privateData?.role && ['werewolf', 'wolf_cub'].includes(privateData.role)) {
                        canSend = true; chatField = 'wolfChatMessages';
                    }
                    break;
                case 'fairy':
                    if (game.fairiesFound && privateData?.role && ['seeker_fairy', 'sleeping_fairy'].includes(privateData.role)) {
                        canSend = true; chatField = 'fairyChatMessages';
                    }
                    break;
                case 'twin':
                     if (game.twins?.includes(senderId)) {
                        canSend = true; chatField = 'twinChatMessages';
                     }
                    break;
                case 'lovers':
                    if (privateData?.isLover) {
                        canSend = true; chatField = 'loversChatMessages';
                    }
                    break;
                case 'ghost':
                    const publicPlayer = game.players.find(p => p.userId === senderId);
                    if (publicPlayer && !publicPlayer.isAlive) {
                         canSend = true; chatField = 'ghostChatMessages';
                    }
                    break;
            }

            if (!canSend) throw new Error("No tienes permiso para enviar mensajes en este chat.");
            
            const messageData: ChatMessage = {id: `${Date.now()}_${senderId}`, senderId, senderName, text: text.trim(), round: game.currentRound, createdAt: new Date() };
            transaction.update(gameRef, { [chatField]: FieldValue.arrayUnion(toPlainObject(messageData)) });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function sendChatMessageForAI(gameId: string, senderId: string, senderName: string, text: string) {
    const adminDb = getAdminDb();
    if (!text?.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };
    const gameRef = adminDb.collection('games').doc(gameId);

    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            
            const mentionedPlayerIds = game.players.filter(p => p.isAlive && text.toLowerCase().includes(p.displayName.toLowerCase())).map(p => p.userId);
            const messageData: ChatMessage = {id: `${Date.now()}_${senderId}`, senderId, senderName, text: text.trim(), round: game.currentRound, createdAt: new Date(), mentionedPlayerIds};
            transaction.update(gameRef, { chatMessages: FieldValue.arrayUnion(toPlainObject(messageData)) });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error sending AI chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}


export async function submitNightAction(data: {gameId: string, round: number, playerId: string, actionType: NightActionType, targetId: string}) {
    const adminDb = getAdminDb();
    const { gameId, playerId, actionType, targetId } = data;
    const gameRef = adminDb.collection('games').doc(gameId);
    const privateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(playerId);

    try {
        await runTransaction(adminDb, async (transaction) => {
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
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            const game = gameSnap.data() as Game;
            if (game.phase !== 'day' || game.status === 'finished') return;

            const playerIndex = game.players.findIndex(p => p.userId === voterId && p.isAlive);
            if (playerIndex === -1) throw new Error("Player not found or is not alive");
            
            if (game.players[playerIndex].votedFor) return; // Already voted

            // Client-side handles most of the siren logic UI.
            // The authoritative decision is made in processVotesEngine to ensure server-side enforcement.
            game.players[playerIndex].votedFor = targetId;
            transaction.update(gameRef, { players: toPlainObject(game.players) });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting vote: ", error);
        return { success: false, error: (error as Error).message || "No se pudo registrar tu voto." };
    }
}

export async function submitJuryVote(gameId: string, voterId: string, targetId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await gameRef.update({ [`juryVotes.${voterId}`]: targetId });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function sendGhostMessage(gameId: string, ghostId: string, recipientId: string, template: string, subjectId?: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;
            const ghostPrivateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(ghostId);
            const ghostPrivateSnap = await transaction.get(ghostPrivateRef);
            const ghostPrivate = ghostPrivateSnap.data();

            if (!ghostPrivate || ghostPrivate.role !== 'ghost' || ghostPrivate.ghostMessageSent) {
                throw new Error("No tienes permiso para realizar esta acción.");
            }
            
            const subjectName = subjectId ? game.players.find(p => p.userId === subjectId)?.displayName : 'alguien';
            const finalMessage = template.replace('{player}', subjectName || 'alguien');

            const ghostEvent: GameEvent = {
                id: `evt_ghost_${Date.now()}`, gameId, round: game.currentRound, type: 'special',
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

export const sendWolfChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'wolf');
export const sendFairyChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'fairy');
export const sendTwinChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'twin');
export const sendLoversChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'lovers');
export const sendGhostChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'ghost');
