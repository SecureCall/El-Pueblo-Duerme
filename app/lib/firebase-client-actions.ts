
'use client';
import { 
  doc,
  runTransaction,
  type Firestore,
  arrayUnion,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type NightActionType
} from "@/types";
import { toPlainObject } from "./utils";
import { 
  createGame as createGameServer, 
  startGame as startGameServer, 
  submitHunterShot as submitHunterShotServer,
  submitTroublemakerAction as submitTroublemakerActionServer,
  sendWolfChatMessage as sendWolfChatMessageServer,
  sendFairyChatMessage as sendFairyChatMessageServer,
  sendLoversChatMessage as sendLoversChatMessageServer,
  sendTwinChatMessage as sendTwinChatMessageServer,
  sendGhostChatMessage as sendGhostChatMessageServer,
  sendChatMessage as sendChatMessageServer,
  submitVote as submitVoteServer,
  submitNightAction as submitNightActionServer,
  submitJuryVote as submitJuryVoteServer,
  sendGhostMessage as sendGhostMessageServer,
  joinGame as joinGameServer,
  resetGame as resetGameServer,
  processNight as processNightServer,
  processVotes as processVotesServer,
  processJuryVotes as processJuryVotesServer,
  executeMasterAction as executeMasterActionServer
} from './firebase-actions'; // <-- RUTA CORREGIDA

// Re-export server actions to be used in client components.
// This pattern helps separate server-only logic from client-callable functions.
export const createGame = createGameServer;
export const startGame = startGameServer;
export const joinGame = joinGameServer;
export const resetGame = resetGameServer;
export const submitHunterShot = submitHunterShotServer;
export const submitTroublemakerAction = submitTroublemakerActionServer;
export const sendWolfChatMessage = sendWolfChatMessageServer;
export const sendFairyChatMessage = sendFairyChatMessageServer;
export const sendLoversChatMessage = sendLoversChatMessageServer;
export const sendTwinChatMessage = sendTwinChatMessageServer;
export const sendGhostChatMessage = sendGhostChatMessageServer;
export const sendChatMessage = sendChatMessageServer;
export const submitVote = submitVoteServer;
export const submitNightAction = submitNightActionServer;
export const submitJuryVote = submitJuryVoteServer;
export const sendGhostMessage = sendGhostMessageServer;
export const processNight = processNightServer;
export const processVotes = processVotesServer;
export const processJuryVotes = processJuryVotesServer;
export const executeMasterAction = executeMasterActionServer;


export async function updatePlayerAvatar(firestore: Firestore, gameId: string, userId: string, newAvatarUrl: string) {
    const gameRef = doc(firestore, 'games', gameId);
    try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found.");

            const gameData = gameDoc.data() as Game;
            const playerIndex = gameData.players.findIndex(p => p.userId === userId);

            if (playerIndex === -1) throw new Error("Player not found in game.");

            const updatedPlayers = [...gameData.players];
            updatedPlayers[playerIndex].avatarUrl = newAvatarUrl;

            transaction.update(gameRef, { players: toPlainObject(updatedPlayers), lastActiveAt: Timestamp.now() });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating player avatar:", error);
        return { success: false, error: error.message };
    }
}


export async function getSeerResult(firestore: Firestore, gameId: string, seerId: string, targetId: string) {
    const gameDoc = await getDoc(doc(firestore, 'games', gameId));
    if (!gameDoc.exists()) throw new Error("Game not found");
    const game = gameDoc.data() as Game;

    const seerPlayer = game.players.find(p => p.userId === seerId);
    if (!seerPlayer || (seerPlayer.role !== 'seer' && !(seerPlayer.role === 'seer_apprentice' && game.seerDied))) {
        throw new Error("No tienes el don de la videncia.");
    }

    const targetPlayer = game.players.find(p => p.userId === targetId);
    if (!targetPlayer) throw new Error("Target player not found");

    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed'];
    const isWerewolf = !!(targetPlayer.role && (wolfRoles.includes(targetPlayer.role) || (targetPlayer.role === 'lycanthrope' && game.settings.lycanthrope)));

    return { success: true, isWerewolf, targetName: targetPlayer.displayName };
}
