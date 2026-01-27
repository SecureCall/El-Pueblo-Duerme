
'use server';
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
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type NightAction, 
  type GameEvent, 
  type PlayerRole, 
  type NightActionType, 
  type ChatMessage,
  type AIPlayerPerspective,
  type PlayerPublicData,
  type PlayerPrivateData
} from "@/types";
import { toPlainObject, getMillis, sanitizeHTML } from "./utils";
import { masterActions } from "./master-actions";
import { secretObjectives } from "./objectives";
import { processJuryVotesEngine, killPlayer, killPlayerUnstoppable, checkGameOver, processVotesEngine, processNightEngine, generateRoles } from './game-engine';
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { runAIActions, runAIHunterShot } from "./ai-actions";
import { adminDb } from './firebase-admin';


const PHASE_DURATION_SECONDS = 60;

function generateGameId(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const createPlayerObject = (userId: string, gameId: string, displayName: string, avatarUrl: string, isAI: boolean = false): Player => ({
    userId,
    gameId,
    displayName: sanitizeHTML(displayName.trim()),
    avatarUrl,
    role: null,
    isAlive: true,
    votedFor: null,
    joinedAt: Timestamp.now(),
    lastActiveAt: Timestamp.now(),
    isAI,
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
    bansheePoints: 0,
    lookoutUsed: false,
    executionerTargetId: null,
    secretObjectiveId: null,
});

function splitPlayerData(player: Player): { publicData: PlayerPublicData, privateData: PlayerPrivateData } {
  const { 
    userId, gameId, displayName, avatarUrl, isAlive, isAI, 
    princeRevealed, joinedAt, votedFor, lastActiveAt,
    // Explicitly destructure private fields to exclude them from public data
    role, secretObjectiveId, executionerTargetId, potions, priestSelfHealUsed, guardianSelfProtects,
    usedNightAbility, shapeshifterTargetId, virginiaWoolfTargetId, riverSirenTargetId,
    ghostMessageSent, resurrectorAngelUsed, bansheeScreams, bansheePoints, lookoutUsed, lastHealedRound,
    isCultMember, isLover, biteCount
  } = player;

  const publicData: PlayerPublicData = {
    userId, gameId, displayName, avatarUrl, isAlive, isAI,
    princeRevealed, joinedAt, votedFor, lastActiveAt
  };

  const privateData: PlayerPrivateData = {
    role,
    secretObjectiveId,
    executionerTargetId,
    potions,
    priestSelfHealUsed,
    guardianSelfProtects,
    usedNightAbility,
    shapeshifterTargetId,
    virginiaWoolfTargetId,
    riverSirenTargetId,
    ghostMessageSent,
    resurrectorAngelUsed,
    bansheeScreams,
    bansheePoints,
    lookoutUsed,
    lastHealedRound,
    isCultMember,
    isLover,
    biteCount,
  };

  return { publicData, privateData };
}


export async function createGame(
  options: {
    userId: string;
    displayName: string;
    avatarUrl: string;
    gameName: string;
    maxPlayers: number;
    settings: Game['settings'];
  }
) {
  const { userId, displayName, avatarUrl, gameName, maxPlayers, settings } = options;

  if (!userId || !displayName.trim() || !gameName.trim()) {
    return { error: "Datos incompletos para crear la partida." };
  }
  if (maxPlayers < 3 || maxPlayers > 32) {
    return { error: "El número de jugadores debe ser entre 3 y 32." };
  }

  const gameId = generateGameId();
  const gameRef = doc(adminDb, "games", gameId);
      
  const creatorPlayer = createPlayerObject(userId, gameId, displayName, avatarUrl, false);
  const { publicData, privateData } = splitPlayerData(creatorPlayer);

  const gameData: Game = {
      id: gameId,
      name: sanitizeHTML(gameName.trim()),
      status: "waiting",
      phase: "waiting", 
      creator: userId,
      players: [publicData], 
      events: [],
      chatMessages: [],
      wolfChatMessages: [],
      fairyChatMessages: [],
      twinChatMessages: [],
      loversChatMessages: [],
      ghostChatMessages: [],
      maxPlayers: maxPlayers,
      createdAt: Timestamp.now(),
      lastActiveAt: Timestamp.now(),
      currentRound: 0,
      settings,
      phaseEndsAt: Timestamp.now(),
      pendingHunterShot: null,
      twins: null,
      lovers: null,
      wolfCubRevengeRound: 0,
      nightActions: [],
      vampireKills: 0,
      boat: [],
      leprosaBlockedRound: 0,
      witchFoundSeer: false,
      seerDied: false,
      silencedPlayerId: null,
      exiledPlayerId: null,
      troublemakerUsed: false,
      fairiesFound: false,
      fairyKillUsed: false,
      juryVotes: {},
      masterKillUsed: false,
  };
    
  try {
    const creatorPrivateRef = doc(adminDb, `games/${gameId}/playerData/${userId}`);
    
    await runTransaction(adminDb, async (transaction) => {
        transaction.set(gameRef, toPlainObject(gameData));
        transaction.set(creatorPrivateRef, toPlainObject(privateData));
    });

    return { gameId };
  } catch (error: any) {
    console.error("--- CATASTROPHIC ERROR IN createGame ---", error);
    return { error: `Error de servidor: ${error.message || 'Error desconocido al crear la partida.'}` };
  }
}

export async function joinGame(
  options: {
    gameId: string;
    userId: string;
    displayName: string;
    avatarUrl: string;
  }
) {
  const { gameId, userId, displayName, avatarUrl } = options;
  const gameRef = doc(adminDb, "games", gameId);
  
  try {
    await runTransaction(adminDb, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);

      if (!gameSnap.exists()) {
        throw new Error("Partida no encontrada.");
      }

      const game = gameSnap.data() as Game;

      if (game.status !== "waiting" && !game.players.some(p => p.userId === userId)) {
        throw new Error("Esta partida ya ha comenzado.");
      }
      
      const playerIndex = game.players.findIndex(p => p.userId === userId);
      if (playerIndex !== -1) {
          const updatedPlayers = [...game.players];
          let changed = false;
          if (updatedPlayers[playerIndex].displayName !== displayName) {
            updatedPlayers[playerIndex].displayName = displayName;
            changed = true;
          }
          if (updatedPlayers[playerIndex].avatarUrl !== avatarUrl) {
            updatedPlayers[playerIndex].avatarUrl = avatarUrl;
            changed = true;
          }
          if (changed) {
            updatedPlayers[playerIndex].lastActiveAt = Timestamp.now();
            transaction.update(gameRef, { players: toPlainObject(updatedPlayers) });
          }
          return;
      }
      
      const nameExists = game.players.some(p => p.displayName.trim().toLowerCase() === displayName.trim().toLowerCase());
      if (nameExists) {
        throw new Error("Ese nombre ya está en uso en esta partida.");
      }

      if (game.players.length >= game.maxPlayers) {
        throw new Error("Esta partida está llena.");
      }
      
      const newPlayer = createPlayerObject(userId, gameId, displayName, avatarUrl, false);
      const { publicData, privateData } = splitPlayerData(newPlayer);
      const playerPrivateRef = doc(adminDb, `games/${gameId}/playerData/${userId}`);

      transaction.update(gameRef, {
        players: arrayUnion(toPlainObject(publicData)),
        lastActiveAt: Timestamp.now(),
      });
      transaction.set(playerPrivateRef, toPlainObject(privateData));
    });

    return { success: true };

  } catch(error: any) {
    console.error("Error joining game:", error);
    return { error: `No se pudo unir a la partida: ${error.message}` };
  }
}


