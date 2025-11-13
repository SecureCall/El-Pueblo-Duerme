
'use client';
import { 
  doc,
  runTransaction,
  type Firestore,
  arrayUnion,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
} from "@/types";
import { toPlainObject } from "./utils";

// These actions are explicitly client-side and require a Firestore instance from the client.
// They typically handle real-time interactions or initial setup that depends on the client's auth state.

export { 
  createGame,
  startGame,
  sendChatMessage,
  sendWolfChatMessage,
  sendFairyChatMessage,
  sendLoversChatMessage,
  sendTwinChatMessage,
  sendGhostChatMessage,
  submitNightAction,
  submitVote,
  submitJuryVote,
  submitHunterShot,
  submitTroublemakerAction,
  sendGhostMessage
} from './firebase-actions';


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
