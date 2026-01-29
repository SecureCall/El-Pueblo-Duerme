
'use server';
import { 
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  runTransaction,
  FieldValue,
} from "firebase/firestore";
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
import { toPlainObject, splitPlayerData } from "./utils";
import { masterActions } from "./master-actions";
import { secretObjectives } from "./objectives";
import { processJuryVotes as processJuryVotesEngine, killPlayer, killPlayerUnstoppable, checkGameOver, processVotes as processVotesEngine, processNight as processNightEngine, generateRoles } from './game-engine';
import { getDeterministicAIAction, runAIActions, runAIHunterShot } from './server-ai-actions';
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";

const AI_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jessie", "Jamie", "Kai", "Rowan"];
const MINIMUM_PLAYERS = 3;
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
    joinedAt: new Date(),
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
    lookoutUsed: false,
    executionerTargetId: null,
    secretObjectiveId: null,
    lastActiveAt: new Date(),
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
  const adminDb = getAdminDb();
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
  const { publicData: creatorPublicData, privateData: creatorPrivateData } = splitPlayerData(creatorPlayer);

  const gameData: Game = {
      id: gameId,
      name: gameName.trim(),
      status: "waiting",
      phase: "waiting", 
      creator: userId,
      players: [creatorPublicData],
      events: [],
      chatMessages: [],
      wolfChatMessages: [],
      fairyChatMessages: [],
      twinChatMessages: [],
      loversChatMessages: [],
      ghostChatMessages: [],
      maxPlayers: maxPlayers,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      currentRound: 0,
      settings,
      phaseEndsAt: new Date(),
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
    const privateDataRef = doc(adminDb, `games/${gameId}/playerData`, userId);
    await setDoc(privateDataRef, toPlainObject(creatorPrivateData));
    return { gameId };
  } catch (error: any) {
    console.error("--- CATASTROPHIC ERROR IN createGame ---", error);
    return { error: `Error de servidor: ${error.message || 'Error desconocido al crear la partida.'}` };
  }
}

export async function joinGame(
  firestore: FirebaseFirestore.Firestore,
  gameId: string,
  userId: string,
  displayName: string,
  avatarUrl: string,
) {
  const gameRef = doc(firestore, "games", gameId);
  const privateDataRef = doc(firestore, `games/${gameId}/playerData`, userId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists()) throw new Error("Partida no encontrada.");

      const game = gameSnap.data() as Game;

      if (game.status !== "waiting" && !game.players.some(p => p.userId === userId)) {
        throw new Error("Esta partida ya ha comenzado.");
      }
      
      const playerExists = game.players.some(p => p.userId === userId);
      if (playerExists) return;
      
      const nameExists = game.players.some(p => p.displayName.trim().toLowerCase() === displayName.trim().toLowerCase());
      if (nameExists) throw new Error("Ese nombre ya está en uso en esta partida.");

      if (game.players.length >= game.maxPlayers) throw new Error("Esta partida está llena.");
      
      const newPlayer = createPlayerObject(userId, gameId, displayName, avatarUrl, false);
      const { publicData, privateData } = splitPlayerData(newPlayer);
      
      transaction.set(privateDataRef, toPlainObject(privateData));
      transaction.update(gameRef, {
        players: arrayUnion(toPlainObject(publicData)),
        lastActiveAt: new Date(),
      });
    });

    return { success: true };

  } catch(error: any) {
    console.error("Error joining game:", error);
    return { error: `No se pudo unir a la partida: ${error.message}` };
  }
}