const AI_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jessie", "Jamie", "Kai", "Rowan"];
const MINIMUM_PLAYERS = 3;

export async function startGame(gameId: string, creatorId: string) {
    const gameRef = doc(adminDb, 'games', gameId);
    
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error('Partida no encontrada.');
            let game = gameSnap.data() as Game;
            if (game.creator !== creatorId) throw new Error('Solo el creador puede iniciar la partida.');
            if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado.');
            
            const playerDocs = await Promise.all(game.players.map(p => transaction.get(doc(adminDb, `games/${gameId}/playerData/${p.userId}`))));
            let allPlayersFullData: Player[] = game.players.map((publicPlayer, index) => {
                const privateData = playerDocs[index]?.data() as PlayerPrivateData | null;
                return { ...publicPlayer, ...privateData } as Player;
            });
            
            if (game.settings.fillWithAI && allPlayersFullData.length < game.maxPlayers) {
                const aiPlayerCount = game.maxPlayers - allPlayersFullData.length;
                const availableAINames = AI_NAMES.filter(name => !allPlayersFullData.some(p => p.displayName === name));
                for (let i = 0; i < aiPlayerCount; i++) {
                    const aiUserId = `ai_${Date.now()}_${i}`;
                    const aiName = availableAINames[i % availableAINames.length] || `Bot ${i + 1}`;
                    const aiAvatar = `/logo.png`;
                    const aiPlayerData = createPlayerObject(aiUserId, gameId, aiName, aiAvatar, true);
                    allPlayersFullData.push(aiPlayerData);
                }
            }
            
            const totalPlayers = allPlayersFullData.length;
            if (totalPlayers < MINIMUM_PLAYERS) throw new Error(`Se necesitan al menos ${MINIMUM_PLAYERS} jugadores para comenzar.`);
            
            const newRoles = generateRoles(totalPlayers, game.settings);
            
            let finalPlayersWithRoles = allPlayersFullData.map((player, index) => {
                const p = { ...player, role: newRoles[index] };
                if (p.role === 'cult_leader') p.isCultMember = true;
                if (!p.isAI) {
                    const applicableObjectives = secretObjectives.filter(obj => 
                        obj.appliesTo.includes('any') || (p.role && obj.appliesTo.includes(p.role))
                    );
                    if (applicableObjectives.length > 0) {
                        p.secretObjectiveId = applicableObjectives[Math.floor(Math.random() * applicableObjectives.length)].id;
                    }
                }
                return p;
            });
            
            const executioner = finalPlayersWithRoles.find(p => p.role === 'executioner');
            if (executioner) {
                const wolfTeamRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch'];
                const nonWolfPlayers = finalPlayersWithRoles.filter(p => p.role && !wolfTeamRoles.includes(p.role) && p.userId !== executioner.userId);
                if (nonWolfPlayers.length > 0) {
                    const target = nonWolfPlayers[Math.floor(Math.random() * nonWolfPlayers.length)];
                    const executionerIndex = finalPlayersWithRoles.findIndex(p => p.userId === executioner.userId);
                    if (executionerIndex > -1) {
                        finalPlayersWithRoles[executionerIndex].executionerTargetId = target.userId;
                    }
                }
            }

            const twinUserIds = finalPlayersWithRoles.filter(p => p.role === 'twin').map(p => p.userId);
            
            const publicPlayersData: PlayerPublicData[] = [];
            finalPlayersWithRoles.forEach(player => {
                const { publicData, privateData } = splitPlayerData(player);
                publicPlayersData.push(publicData);
                const playerPrivateRef = doc(adminDb, `games/${gameId}/playerData/${player.userId}`);
                transaction.set(playerPrivateRef, toPlainObject(privateData), { merge: true });
            });

            transaction.update(gameRef, toPlainObject({
                players: publicPlayersData,
                twins: twinUserIds.length === 2 ? [twinUserIds[0], twinUserIds[1]] as [string, string] : null,
                status: 'in_progress',
                phase: 'role_reveal',
                currentRound: 0,
            }));
        });
        
        // Schedule first night
        setTimeout(() => {
            processNight(gameId);
        }, 15000);


        return { success: true };

    } catch (e: any) {
        console.error("Error starting game:", e);
        return { error: e.message || 'Error al iniciar la partida.' };
    }
}

