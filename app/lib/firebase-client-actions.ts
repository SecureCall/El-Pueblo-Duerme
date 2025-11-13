
'use client';
import { 
  doc,
  runTransaction,
  type Firestore,
  arrayUnion,
  Timestamp,
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
  sendGhostMessage as sendGhostMessageServer
} from './firebase-actions';

// These functions now call the server action, which contains the full logic.
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


export async function joinGame(
  firestore: Firestore,
  gameId: string,
  userId: string,
  displayName: string,
  avatarUrl: string
) {
  const gameRef = doc(firestore, "games", gameId);
  
  try {
    await runTransaction(firestore, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);

      if (!gameSnap.exists()) {
        throw new Error("Partida no encontrada.");
      }

      const game = gameSnap.data() as Game;

      if (game.status !== "waiting" && !game.players.some(p => p.userId === userId)) {
        throw new Error("Esta partida ya ha comenzado.");
      }
      
      const playerExists = game.players.some(p => p.userId === userId);
      if (playerExists) {
        return; // Player is already in the game, no action needed.
      }
      
      const nameExists = game.players.some(p => p.displayName.trim().toLowerCase() === displayName.trim().toLowerCase());
      if (nameExists) {
        throw new Error("Ese nombre ya está en uso en esta partida.");
      }

      if (game.players.length >= game.maxPlayers) {
        throw new Error("Esta partida está llena.");
      }
      
      const newPlayer: Player = {
          userId,
          gameId,
          displayName: displayName.trim(),
          avatarUrl,
          role: null,
          isAlive: true,
          votedFor: null,
          joinedAt: Timestamp.now(),
          isAI: false,
          isExiled: false,
          lastHealedRound: 0,
          potions: { poison: null, save: null },
          priestSelfHealUsed: false,
          princeRevealed: false,
          guardianSelfProtects: 0,
          biteCount: 0,
          isCultMember: false,
          isLover: false,
          usedNightAbility: false,
          shapeshifterTargetId: null,
          virginiaWoolfTargetId: null,
          riverSirenTargetId: null,
          ghostMessageSent: false,
          resurrectorAngelUsed: false,
          bansheeScreams: {},
          lookoutUsed: false,
          executionerTargetId: null,
          secretObjectiveId: null,
      };

      transaction.update(gameRef, {
        players: arrayUnion(toPlainObject(newPlayer)),
        lastActiveAt: Timestamp.now(),
      });
    });

    return { success: true };

  } catch(error: any) {
    console.error("Error joining game:", error);
    return { error: `No se pudo unir a la partida: ${error.message}` };
  }
}

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
    const { firestore: serverFirestore } = getAuthenticatedSdks();
    const gameDoc = await getDoc(doc(serverFirestore, 'games', gameId));
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

// We need this function client-side for getSeerResult, so we need the server-side SDK helper here too
function getAuthenticatedSdks() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  return { auth, firestore, app };
}

// We also need the config on the client for this helper
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "@/lib/firebase-config";

    