export async function startGame(gameId: string, creatorId: string) {
    const adminDb = getAdminDb();
    const gameRef = doc(adminDb, 'games', gameId);
    
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);

            if (!gameSnap.exists()) throw new Error('Partida no encontrada.');
            let game = gameSnap.data() as Game;

            if (game.creator !== creatorId) throw new Error('Solo el creador puede iniciar la partida.');
            if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado.');
            
            let finalPlayers: PlayerPublicData[] = [...game.players];
            let allPrivateData: Record<string, PlayerPrivateData> = {};

            if (game.settings.fillWithAI && finalPlayers.length < game.maxPlayers) {
                const aiPlayerCount = game.maxPlayers - finalPlayers.length;
                const availableAINames = AI_NAMES.filter(name => !finalPlayers.some(p => p.displayName === name));

                for (let i = 0; i < aiPlayerCount; i++) {
                    const aiUserId = `ai_${Date.now()}_${i}`;
                    const aiName = availableAINames[i % availableAINames.length] || `Bot ${i + 1}`;
                    const aiAvatar = `/logo.png`;
                    const aiPlayer = createPlayerObject(aiUserId, gameId, aiName, aiAvatar, true);
                    const { publicData, privateData } = splitPlayerData(aiPlayer);
                    finalPlayers.push(publicData);
                    allPrivateData[aiUserId] = privateData;
                }
            }
            
            if (finalPlayers.length < MINIMUM_PLAYERS) throw new Error(`Se necesitan al menos ${MINIMUM_PLAYERS} jugadores para comenzar.`);
            
            const newRoles = generateRoles(finalPlayers.length, game.settings);
            
            const humanPlayerIds = finalPlayers.filter(p => !p.isAI).map(p => p.userId);
            const humanPlayersPrivateSnap = await transaction.getAll(...humanPlayerIds.map(id => doc(adminDb, `games/${gameId}/playerData/${id}`)));
            
            humanPlayersPrivateSnap.forEach(snap => {
                if (snap.exists()) {
                    allPrivateData[snap.id] = snap.data() as PlayerPrivateData;
                }
            });

            finalPlayers.forEach((player, index) => {
                const role = newRoles[index];
                allPrivateData[player.userId].role = role;
                if (role === 'cult_leader') allPrivateData[player.userId].isCultMember = true;

                 if (!player.isAI) {
                    const applicableObjectives = secretObjectives.filter(obj => 
                        obj.appliesTo.includes('any') || obj.appliesTo.includes(role!)
                    );
                    if (applicableObjectives.length > 0) {
                        allPrivateData[player.userId].secretObjectiveId = applicableObjectives[Math.floor(Math.random() * applicableObjectives.length)].id;
                    }
                }
            });

            const executioner = Object.entries(allPrivateData).find(([, data]) => data.role === 'executioner');
            if (executioner) {
                const wolfTeamRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch'];
                const nonWolfPlayers = finalPlayers.filter(p => {
                    const pRole = allPrivateData[p.userId].role;
                    return pRole && !wolfTeamRoles.includes(pRole) && p.userId !== executioner[0];
                });
                if (nonWolfPlayers.length > 0) {
                    const target = nonWolfPlayers[Math.floor(Math.random() * nonWolfPlayers.length)];
                    if (target) {
                        allPrivateData[executioner[0]].executionerTargetId = target.userId;
                    }
                }
            }

            const twinUserIds = Object.entries(allPrivateData).filter(([, data]) => data.role === 'twin').map(([id]) => id);

            for (const [userId, privateData] of Object.entries(allPrivateData)) {
                transaction.set(doc(adminDb, `games/${gameId}/playerData`, userId), toPlainObject(privateData));
            }
            
            transaction.update(gameRef, toPlainObject({
                players: finalPlayers,
                twins: twinUserIds.length === 2 ? [twinUserIds[0], twinUserIds[1]] : null,
                status: 'in_progress',
                phase: 'role_reveal',
                phaseEndsAt: new Date(Date.now() + 15000), // 15s for role reveal
            }));
        });
        
        return { success: true };

    } catch (e: any) {
        console.error("Error starting game:", e);
        return { error: e.message || 'Error al iniciar la partida.' };
    }
}