async function getFullPlayers(gameId: string, game: Game, transaction?: Transaction): Promise<Player[]> {
    const getPrivateData = async (userId: string) => {
        const playerPrivateRef = doc(adminDb, 'games', gameId, 'playerData', userId);
        const snap = transaction ? await transaction.get(playerPrivateRef) : await getDoc(playerPrivateRef);
        return snap.exists() ? (snap.data() as PlayerPrivateData) : null;
    };

    const fullPlayers: Player[] = await Promise.all(
        game.players.map(async (publicData) => {
            const privateData = await getPrivateData(publicData.userId);
            return { ...publicData, ...privateData } as Player;
        })
    );

    return fullPlayers;
}


export async function processNight(gameId: string) {
    const gameRef = doc(adminDb, 'games', gameId) as DocumentReference<Game>;
    try {
        let nightResultEvent: GameEvent | undefined;
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found!");
            const game = gameSnap.data()!;
            const fullPlayers = await getFullPlayers(gameId, game, transaction);
            const { nightEvent } = await processNightEngine(transaction, gameRef, game, fullPlayers);
            nightResultEvent = nightEvent;
        });
        
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists()) {
            const game = gameDoc.data();
            if (game.phase === 'day') {
                if (nightResultEvent) {
                    await triggerAIChat(gameId, nightResultEvent.message, 'public');
                }
                await runAIActions(gameId, 'day');
            } else if (game.phase === 'night') { // This would be the first night
                await runAIActions(gameId, 'night');
            }
        }

    } catch (e) {
        console.error("Failed to process night", e);
    }
}

