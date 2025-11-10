
'use client';
import { 
  doc,
  getDoc,
  Timestamp,
  runTransaction,
  type Firestore,
  DocumentReference,
  arrayUnion,
  updateDoc,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type NightAction, 
  type GameEvent, 
  type PlayerRole, 
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
} from './firebase-actions';

export { createGameServer as createGame };
export { startGameServer as startGame };
export { submitHunterShotServer as submitHunterShot };
export { submitTroublemakerActionServer as submitTroublemakerAction };
export { sendWolfChatMessageServer as sendWolfChatMessage };
export { sendFairyChatMessageServer as sendFairyChatMessage };
export { sendLoversChatMessageServer as sendLoversChatMessage };
export { sendTwinChatMessageServer as sendTwinChatMessage };
export { sendGhostChatMessageServer as sendGhostChatMessage };
export { sendChatMessageServer as sendChatMessage };
export { submitVoteServer as submitVote };
export { submitNightActionServer as submitNightAction };
export { submitJuryVoteServer as submitJuryVote };
export { sendGhostMessageServer as sendGhostMessage };
export { joinGameServer as joinGame };

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