export async function resetGame(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = doc(adminDb, 'games', gameId);

    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada.");
            const game = gameSnap.data() as Game;

            const humanPlayers = game.players.filter(p => !p.isAI);

            const resetHumanPlayersPublic: PlayerPublicData[] = [];
            
            for (const player of humanPlayers) {
                const newPlayer = createPlayerObject(player.userId, game.id, player.displayName, player.avatarUrl, player.isAI);
                newPlayer.joinedAt = player.joinedAt;
                const { publicData, privateData } = splitPlayerData(newPlayer);
                resetHumanPlayersPublic.push(publicData);
                transaction.set(doc(adminDb, `games/${gameId}/playerData`, player.userId), toPlainObject(privateData));
            }

            transaction.update(gameRef, toPlainObject({
                status: 'waiting', phase: 'waiting', currentRound: 0,
                events: [], chatMessages: [], wolfChatMessages: [], fairyChatMessages: [],
                twinChatMessages: [], loversChatMessages: [], ghostChatMessages: [], nightActions: [],
                twins: null, lovers: null, phaseEndsAt: new Date(), pendingHunterShot: null,
                wolfCubRevengeRound: 0, players: resetHumanPlayersPublic, vampireKills: 0, boat: [],
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

async function triggerAIChat(gameId: string, triggerMessage: string, chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost') {
    const adminDb = getAdminDb();
    try {
        const gameDoc = await getDoc(doc(adminDb, 'games', gameId));
        if (!gameDoc.exists()) return;

        let game = gameDoc.data() as Game;
        if (game.status === 'finished') return;

        const aiPlayersToTrigger = game.players.filter(p => p.isAI && p.isAlive);
        
        for (const publicAiPlayer of aiPlayersToTrigger) {
             const isAccused = triggerMessage.toLowerCase().includes(publicAiPlayer.displayName.toLowerCase());
             const shouldTrigger = isAccused ? Math.random() < 0.95 : Math.random() < 0.35;

             if (shouldTrigger) {
                 const privateDataSnap = await getDoc(doc(adminDb, `games/${gameId}/playerData`, publicAiPlayer.userId));
                 if (!privateDataSnap.exists()) continue;
                 
                 const aiPlayer: Player = { ...publicAiPlayer, ...(privateDataSnap.data() as PlayerPrivateData) };
                 
                 const allPlayersPrivateSnaps = await getDoc(doc(adminDb, `games/${gameId}/playerData`));


                const perspective = {
                    game: toPlainObject(game),
                    aiPlayer: toPlainObject(aiPlayer),
                    trigger: triggerMessage,
                    players: toPlainObject(game.players), // AI will get public data of other players
                    chatType,
                    seerChecks: allPrivateData[aiPlayer.userId]?.seerChecks,
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

export async function sendChatMessage(gameId: string, senderId: string, senderName: string, text: string, isFromAI: boolean = false) {
    const adminDb = getAdminDb();
    if (!text?.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };
    const gameRef = doc(adminDb, 'games', gameId);

    try {
        let latestGame: Game | null = null;
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            latestGame = game;

            if (game.silencedPlayerId === senderId) throw new Error("No puedes hablar, has sido silenciado esta ronda.");
            
            const mentionedPlayerIds = game.players.filter(p => p.isAlive && text.toLowerCase().includes(p.displayName.toLowerCase())).map(p => p.userId);
            const messageData: ChatMessage = {id: `${Date.now()}_${senderId}`, senderId, senderName, text: text.trim(), round: game.currentRound, createdAt: new Date(), mentionedPlayerIds};
            transaction.update(gameRef, { chatMessages: arrayUnion(toPlainObject(messageData)) });
        });

        if (!isFromAI && latestGame) await triggerAIChat(gameId, `${senderName} dijo: "${text.trim()}"`, 'public');
        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function submitNightAction(data: {gameId: string, round: number, playerId: string, actionType: NightActionType, targetId: string}) {
    const adminDb = getAdminDb();
    const { gameId, playerId, actionType, targetId } = data;
    const gameRef = doc(adminDb, 'games', gameId);
    const privateRef = doc(adminDb, `games/${gameId}/playerData`, playerId);

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
            transaction.update(gameRef, { nightActions: arrayUnion(toPlainObject(newAction)) });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function processNight(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = doc(adminDb, 'games', gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            await processNightEngine(transaction, gameRef);
        });
        await runAIActions(gameId, 'day');
    } catch (e) { console.error("Failed to process night", e); }
}

export async function processVotes(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = doc(adminDb, 'games', gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            await processVotesEngine(transaction, gameRef);
        });
        await runAIActions(gameId, 'night');
    } catch (e) { console.error("Failed to process votes", e); }
}

export async function getSeerResult(gameId: string, seerId: string, targetId: string) {
    const adminDb = getAdminDb();
    const privateSeerRef = doc(adminDb, `games/${gameId}/playerData`, seerId);
    const privateTargetRef = doc(adminDb, `games/${gameId}/playerData`, targetId);
    const targetPublicData = (await getDoc(doc(adminDb, 'games', gameId))).data()!.players.find(p => p.userId === targetId)!;

    try {
        const [seerSnap, targetSnap] = await Promise.all([getDoc(privateSeerRef), getDoc(privateTargetRef)]);
        if (!seerSnap.exists() || !targetSnap.exists()) throw new Error("Data not found");
        const seerData = seerSnap.data() as PlayerPrivateData;
        const targetData = targetSnap.data() as PlayerPrivateData;
        const game = (await getDoc(doc(adminDb, 'games', gameId))).data() as Game;

        const isSeerOrApprentice = seerData.role === 'seer' || (seerData.role === 'seer_apprentice' && game.seerDied);
        if (!isSeerOrApprentice) throw new Error("No tienes el don de la videncia.");

        const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
        const isWerewolf = !!(targetData.role && (wolfRoles.includes(targetData.role) || (targetData.role === 'lycanthrope' && game.settings.lycanthrope)));

        const newCheck = { targetName: targetPublicData.displayName, isWerewolf };
        const updatedChecks = [...(seerData.seerChecks || []), newCheck];

        await updateDoc(privateSeerRef, { seerChecks: updatedChecks });

        return { success: true, isWerewolf, targetName: targetPublicData.displayName };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}