export async function processVotes(gameId: string) {
    const gameRef = doc(adminDb, 'games', gameId) as DocumentReference<Game>;
    try {
        let voteResultEvent: GameEvent | undefined;
        await runTransaction(adminDb, async (transaction) => {
             const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found!");
            const game = gameSnap.data()!;
            const fullPlayers = await getFullPlayers(gameId, game, transaction);
            const result = await processVotesEngine(transaction, gameRef, game, fullPlayers);
            voteResultEvent = result.voteEvent;
        });

        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists()) {
            const game = gameDoc.data();
            if (voteResultEvent) {
                 await triggerAIChat(gameId, voteResultEvent.message, 'public');
            }
            if (game.phase === 'night') {
                await runAIActions(gameId, 'night');
            } else if (game.phase === 'hunter_shot') {
                await runAIHunterShot(gameId);
            }
        }
    } catch (e) {
        console.error("Failed to process votes", e);
    }
}

export async function resetGame(gameId: string) {
  const gameRef = doc(adminDb, 'games', gameId);

  try {
      await runTransaction(adminDb, async (transaction) => {
          const gameSnap = await transaction.get(gameRef);
          if (!gameSnap.exists()) throw new Error("Partida no encontrada.");
          const game = gameSnap.data() as Game;

          const humanPlayers = game.players.filter(p => !p.isAI);
          
          const privateDataRef = collection(adminDb, `games/${gameId}/playerData`);
          const privateDocs = await getDocs(privateDataRef);
          privateDocs.forEach(doc => {
              if(!humanPlayers.some(p => p.userId === doc.id)){
                  transaction.delete(doc.ref);
              }
          });

          for(const player of humanPlayers) {
              const playerRef = doc(adminDb, `games/${gameId}/playerData/${player.userId}`);
              const newPlayer = createPlayerObject(player.userId, game.id, player.displayName, player.avatarUrl, player.isAI);
              const { privateData } = splitPlayerData(newPlayer);
              transaction.set(playerRef, toPlainObject(privateData));
          }

          transaction.update(gameRef, toPlainObject({
              status: 'waiting', phase: 'waiting', currentRound: 0,
              players: humanPlayers,
              events: [], chatMessages: [], wolfChatMessages: [], fairyChatMessages: [],
              twinChatMessages: [], loversChatMessages: [], ghostChatMessages: [], nightActions: [],
              twins: null, lovers: null, phaseEndsAt: Timestamp.now(), pendingHunterShot: null,
              wolfCubRevengeRound: 0, vampireKills: 0, boat: [],
              leprosaBlockedRound: 0, witchFoundSeer: false, seerDied: false,
              silencedPlayerId: null, exiledPlayerId: null, troublemakerUsed: false,
              fairiesFound: false, fairyKillUsed: false, juryVotes: {}, masterKillUsed: false
          }));
      });
      return { success: true };
  } catch (e: any) {
      console.error("Error resetting game:", e);
      return { error: e.message || 'No se pudo reiniciar la partida.' };
  }
}

