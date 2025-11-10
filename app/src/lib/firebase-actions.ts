
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
import { masterActions } from "./master-actions";
import { getSdks } from "@/firebase/server-init";
import { secretObjectives } from "./objectives";
import { processJuryVotes as processJuryVotesEngine, killPlayer, killPlayerUnstoppable, checkGameOver, processVotes as processVotesEngine, processNight as processNightEngine } from './game-engine';
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";


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
  const { firestore } = getSdks();
  const { userId, displayName, avatarUrl, gameName, maxPlayers, settings } = options;

  if (!userId || !displayName.trim() || !gameName.trim()) {
    return { error: "Datos incompletos para crear la partida." };
  }
  if (maxPlayers < 3 || maxPlayers > 32) {
    return { error: "El número de jugadores debe ser entre 3 y 32." };
  }

  const gameId = generateGameId();
  const gameRef = doc(firestore, "games", gameId);
      
  const creatorPlayer = createPlayerObject(userId, gameId, displayName, avatarUrl, false);

  const gameData: Game = {
      id: gameId,
      name: gameName.trim(),
      status: "waiting",
      phase: "waiting", 
      creator: userId,
      players: [creatorPlayer], // Add creator directly
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
    await setDoc(gameRef, toPlainObject(gameData));
    return { gameId };
  } catch (error: any) {
    console.error("--- CATASTROPHIC ERROR IN createGame ---", error);
    return { error: `Error de servidor: ${error.message || 'Error desconocido al crear la partida.'}` };
  }
}

const AI_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jessie", "Jamie", "Kai", "Rowan"];
const MINIMUM_PLAYERS = 3;

const generateRoles = (playerCount: number, settings: Game['settings']): (PlayerRole)[] => {
    let roles: PlayerRole[] = [];
    
    // 1. Add Werewolves
    const numWerewolves = Math.max(1, Math.floor(playerCount / 5));
    for (let i = 0; i < numWerewolves; i++) {
        roles.push('werewolf');
    }

    // 2. Add selected special roles
    const availableSpecialRoles: PlayerRole[] = (Object.keys(settings) as Array<keyof typeof settings>)
        .filter(key => {
            const roleKey = key as PlayerRole;
            return settings[key] === true && roleKey && roleKey !== 'werewolf' && roleKey !== 'villager';
        })
        .sort(() => Math.random() - 0.5) as PlayerRole[];
    
    for (const specialRole of availableSpecialRoles) {
        if (roles.length >= playerCount) break;

        if (specialRole === 'twin') {
            if (roles.length + 2 <= playerCount) {
                roles.push('twin', 'twin');
            }
        } else {
            roles.push(specialRole);
        }
    }
    
    // 3. Fill remaining spots with Villagers
    while (roles.length < playerCount) {
        roles.push('villager');
    }

    // 4. Shuffle all roles
    return roles.sort(() => Math.random() - 0.5);
};

export async function startGame(gameId: string, creatorId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);

            if (!gameSnap.exists()) {
                throw new Error('Partida no encontrada.');
            }

            let game = gameSnap.data() as Game;

            if (game.creator !== creatorId) {
                throw new Error('Solo el creador puede iniciar la partida.');
            }

            if (game.status !== 'waiting') {
                throw new Error('La partida ya ha comenzado.');
            }
            
            let finalPlayers = [...game.players];

            if (game.settings.fillWithAI && finalPlayers.length < game.maxPlayers) {
                const aiPlayerCount = game.maxPlayers - finalPlayers.length;
                const availableAINames = AI_NAMES.filter(name => !finalPlayers.some(p => p.displayName === name));

                for (let i = 0; i < aiPlayerCount; i++) {
                    const aiUserId = `ai_${Date.now()}_${i}`;
                    const aiName = availableAINames[i % availableAINames.length] || `Bot ${i + 1}`;
                    const aiAvatar = `/logo.png`;
                    const aiPlayerData = createPlayerObject(aiUserId, gameId, aiName, aiAvatar, true);
                    finalPlayers.push(aiPlayerData);
                }
            }
            
            const totalPlayers = finalPlayers.length;
            if (totalPlayers < MINIMUM_PLAYERS) {
                throw new Error(`Se necesitan al menos ${MINIMUM_PLAYERS} jugadores para comenzar.`);
            }
            
            const newRoles = generateRoles(totalPlayers, game.settings);
            
            let assignedPlayers = finalPlayers.map((player, index) => {
                const p = { ...player, role: newRoles[index] };
                if (p.role === 'cult_leader') {
                    p.isCultMember = true;
                }
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

            const executioner = assignedPlayers.find(p => p.role === 'executioner');
            if (executioner) {
                const wolfTeamRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch'];
                const nonWolfPlayers = assignedPlayers.filter(p => {
                    return p.role && !wolfTeamRoles.includes(p.role) && p.userId !== executioner.userId;
                });
                if (nonWolfPlayers.length > 0) {
                    const target = nonWolfPlayers[Math.floor(Math.random() * nonWolfPlayers.length)];
                    if (target) {
                        const executionerIndex = assignedPlayers.findIndex(p => p.userId === executioner.userId);
                        if (executionerIndex > -1) {
                            assignedPlayers[executionerIndex].executionerTargetId = target.userId;
                        }
                    }
                }
            }

            const twinUserIds = assignedPlayers.filter(p => p.role === 'twin').map(p => p.userId);
            
            transaction.update(gameRef, toPlainObject({
                players: assignedPlayers,
                twins: twinUserIds.length === 2 ? [twinUserIds[0], twinUserIds[1]] as [string, string] : null,
                status: 'in_progress',
                phase: 'role_reveal',
                currentRound: 1,
            }));
        });
        
        return { success: true };

    } catch (e: any) {
        console.error("Error starting game:", e);
        return { error: e.message || 'Error al iniciar la partida.' };
    }
}

