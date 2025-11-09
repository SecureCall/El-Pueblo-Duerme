'use client';
import { 
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  runTransaction,
  type Transaction,
  DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type NightAction, 
  type GameEvent, 
  type PlayerRole, 
  type NightActionType, 
  type ChatMessage,
} from "@/types";
import { toPlainObject } from "./utils";
import { runAIActions } from "./ai-actions";
import { secretObjectives } from "./objectives";
import { getSeerResult as getSeerResultServer, submitHunterShot as submitHunterShotServer, submitTroublemakerAction as submitTroublemakerActionServer, startGame as startGameServer, createGame as createGameServer } from './firebase-actions';


export async function createGame(
  firestore: Firestore,
  options: {
    userId: string;
    displayName: string;
    avatarUrl: string;
    gameName: string;
    maxPlayers: number;
    settings: Game['settings'];
  }
) {
    return createGameServer(options);
}


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
        if (!game.settings.isPublic) {
            throw new Error("Esta es una partida privada y no se puede unir a través de un enlace.");
        }
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
      
      const newPlayer = {
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

export async function submitNightAction(firestore: Firestore, action: Omit<NightAction, 'createdAt'>) {
  const { gameId, playerId, actionType, targetId } = action;
  const gameRef = doc(firestore, 'games', gameId);
  try {
    await runTransaction(firestore, async (transaction) => {
        const gameSnap = await transaction.get(gameRef as DocumentReference<Game>);
        if (!gameSnap.exists()) throw new Error("Game not found");
        
        let game = gameSnap.data()!;
        if (game.phase !== 'night' || game.status === 'finished') return;

        const player = game.players.find(p => p.userId === playerId);
        if (!player || !player.isAlive) throw new Error("Jugador no válido o muerto.");
        if (player.isExiled) throw new Error("Has sido exiliado esta noche y no puedes usar tu habilidad.");
        if (player.usedNightAbility) return;
        
        const newAction: NightAction = { ...action, createdAt: Timestamp.now() };
        
        const updatedPlayers = game.players.map(p => {
          if (p.userId === playerId) {
            let updatedPlayer = { ...p, usedNightAbility: true };
            // Role specific logic that needs to be persisted immediately
             switch (actionType) {
                case 'hechicera_poison':
                    updatedPlayer.potions = { ...updatedPlayer.potions, poison: game.currentRound };
                    break;
                case 'hechicera_save':
                    updatedPlayer.potions = { ...updatedPlayer.potions, save: game.currentRound };
                    break;
                case 'priest_bless':
                    if (targetId === playerId) updatedPlayer.priestSelfHealUsed = true;
                    break;
                case 'guardian_protect':
                     if (targetId === playerId) updatedPlayer.guardianSelfProtects = (updatedPlayer.guardianSelfProtects || 0) + 1;
                    break;
                case 'lookout_spy':
                    updatedPlayer.lookoutUsed = true;
                    break;
                case 'resurrect':
                    updatedPlayer.resurrectorAngelUsed = true;
                    break;
                case 'shapeshifter_select':
                    if(game.currentRound === 1) updatedPlayer.shapeshifterTargetId = targetId;
                    break;
                case 'virginia_woolf_link':
                    if(game.currentRound === 1) updatedPlayer.virginiaWoolfTargetId = targetId;
                    break;
                case 'river_siren_charm':
                     if(game.currentRound === 1) updatedPlayer.riverSirenTargetId = targetId;
                    break;
            }
            return updatedPlayer;
          }
          return p;
        });

        transaction.update(gameRef, { 
          nightActions: arrayUnion(toPlainObject(newAction)), 
          players: toPlainObject(updatedPlayers) 
        });
    });

    return { success: true };

  } catch (error: any) {
    console.error("Error submitting night action: ", error);
    return { success: false, error: error.message || "No se pudo registrar tu acción." };
  }
}

export async function submitVote(firestore: Firestore, gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
    
    try {
       await runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            
            let game = gameSnap.data()!;
            if (game.phase !== 'day' || game.status === 'finished') return;
            
            const playerIndex = game.players.findIndex(p => p.userId === voterId && p.isAlive);
            if (playerIndex === -1) throw new Error("Player not found or is not alive");
            
            if (game.players[playerIndex].votedFor) return;

            const siren = game.players.find(p => p.role === 'river_siren');
            const charmedPlayerId = siren?.riverSirenTargetId;

            if (voterId === charmedPlayerId && siren && siren.isAlive) {
                if (siren.votedFor) {
                    game.players[playerIndex].votedFor = siren.votedFor;
                } else {
                    throw new Error("Debes esperar a que la Sirena vote primero.");
                }
            } else {
                 game.players[playerIndex].votedFor = targetId;
            }
            
            transaction.update(gameRef, { players: toPlainObject(game.players) });
        });
        
        await runAIActions(gameId, 'day');

        return { success: true };

    } catch (error: any) {
        console.error("Error submitting vote: ", error);
        return { error: "No se pudo registrar tu voto." };
    }
}