export async function sendChatMessage(
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    isFromAI: boolean = false
) {
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(adminDb, 'games', gameId);
    const sanitizedText = sanitizeHTML(text.trim());

    try {
        let latestGame: Game | null = null;
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            latestGame = game;

            const playerIndex = game.players.findIndex(p => p.userId === senderId);
            if (playerIndex === -1) throw new Error("Player not found");
            
            const updatedPlayers = [...game.players];
            updatedPlayers[playerIndex].lastActiveAt = Timestamp.now();

            if (game.silencedPlayerId === senderId) {
                throw new Error("No puedes hablar, has sido silenciado esta ronda.");
            }
            
            const textLowerCase = sanitizedText.toLowerCase();
            const mentionedPlayerIds = game.players
                .filter(p => p.isAlive && textLowerCase.includes(p.displayName.toLowerCase()))
                .map(p => p.userId);
            
            const messageData: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId, senderName, text: sanitizedText, round: game.currentRound,
                createdAt: Timestamp.now(), mentionedPlayerIds,
            };

            transaction.update(gameRef, { 
                chatMessages: arrayUnion(toPlainObject(messageData)),
                players: toPlainObject(updatedPlayers) 
            });
        });

        if (!isFromAI && latestGame) {
            const triggerMessage = `${senderName} dijo: "${sanitizedText}"`;
            await triggerAIChat(gameId, triggerMessage, 'public');
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

async function sendSpecialChatMessage(
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    chatType: 'wolf' | 'fairy' | 'lovers' | 'twin' | 'ghost'
) {
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(adminDb, 'games', gameId);
    const sanitizedText = sanitizeHTML(text.trim());

    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            
            const playerPrivateRef = doc(adminDb, `games/${gameId}/playerData/${senderId}`);
            const privateSnap = await transaction.get(playerPrivateRef);
            if(!privateSnap.exists()) throw new Error("Sender not found.");
            const senderPrivateData = privateSnap.data() as PlayerPrivateData;

            const senderPublicData = game.players.find(p => p.userId === senderId);
            if(!senderPublicData) throw new Error("Sender not found.");
            const sender: Player = { ...senderPublicData!, ...senderPrivateData };


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
            
            const playerIndex = game.players.findIndex(p => p.userId === senderId);
            const updatedPlayers = [...game.players];
            if(playerIndex !== -1) {
                updatedPlayers[playerIndex].lastActiveAt = Timestamp.now();
            }

            const messageData: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId, senderName, text: sanitizedText,
                round: game.currentRound, createdAt: Timestamp.now(),
            };

            transaction.update(gameRef, { 
                [chatField]: arrayUnion(toPlainObject(messageData)),
                players: toPlainObject(updatedPlayers)
            });
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


async function triggerAIChat(gameId: string, triggerMessage: string, chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost') {
    try {
        const gameDoc = await getDoc(doc(adminDb, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        if (game.status === 'finished') return;

        const aiPlayersToTrigger = game.players.filter(p => p.isAI && p.isAlive);
        if (aiPlayersToTrigger.length === 0) return;
        
        const fullPlayerList = await getFullPlayers(gameId, game);

        for (const publicAiPlayer of aiPlayersToTrigger) {
            const isAccused = triggerMessage.toLowerCase().includes(publicAiPlayer.displayName.toLowerCase());
            const shouldTrigger = isAccused ? Math.random() < 0.95 : Math.random() < 0.35;

            if (shouldTrigger) {
                const aiPlayer = fullPlayerList.find(p => p.userId === publicAiPlayer.userId);
                if (!aiPlayer) continue;

                let seerChecks: AIPlayerPerspective['seerChecks'] = undefined;
                const isSeerOrApprentice = aiPlayer.role === 'seer' || (aiPlayer.role === 'seer_apprentice' && game.seerDied);
                
                if (isSeerOrApprentice) {
                    seerChecks = [];
                    const seerActions = game.nightActions?.filter(a => a.playerId === aiPlayer.userId && a.actionType === 'seer_check') || [];
                    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'lycanthrope'];

                    for (const action of seerActions) {
                        const targetPlayer = fullPlayerList.find(p => p.userId === action.targetId);
                        if (targetPlayer?.role) {
                            seerChecks.push({
                                targetName: targetPlayer.displayName,
                                isWerewolf: wolfRoles.includes(targetPlayer.role),
                            });
                        }
                    }
                }
                
                const sanitizedPlayers = fullPlayerList.map(p => {
                    const { privateData, ...publicData } = splitPlayerData(p);
                    const role = (p.userId === aiPlayer.userId || !p.isAlive) ? p.role : 'unknown';
                    return { ...publicData, role };
                });
                
                const perspective: AIPlayerPerspective = {
                    game: toPlainObject(game),
                    aiPlayer: toPlainObject(aiPlayer),
                    trigger: triggerMessage,
                    players: toPlainObject(sanitizedPlayers),
                    chatType,
                    seerChecks: seerChecks ? toPlainObject(seerChecks) : undefined,
                };

                generateAIChatMessage(perspective).then(async ({ message, shouldSend }) => {
                    if (shouldSend && message) {
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 1000));
                        await sendChatMessage(gameId, aiPlayer.userId, aiPlayer.displayName, message, true);
                    }
                }).catch(aiError => console.error(`Error generating AI chat for ${aiPlayer.displayName}:`, aiError));
            }
        }
    } catch (e) {
        console.error("Error in triggerAIChat:", e);
    }
}


export async function processJuryVotes(gameId: string) {
    const gameRef = doc(adminDb, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found!");
            const game = gameSnap.data()!;
            const fullPlayers = await getFullPlayers(gameId, game, transaction);
            await processJuryVotesEngine(transaction, gameRef, game, fullPlayers);
        });
    } catch (e) {
        console.error("Failed to process jury votes", e);
    }
}