export async function resetGame(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada.");
            const game = gameSnap.data() as Game;

            const humanPlayers = game.players.filter(p => !p.isAI);

            const resetHumanPlayers = humanPlayers.map(player => {
                const newPlayer = createPlayerObject(player.userId, game.id, player.displayName, player.avatarUrl, player.isAI);
                newPlayer.joinedAt = player.joinedAt; 
                return newPlayer;
            });

            transaction.update(gameRef, toPlainObject({
                status: 'waiting', phase: 'waiting', currentRound: 0,
                events: [], chatMessages: [], wolfChatMessages: [], fairyChatMessages: [],
                twinChatMessages: [], loversChatMessages: [], ghostChatMessages: [], nightActions: [],
                twins: null, lovers: null, phaseEndsAt: Timestamp.now(), pendingHunterShot: null,
                wolfCubRevengeRound: 0, players: resetHumanPlayers, vampireKills: 0, boat: [],
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
    const { firestore } = getSdks();
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(firestore, 'games', gameId);

    try {
        let latestGame: Game | null = null;
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            latestGame = game;

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

        if (!isFromAI && latestGame) {
            const triggerMessage = `${senderName} dijo: "${text.trim()}"`;
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


async function triggerAIChat(gameId: string, triggerMessage: string, chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost') {
    const { firestore } = getSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        if (game.status === 'finished') return;

        const aiPlayersToTrigger = game.players.filter(p => p.isAI && p.isAlive);

        for (const aiPlayer of aiPlayersToTrigger) {
             const isAccused = triggerMessage.toLowerCase().includes(aiPlayer.displayName.toLowerCase());
             const shouldTrigger = isAccused ? Math.random() < 0.95 : Math.random() < 0.35;

             if (shouldTrigger) {
                const perspective: AIPlayerPerspective = {
                    game: toPlainObject(game),
                    aiPlayer: toPlainObject(aiPlayer),
                    trigger: triggerMessage,
                    players: toPlainObject(game.players),
                    chatType,
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


export async function processNight(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(firestore, async (transaction) => {
            await processNightEngine(transaction, gameRef);
        });
    } catch (e) {
        console.error("Failed to process night", e);
    }
}

export async function processVotes(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(firestore, async (transaction) => {
            await processVotesEngine(transaction, gameRef);
        });
    } catch (e) {
        console.error("Failed to process votes", e);
    }
}

export async function processJuryVotes(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(firestore, async (transaction) => {
            await processJuryVotesEngine(transaction, gameRef);
        });
    } catch (e) {
        console.error("Failed to process jury votes", e);
    }
}

export async function executeMasterAction(gameId: string, actionId: string, sourceId: string | null, targetId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);
     try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef as DocumentReference<Game>);
            if (!gameDoc.exists()) throw new Error("Game not found");
            let game = gameDoc.data()!;

            if (actionId === 'master_kill') {
                 if (game.masterKillUsed) throw new Error("El Zarpazo del Destino ya ha sido utilizado.");
                 const { updatedGame } = await killPlayer(transaction, gameRef as DocumentReference<Game>, game, targetId, 'special');
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