export async function sendChatMessage(
    firestore: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string
) {
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(firestore, 'games', gameId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;

            if (game.silencedPlayerId === senderId) {
                throw new Error("No puedes hablar, has sido silenciado esta ronda.");
            }
            
            const textLowerCase = text.toLowerCase();
            const mentionedPlayerIds = game.players
                .filter(p => p.isAlive && textLowerCase.includes(p.displayName.toLowerCase()))
                .map(p => p.userId);
            
            const messageData: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId, senderName, text: text.trim(), round: game.currentRound,
                createdAt: Timestamp.now(), mentionedPlayerIds,
            };

            transaction.update(gameRef, { chatMessages: arrayUnion(toPlainObject(messageData)) });
        });
        
        await runAIActions(gameId, 'day');

        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function sendSpecialChatMessage(
    firestore: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    chatType: 'wolf' | 'fairy' | 'lovers' | 'twin' | 'ghost'
) {
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(firestore, 'games', gameId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            
            const sender = game.players.find(p => p.userId === senderId);
            if (!sender) throw new Error("Sender not found.");

            const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
            const fairyRoles: PlayerRole[] = ['seeker_fairy', 'sleeping_fairy'];

            let canSend = false;
            let chatField: keyof Game = 'chatMessages';

            switch (chatType) {
                case 'wolf':
                    if (sender.role && wolfRoles.includes(sender.role)) {
                        canSend = true;
                        chatField = 'wolfChatMessages';
                    }
                    break;
                case 'fairy':
                    if (sender.role && fairyRoles.includes(sender.role) && game.fairiesFound) {
                        canSend = true;
                        chatField = 'fairyChatMessages';
                    }
                    break;
                case 'lovers':
                    if (sender.isLover) {
                        canSend = true;
                        chatField = 'loversChatMessages';
                    }
                    break;
                 case 'twin':
                    if (game.twins?.includes(senderId)) {
                        canSend = true;
                        chatField = 'twinChatMessages';
                    }
                    break;
                case 'ghost':
                    if (!sender.isAlive) {
                        canSend = true;
                        chatField = 'ghostChatMessages';
                    }
                    break;
            }

            if (!canSend) {
                throw new Error("No tienes permiso para enviar mensajes en este chat.");
            }

            const messageData: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId, senderName, text: text.trim(),
                round: game.currentRound, createdAt: Timestamp.now(),
            };

            transaction.update(gameRef, { [chatField]: arrayUnion(toPlainObject(messageData)) });
        });

        return { success: true };

    } catch (error: any) {
        console.error(`Error sending ${chatType} chat message: `, error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function submitJuryVote(firestore: Firestore, gameId: string, jurorId: string, targetId: string) {
    const gameRef = doc(firestore, 'games', gameId);
    try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            if (game.phase !== 'jury_voting') throw new Error("No es momento de votar como jurado.");
            const juror = game.players.find(p => p.userId === jurorId);
            if (!juror || juror.isAlive) throw new Error("Solo los muertos pueden ser jurado.");
            if (game.juryVotes && game.juryVotes[jurorId]) throw new Error("Ya has votado.");

            const updatedJuryVotes = { ...(game.juryVotes || {}), [jurorId]: targetId };
            transaction.update(gameRef, { juryVotes: updatedJuryVotes });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting jury vote:", error);
        return { success: false, error: error.message };
    }
}


export async function sendGhostMessage(firestore: Firestore, gameId: string, ghostId: string, targetId: string, message: string) {
    const gameRef = doc(firestore, 'games', gameId);
    try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;
            const playerIndex = game.players.findIndex(p => p.userId === ghostId);

            if (playerIndex === -1) throw new Error("Player not found.");
            const player = game.players[playerIndex];

            if (player.role !== 'ghost' || player.isAlive || player.ghostMessageSent) {
                throw new Error("No tienes permiso para realizar esta acción.");
            }

            const ghostEvent: GameEvent = {
                id: `evt_ghost_${Date.now()}`, gameId, round: game.currentRound, type: 'special',
                message: `Has recibido un misterioso mensaje desde el más allá: "${message}"`,
                createdAt: Timestamp.now(), data: { targetId: targetId, originalMessage: message },
            };

            game.players[playerIndex].ghostMessageSent = true;
            game.events.push(ghostEvent);

            transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events }));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error sending ghost message:", error);
        return { success: false, error: error.message || "No se pudo enviar el mensaje." };
    }
}


// These are server-only actions that need a client-side proxy to be called from a client component.
// We use dynamic imports to call the server actions.
export async function getSeerResult(firestore: Firestore, gameId: string, seerId: string, targetId: string) {
    return getSeerResultServer(gameId, seerId, targetId);
}

export async function submitHunterShot(firestore: Firestore, gameId: string, hunterId: string, targetId: string) {
   return submitHunterShotServer(gameId, hunterId, targetId);
}

export async function submitTroublemakerAction(firestore: Firestore, gameId: string, troublemakerId: string, target1Id: string, target2Id: string) {
    return submitTroublemakerActionServer(gameId, troublemakerId, target1Id, target2Id);
}

export async function startGame(firestore: Firestore, gameId: string, creatorId: string) {
    return startGameServer(gameId, creatorId);
}