export async function executeMasterAction(gameId: string, actionId: string, sourceId: string | null, targetId: string) {
    const gameRef = doc(adminDb, 'games', gameId);
     try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef as DocumentReference<Game>);
            if (!gameDoc.exists()) throw new Error("Game not found");
            let game = gameDoc.data()!;
            const fullPlayers = await getFullPlayers(gameId, game, transaction);


            if (actionId === 'master_kill') {
                 if (game.masterKillUsed) throw new Error("El Zarpazo del Destino ya ha sido utilizado.");
                 const { updatedGame } = await killPlayerUnstoppable(transaction, gameRef as DocumentReference<Game>, game, fullPlayers, targetId, 'special', `Por intervención divina, ${game.players.find(p=>p.userId === targetId)?.displayName} ha sido eliminado.`);
                 updatedGame.masterKillUsed = true;
                 game = updatedGame;
            } else {
                const action = masterActions[actionId as keyof typeof masterActions];
                if (action) {
                    const { updatedGame } = action.execute(game, sourceId!, targetId);
                    game = updatedGame;
                }
            }
            transaction.update(gameRef, toPlainObject(game));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error executing master action:", error);
        return { success: false, error: error.message };
    }
}

export async function submitHunterShot(gameId: string, hunterId: string, targetId: string) {
    const gameRef = doc(adminDb, 'games', gameId) as DocumentReference<Game>;

    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data();

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId || game.status === 'finished') {
                return;
            }
            
            const fullPlayers = await getFullPlayers(gameId, game, transaction);
            const { updatedGame, updatedPlayers, triggeredHunterId: anotherHunterId } = await killPlayerUnstoppable(transaction, gameRef as DocumentReference<Game>, game, fullPlayers, targetId, 'hunter_shot', `En su último aliento, el Cazador dispara y se lleva consigo a ${game.players.find(p=>p.userId === targetId)?.displayName}.`);
            game = updatedGame;
            
            if (anotherHunterId) {
                game.pendingHunterShot = anotherHunterId;
                 const { publicPlayersData } = splitPlayerDataList(updatedPlayers);
                transaction.update(gameRef, toPlainObject({ players: publicPlayersData, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
                return;
            }

            const gameOverInfo = await checkGameOver(game, fullPlayers);
            if (gameOverInfo.isGameOver) {
                game.status = "finished";
                game.phase = "finished";
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
                const { publicPlayersData } = splitPlayerDataList(updatedPlayers);
                transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: publicPlayersData, events: game.events, pendingHunterShot: null }));
                return;
            }

            const hunterDeathEvent = [...game.events].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)).find(e => (e.data?.killedPlayerIds?.includes(hunterId) || e.data?.lynchedPlayerId === hunterId));
            const nextPhase = hunterDeathEvent?.type === 'vote_result' ? 'night' : 'day';
            const nextRound = nextPhase === 'night' ? game.currentRound + 1 : game.currentRound;

            for(const p of updatedPlayers) {
                const playerPrivateRef = doc(adminDb, `games/${gameId}/playerData/${p.userId}`);
                transaction.update(playerPrivateRef, { votedFor: null, usedNightAbility: false });
            }

            const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
            const { publicPlayersData } = splitPlayerDataList(updatedPlayers);
            transaction.update(gameRef, toPlainObject({
                players: publicPlayersData, events: game.events, phase: nextPhase, phaseEndsAt,
                currentRound: nextRound, pendingHunterShot: null
            }));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting hunter shot:", error);
        return { success: false, error: error.message || "No se pudo registrar el disparo." };
    }
}
export async function submitVote(gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(adminDb, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data();

            if (game.phase !== 'day' || game.status === 'finished') return;

            const fullPlayers = await getFullPlayers(gameId, game, transaction);
            const voter = fullPlayers.find(p => p.userId === voterId);
            
            if(!voter || !voter.isAlive) throw new Error("Player not found or is not alive");
            if (voter.votedFor) return;

            const voterPrivateRef = doc(adminDb, `games/${gameId}/playerData/${voterId}`);

            const siren = fullPlayers.find(p => p.role === 'river_siren');
            const charmedPlayerId = siren?.riverSirenTargetId;

            if (voterId === charmedPlayerId && siren && siren.isAlive) {
                 const sirenPublicData = game.players.find(p => p.userId === siren.userId);
                if (sirenPublicData?.votedFor) {
                    transaction.update(voterPrivateRef, { votedFor: sirenPublicData.votedFor });
                } else {
                    throw new Error("Debes esperar a que la Sirena vote primero.");
                }
            } else {
                 transaction.update(voterPrivateRef, { votedFor: targetId });
            }
            
            const voterPublicDataIndex = game.players.findIndex(p=>p.userId === voterId);
            if(voterPublicDataIndex > -1){
                const newPlayers = [...game.players];
                newPlayers[voterPublicDataIndex].lastActiveAt = Timestamp.now();
                transaction.update(gameRef, { players: toPlainObject(newPlayers) });
            }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "No se pudo registrar tu voto." };
    }
}

