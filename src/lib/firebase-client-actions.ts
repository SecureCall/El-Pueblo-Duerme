
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
  type AIPlayerPerspective
} from "@/types";
import { toPlainObject } from "./utils";
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { runAIActions, triggerAIChat } from "./ai-actions";
import { getSdks } from "@/firebase/server-init";
import { killPlayerUnstoppable, checkGameOver, killPlayer } from "./game-engine";

const createPlayerObject = (userId: string, gameId: string, displayName: string, avatarUrl: string, isAI: boolean = false): Player => ({
    userId,
    gameId,
    displayName: displayName.trim(),
    avatarUrl,
    role: null,
    isAlive: true,
    votedFor: null,
    joinedAt: Timestamp.now(),
    isAI,
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
});

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
      
      const newPlayer = createPlayerObject(userId, gameId, displayName, avatarUrl, false);
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

export async function submitNightAction(action: Omit<NightAction, 'createdAt'>) {
  const { firestore } = getSdks();
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

    await runAIActions(gameId);
    return { success: true };

  } catch (error: any) {
    console.error("Error submitting night action: ", error);
    return { success: false, error: error.message || "No se pudo registrar tu acción." };
  }
}

export async function getSeerResult(db: Firestore, gameId: string, seerId: string, targetId: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) throw new Error("Game not found");
        const game = gameDoc.data() as Game;

        const seerPlayer = game.players.find(p => p.userId === seerId);
        if (!seerPlayer || (seerPlayer.role !== 'seer' && !(seerPlayer.role === 'seer_apprentice' && game.seerDied))) {
            throw new Error("No tienes el don de la videncia.");
        }

        const targetPlayer = game.players.find(p => p.userId === targetId);
        if (!targetPlayer) throw new Error("Target player not found");

        const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed'];
        const isWerewolf = !!(targetPlayer.role && (wolfRoles.includes(targetPlayer.role) || targetPlayer.role === 'lycanthrope'));

        return { success: true, isWerewolf, targetName: targetPlayer.displayName };
    } catch (error: any) {
        console.error("Error getting seer result: ", error);
        return { success: false, error: error.message };
    }
}

export async function submitHunterShot(gameId: string, hunterId: string, targetId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;

    try {
        await runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data()!;
            
            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId || game.status === 'finished') {
                return;
            }

            const { updatedGame, triggeredHunterId: newTriggeredHunter } = await killPlayer(transaction, gameRef, game, targetId, 'hunter_shot');
            
            game = updatedGame;
            
            game.events.push({
                id: `evt_huntershot_${Date.now()}`, gameId, round: game.currentRound, type: 'hunter_shot',
                message: `En su último aliento, ${game.players.find(p=>p.userId === hunterId)?.displayName} dispara y se lleva consigo a ${game.players.find(p=>p.userId === targetId)?.displayName}.`,
                createdAt: Timestamp.now(), data: {killedPlayerIds: [targetId]},
            });

            if (newTriggeredHunter) {
                game.pendingHunterShot = newTriggeredHunter;
                transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
                return;
            }
            
            const gameOverInfo = await checkGameOver(game, null);
            if (gameOverInfo.isGameOver) {
                game.status = "finished";
                game.phase = "finished";
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
                transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events }));
                return;
            }
            
            const hunterDeathEvent = [...game.events].sort((a, b) => toPlainObject(b.createdAt).getTime() - toPlainObject(a.createdAt).getTime()).find(e => (e.data?.killedPlayerIds?.includes(hunterId) || e.data?.lynchedPlayerId === hunterId));
            
            const nextPhase = hunterDeathEvent?.type === 'vote_result' ? 'night' : 'day';
            const currentRound = game.currentRound;
            const newRound = nextPhase === 'night' ? currentRound + 1 : currentRound;

            game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; p.isExiled = false; });
            const PHASE_DURATION_SECONDS = 60;
            const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
            
            transaction.update(gameRef, toPlainObject({
                players: game.players, events: game.events, phase: nextPhase, phaseEndsAt,
                currentRound: newRound, pendingHunterShot: null
            }));
        });
        return { success: true };
    } catch (error: any) {
        console.error("CRITICAL ERROR in submitHunterShot: ", error);
        return { success: false, error: error.message || "No se pudo registrar el disparo." };
    }
}

export async function submitVote(gameId: string, voterId: string, targetId: string) {
    const { firestore } = getSdks();
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
        
        await triggerAIChat(gameId, `${voterId} ha votado por ${targetId}`, 'public');

        return { success: true };

    } catch (error: any) {
        console.error("Error submitting vote: ", error);
        return { error: "No se pudo registrar tu voto." };
    }
}

export async function sendChatMessage(
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    isFromAI: boolean = false
) {
    const { firestore } = getSdks();
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

        if (!isFromAI) {
            await triggerAIChat(gameId, `${senderName} dijo: "${text.trim()}"`, 'public');
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function sendSpecialChatMessage(
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    chatType: 'wolf' | 'fairy' | 'lovers' | 'twin' | 'ghost'
) {
    const { firestore } = getSdks();
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

export const sendWolfChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'wolf');
export const sendFairyChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'fairy');
export const sendLoversChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'lovers');
export const sendTwinChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'twin');
export const sendGhostChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'ghost');


export async function submitJuryVote(gameId: string, jurorId: string, targetId: string) {
    const { firestore } = getSdks();
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

export async function submitTroublemakerAction(gameId: string, troublemakerId: string, target1Id: string, target2Id: string) {
  const { firestore } = getSdks();
  const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
  
  try {
    await runTransaction(firestore, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists()) throw new Error("Partida no encontrada");
      let game = gameSnap.data()!;

      if (game.status === 'finished') return;

      const player = game.players.find(p => p.userId === troublemakerId);
      if (!player || player.role !== 'troublemaker' || game.troublemakerUsed) {
        throw new Error("No puedes realizar esta acción.");
      }

      const target1 = game.players.find(p => p.userId === target1Id);
      const target2 = game.players.find(p => p.userId === target2Id);

      if (!target1 || !target2 || !target1.isAlive || !target2.isAlive) {
        throw new Error("Los objetivos seleccionados no son válidos.");
      }
      
      let { updatedGame } = await killPlayerUnstoppable(transaction, gameRef as DocumentReference<Game>, game, target1Id, 'troublemaker_duel');
      game = updatedGame;
      
      let finalResult = await killPlayerUnstoppable(transaction, gameRef as DocumentReference<Game>, game, target2Id, 'troublemaker_duel');
      game = finalResult.updatedGame;

      game.events.push({
        id: `evt_trouble_${Date.now()}`, gameId, round: game.currentRound, type: 'special',
        message: `${player.displayName} ha provocado una pelea mortal. ${target1.displayName} y ${target2.displayName} han sido eliminados.`,
        createdAt: Timestamp.now(), data: { killedPlayerIds: [target1Id, target2Id] }
      });
      game.troublemakerUsed = true;
      
      transaction.update(gameRef, toPlainObject(game));
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error submitting troublemaker action:", error);
    return { success: false, error: error.message || "No se pudo realizar la acción." };
  }
}

export async function sendGhostMessage(gameId: string, ghostId: string, targetId: string, message: string) {
    const { firestore } = getSdks();
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
