
'use server';
import { 
  adminDb,
} from "./server-init";
import { 
  runTransaction,
  FieldValue,
} from "firebase-admin/firestore";
import type { Game, ChatMessage } from "@/types";
import { toPlainObject } from "./utils";


// This file should only contain actions that are specifically designed to be called
// by the AI flows, not by the client-side components.

export async function sendChatMessageForAI(gameId: string, senderId: string, senderName: string, text: string) {
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