export async function submitNightAction(data: {gameId: string, round: number, playerId: string, actionType: NightActionType, targetId: string}) {
    const { gameId, playerId, actionType, targetId } = data;
    const gameRef = doc(adminDb, 'games', gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data() as Game;
            if (game.phase !== 'night' || game.status === 'finished') return;
            
            const playerPrivateRef = doc(adminDb, `games/${gameId}/playerData/${playerId}`);
            const playerPrivateSnap = await transaction.get(playerPrivateRef);
            if (!playerPrivateSnap.exists()) throw new Error("Player private data not found");
            
            const privateData = playerPrivateSnap.data() as PlayerPrivateData;
            
            if(privateData.usedNightAbility) return;
            if (game.exiledPlayerId === playerId) throw new Error("Has sido exiliado esta noche y no puedes usar tu habilidad.");
            
            privateData.usedNightAbility = true;
            
            const playerPublicIndex = game.players.findIndex(p => p.userId === playerId);
            if (playerPublicIndex !== -1) {
                const updatedPlayers = [...game.players];
                updatedPlayers[playerPublicIndex].lastActiveAt = Timestamp.now();
                transaction.update(gameRef, { players: toPlainObject(updatedPlayers) });
            }

            const newAction: NightAction = { ...data, createdAt: Timestamp.now() };
            transaction.update(gameRef, { nightActions: arrayUnion(toPlainObject(newAction)) });
            transaction.set(playerPrivateRef, privateData);

        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function submitTroublemakerAction(gameId: string, troublemakerId: string, target1Id: string, target2Id: string) {
    const gameRef = doc(adminDb, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada");
            let game = gameSnap.data();
            const fullPlayers = await getFullPlayers(gameId, game, transaction);
            const player = fullPlayers.find(p => p.userId === troublemakerId);
            if (!player || player.role !== 'troublemaker' || game.troublemakerUsed) throw new Error("No puedes realizar esta acción.");
            
            const message = `${game.players.find(p => p.userId === target1Id)?.displayName} y ${game.players.find(p => p.userId === target2Id)?.displayName} han muerto en una pelea mortal provocada por la Alborotadora.`;

            let { updatedGame: gameAfterKill1 } = await killPlayer(transaction, gameRef as DocumentReference<Game>, game, fullPlayers, target1Id, 'troublemaker_duel', message);
            let { updatedGame: gameAfterKill2 } = await killPlayer(transaction, gameRef as DocumentReference<Game>, gameAfterKill1, fullPlayers, target2Id, 'troublemaker_duel', message);
            game = gameAfterKill2;
            
            game.troublemakerUsed = true;
            transaction.update(gameRef, toPlainObject(game));
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function submitJuryVote(gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(adminDb, 'games', gameId);
    try {
        await updateDoc(gameRef, {
            [`juryVotes.${voterId}`]: targetId,
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function sendGhostMessage(gameId: string, ghostId: string, recipientId: string, template: string, subjectId?: string) {
    const gameRef = doc(adminDb, 'games', gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;
            
            const playerPrivateRef = doc(adminDb, `games/${gameId}/playerData/${ghostId}`);
            const playerPrivateSnap = await transaction.get(playerPrivateRef);
            if (!playerPrivateSnap.exists()) throw new Error("Player private data not found");
            const privateData = playerPrivateSnap.data() as PlayerPrivateData;

            const publicData = game.players.find(p => p.userId === ghostId);
            if (!publicData || publicData.isAlive || privateData.ghostMessageSent) {
                throw new Error("No tienes permiso para realizar esta acción.");
            }
            
            let finalMessage = sanitizeHTML(template);
            if (template.includes('{player}') && subjectId) {
                const subjectPlayer = game.players.find(p => p.userId === subjectId);
                if (!subjectPlayer) throw new Error("Subject player not found");
                finalMessage = template.replace('{player}', subjectPlayer.displayName);
            }

            const ghostEvent: GameEvent = {
                id: `evt_ghost_${Date.now()}`, gameId, round: game.currentRound, type: 'special',
                message: `Has recibido un misterioso mensaje desde el más allá: "${finalMessage}"`,
                createdAt: Timestamp.now(), data: { targetId: recipientId, originalMessage: finalMessage },
            };
            
            privateData.ghostMessageSent = true;
            transaction.update(gameRef, { events: arrayUnion(toPlainObject(ghostEvent)) });
            transaction.set(playerPrivateRef, privateData);
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}


export async function getSeerResult(gameId: string, seerId: string, targetId: string) {
    const gameDoc = await getDoc(doc(adminDb, 'games', gameId));
    if (!gameDoc.exists()) throw new Error("Game not found");
    const game = gameDoc.data() as Game;

    const fullPlayers = await getFullPlayers(gameId, game);

    const seerPlayer = fullPlayers.find(p => p.userId === seerId);
    if (!seerPlayer || (seerPlayer.role !== 'seer' && !(seerPlayer.role === 'seer_apprentice' && game.seerDied))) {
        throw new Error("No tienes el don de la videncia.");
    }

    const targetPlayer = fullPlayers.find(p => p.userId === targetId);
    if (!targetPlayer) throw new Error("Target player not found");

    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed'];
    const isWerewolf = !!(targetPlayer.role && (wolfRoles.includes(targetPlayer.role) || (targetPlayer.role === 'lycanthrope' && game.settings.lycanthrope)));

    return { success: true, isWerewolf, targetName: targetPlayer.displayName };
}

export async function updatePlayerAvatar(gameId: string, userId: string, newAvatarUrl: string) {
    const gameRef = doc(adminDb, "games", gameId);

    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found.");
            const game = gameSnap.data() as Game;

            const playerIndex = game.players.findIndex(p => p.userId === userId);
            if (playerIndex === -1) throw new Error("Player not found in game.");

            const updatedPlayers = [...game.players];
            updatedPlayers[playerIndex].avatarUrl = newAvatarUrl;
            updatedPlayers[playerIndex].lastActiveAt = Timestamp.now();

            transaction.update(gameRef, { players: toPlainObject(updatedPlayers), lastActiveAt: Timestamp.now() });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function kickInactivePlayers(gameId: string) {
    const gameRef = doc(adminDb, 'games', gameId) as DocumentReference<Game>;
    const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);

    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) return;
            let game = gameSnap.data()!;

            if (game.status !== 'in_progress') return;

            let fullPlayers = await getFullPlayers(gameId, game, transaction);
            
            const inactivePlayers = fullPlayers.filter(p => p.isAlive && getMillis(p.lastActiveAt) < fiveMinutesAgo.toMillis());

            if (inactivePlayers.length === 0) return;
            
            for (const inactivePlayer of inactivePlayers) {
                const result = await killPlayerUnstoppable(transaction, gameRef, game, fullPlayers, inactivePlayer.userId, 'special', `${inactivePlayer.displayName} ha sido eliminado por inactividad.`);
                game = result.updatedGame;
                fullPlayers = result.updatedPlayers;

                const privatePlayerRef = doc(adminDb, `games/${gameId}/playerData/${inactivePlayer.userId}`);
                transaction.delete(privatePlayerRef);
            }

            const { publicPlayersData } = splitPlayerDataList(fullPlayers);
            game.players = publicPlayersData;

            const gameOverInfo = await checkGameOver(game, fullPlayers);
             if (gameOverInfo.isGameOver) {
                game.status = "finished";
                game.phase = "finished";
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
            }
            
            transaction.set(gameRef, toPlainObject(game));
        });

    } catch (e: any) {
        console.error(`Error kicking inactive players for game ${gameId}:`, e);
    }
}

const splitPlayerDataList = (fullPlayers: Player[]): { publicPlayersData: PlayerPublicData[], privatePlayersData: Record<string, PlayerPrivateData> } => {
    const publicPlayersData: PlayerPublicData[] = [];
    const privatePlayersData: Record<string, PlayerPrivateData> = {};

    fullPlayers.forEach(player => {
        const { publicData, privateData } = splitPlayerData(player);
        publicPlayersData.push(publicData);
        privatePlayersData[player.userId] = privateData;
    });

    return { publicPlayersData, privatePlayersData };
};
