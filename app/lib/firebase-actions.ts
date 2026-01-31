
'use server';
import { 
  Timestamp,
  runTransaction,
  FieldValue,
} from "firebase-admin/firestore";
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
import { toPlainObject, splitPlayerData, getMillis, PHASE_DURATION_SECONDS } from "./utils";
import { masterActions } from "./master-actions";
import { secretObjectives } from "./objectives";
import { processJuryVotesEngine, killPlayer, killPlayerUnstoppable, checkGameOver, processVotesEngine, processNightEngine, generateRoles } from './game-engine';

const AI_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jessie", "Jamie", "Kai", "Rowan"];
const MINIMUM_PLAYERS = 3;

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
  const gameRef = adminDb.collection("games").doc(gameId);
      
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
      pendingTroublemakerDuel: null,
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
    await gameRef.set(toPlainObject(gameData));
    const privateDataRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(userId);
    await privateDataRef.set(toPlainObject(creatorPrivateData));
    return { gameId };
  } catch (error: any) {
    console.error("--- CATASTROPHIC ERROR IN createGame ---", error);
    return { error: `Error de servidor: ${error.message || 'Error desconocido al crear la partida.'}` };
  }
}

export async function joinGame(
  options: {
    gameId: string,
    userId: string,
    displayName: string,
    avatarUrl: string,
  }
) {
  const adminDb = getAdminDb();
  const { gameId, userId, displayName, avatarUrl } = options;
  const gameRef = adminDb.collection("games").doc(gameId);
  const privateDataRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(userId);

  try {
    await runTransaction(adminDb, async (transaction) => {
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
        players: FieldValue.arrayUnion(toPlainObject(publicData)),
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
    const gameRef = adminDb.collection('games').doc(gameId);
    
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
            const humanPlayersPrivateSnap = await transaction.getAll(...humanPlayerIds.map(id => adminDb.collection('games').doc(gameId).collection('playerData').doc(id)));
            
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
                transaction.set(adminDb.collection('games').doc(gameId).collection('playerData').doc(userId), toPlainObject(privateData));
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
    const gameRef = adminDb.collection('games').doc(gameId);

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
                transaction.set(adminDb.collection('games').doc(gameId).collection('playerData').doc(player.userId), toPlainObject(privateData));
            }

            transaction.update(gameRef, toPlainObject({
                status: 'waiting', phase: 'waiting', currentRound: 0,
                events: [], chatMessages: [], wolfChatMessages: [], fairyChatMessages: [],
                twinChatMessages: [], loversChatMessages: [], ghostChatMessages: [], nightActions: [],
                twins: null, lovers: null, phaseEndsAt: new Date(), pendingHunterShot: null,
                pendingTroublemakerDuel: null,
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

export async function sendChatMessage(gameId: string, senderId: string, senderName: string, text: string, isFromAI: boolean = false) {
    const adminDb = getAdminDb();
    if (!text?.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };
    const gameRef = adminDb.collection('games').doc(gameId);

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
            transaction.update(gameRef, { chatMessages: FieldValue.arrayUnion(toPlainObject(messageData)) });
        });

        if (!isFromAI && latestGame) {
            const { triggerAIChat } = await import('./firebase-ai-actions');
            await triggerAIChat(gameId, `${senderName} dijo: "${text.trim()}"`, 'public');
        }
        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function submitNightAction(data: {gameId: string, round: number, playerId: string, actionType: NightActionType, targetId: string}) {
    const adminDb = getAdminDb();
    const { gameId, playerId, actionType, targetId } = data;
    const gameRef = adminDb.collection('games').doc(gameId);
    const privateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(playerId);

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
            transaction.update(gameRef, { nightActions: FieldValue.arrayUnion(toPlainObject(newAction)) });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function processNight(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));

            await processNightEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const updatedGameDoc = await gameRef.get();
        if (updatedGameDoc.exists()) {
            const game = updatedGameDoc.data() as Game;
            
            if (game.phase === 'night') {
                 const { runNightAIActions } = await import('./firebase-ai-actions');
                 await runNightAIActions(gameId);
            }
            
            if(game.phase === 'day') {
                const latestNightResult = game.events
                    .filter(e => e.type === 'night_result' && e.round === game.currentRound)
                    .sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt))[0];
                
                if (latestNightResult) {
                    const { triggerAIReactionToGameEvent } = await import('./firebase-ai-actions');
                    await triggerAIReactionToGameEvent(gameId, latestNightResult);
                }
            }
        }
    } catch (e) { console.error("Failed to process night", e); }
}

export async function processVotes(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        const { runAIVotes } = await import('./firebase-ai-actions');
        await runAIVotes(gameId);

        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));
            
            await processVotesEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const updatedGameSnap = await gameRef.get();
        if (updatedGameSnap.exists()) {
            const game = updatedGameSnap.data() as Game;
            const voteEvent = game.events
                .filter(e => e.type === 'vote_result' && e.round === (game.phase === 'night' ? game.currentRound -1 : game.currentRound))
                .sort((a,b) => getMillis(b.createdAt) - getMillis(a.createdAt))[0];

            if (voteEvent) {
                const { triggerAIReactionToGameEvent } = await import('./firebase-ai-actions');
                await triggerAIReactionToGameEvent(gameId, voteEvent);
            }

            if (game.phase === 'night') {
                const { runNightAIActions } = await import('./firebase-ai-actions');
                await runNightAIActions(gameId);
            }
        }
    } catch (e) { console.error("Failed to process votes", e); }
}

export async function getSeerResult(gameId: string, seerId: string, targetId: string) {
    const adminDb = getAdminDb();
    const privateSeerRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(seerId);
    const privateTargetRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(targetId);
    const gameSnap = await adminDb.collection('games').doc(gameId).get();
    if (!gameSnap.exists()) throw new Error("Game not found");
    const game = gameSnap.data() as Game;
    const targetPublicData = game.players.find(p => p.userId === targetId)!;

    try {
        const [seerSnap, targetSnap] = await Promise.all([privateSeerRef.get(), privateTargetRef.get()]);
        if (!seerSnap.exists() || !targetSnap.exists()) throw new Error("Data not found");
        const seerData = seerSnap.data() as PlayerPrivateData;
        const targetData = targetSnap.data() as PlayerPrivateData;

        const isSeerOrApprentice = seerData.role === 'seer' || (seerData.role === 'seer_apprentice' && game.seerDied);
        if (!isSeerOrApprentice) throw new Error("No tienes el don de la videncia.");

        const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'lycanthrope'];
        const isWerewolf = !!(targetData.role && wolfRoles.includes(targetData.role));

        const newCheck = { targetName: targetPublicData.displayName, isWerewolf };
        const updatedChecks = [...(seerData.seerChecks || []), newCheck];

        await privateSeerRef.update({ seerChecks: updatedChecks });

        return { success: true, isWerewolf, targetName: targetPublicData.displayName };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}
export async function submitVote(gameId: string, voterId: string, targetId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            const game = gameSnap.data() as Game;
            if (game.phase !== 'day' || game.status === 'finished') return;

            const playerIndex = game.players.findIndex(p => p.userId === voterId && p.isAlive);
            if (playerIndex === -1) throw new Error("Player not found or is not alive");
            
            if (game.players[playerIndex].votedFor) return; // Already voted

            // Client-side handles most of the siren logic UI.
            // The authoritative decision is made in processVotesEngine to ensure server-side enforcement.
            game.players[playerIndex].votedFor = targetId;
            transaction.update(gameRef, { players: toPlainObject(game.players) });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting vote: ", error);
        return { success: false, error: (error as Error).message || "No se pudo registrar tu voto." };
    }
}

export async function submitTroublemakerSelection(gameId: string, troublemakerId: string, target1Id: string, target2Id: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada");
            let game = gameSnap.data() as Game;
            
            const privateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(troublemakerId);
            const privateSnap = await transaction.get(privateRef);
            const playerPrivate = privateSnap.data();

            if (!playerPrivate || playerPrivate.role !== 'troublemaker' || game.troublemakerUsed) throw new Error("No puedes realizar esta acción.");
            
            transaction.update(gameRef, toPlainObject({
                troublemakerUsed: true,
                pendingTroublemakerDuel: { target1Id, target2Id }
            }));
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function processJuryVotes(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        const { runAIJuryVotes } = await import('./firebase-ai-actions');
        await runAIJuryVotes(gameId);

        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));

            await processJuryVotesEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const { runNightAIActions } = await import('./firebase-ai-actions');
        await runNightAIActions(gameId);
    } catch (e) { console.error("Failed to process jury votes", e); }
}

export async function sendGhostMessage(gameId: string, ghostId: string, recipientId: string, template: string, subjectId?: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;
            const ghostPrivateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(ghostId);
            const ghostPrivateSnap = await transaction.get(ghostPrivateRef);
            const ghostPrivate = ghostPrivateSnap.data();

            if (!ghostPrivate || ghostPrivate.role !== 'ghost' || ghostPrivate.ghostMessageSent) {
                throw new Error("No tienes permiso para realizar esta acción.");
            }
            
            const subjectName = subjectId ? game.players.find(p => p.userId === subjectId)?.displayName : 'alguien';
            const finalMessage = template.replace('{player}', subjectName || 'alguien');

            const ghostEvent: GameEvent = {
                id: `evt_ghost_${Date.now()}`, gameId, round: game.currentRound, type: 'special',
                message: `Has recibido un misterioso mensaje desde el más allá: "${finalMessage}"`,
                data: { targetId: recipientId },
                createdAt: new Date(),
            };
            
            transaction.update(ghostPrivateRef, { ghostMessageSent: true });
            transaction.update(gameRef, { events: FieldValue.arrayUnion(toPlainObject(ghostEvent)) });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}
async function sendSpecialChatMessage(gameId: string, senderId: string, senderName: string, text: string, chatType: 'wolf' | 'fairy' | 'lovers' | 'twin' | 'ghost' ) {
    const adminDb = getAdminDb();
    if (!text?.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };
    const gameRef = adminDb.collection('games').doc(gameId);

    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;

            const privateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(senderId);
            const privateSnap = await transaction.get(privateRef);
            const privateData = privateSnap.data();
            
            let canSend = false;
            let chatField: keyof Game = 'chatMessages';

            switch (chatType) {
                case 'wolf':
                    if (privateData?.role && ['werewolf', 'wolf_cub'].includes(privateData.role)) {
                        canSend = true; chatField = 'wolfChatMessages';
                    }
                    break;
                case 'fairy':
                    if (game.fairiesFound && privateData?.role && ['seeker_fairy', 'sleeping_fairy'].includes(privateData.role)) {
                        canSend = true; chatField = 'fairyChatMessages';
                    }
                    break;
                case 'twin':
                     if (game.twins?.includes(senderId)) {
                        canSend = true; chatField = 'twinChatMessages';
                     }
                    break;
                case 'lovers':
                    if (privateData?.isLover) {
                        canSend = true; chatField = 'loversChatMessages';
                    }
                    break;
                case 'ghost':
                    const publicPlayer = game.players.find(p => p.userId === senderId);
                    if (publicPlayer && !publicPlayer.isAlive) {
                         canSend = true; chatField = 'ghostChatMessages';
                    }
                    break;
            }

            if (!canSend) throw new Error("No tienes permiso para enviar mensajes en este chat.");
            
            const messageData: ChatMessage = {id: `${Date.now()}_${senderId}`, senderId, senderName, text: text.trim(), round: game.currentRound, createdAt: new Date() };
            transaction.update(gameRef, { [chatField]: FieldValue.arrayUnion(toPlainObject(messageData)) });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}
export const sendWolfChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'wolf');
export const sendFairyChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'fairy');
export const sendTwinChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'twin');
export const sendLoversChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'lovers');
export const sendGhostChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'ghost');
export async function submitJuryVote(gameId: string, voterId: string, targetId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await gameRef.update({ [`juryVotes.${voterId}`]: targetId });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}
export async function submitHunterShot(gameId: string, hunterId: string, targetId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data() as Game;

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId) return;

            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));

            let { updatedGame, updatedPlayers, triggeredHunterId: anotherHunterId } = await killPlayer(transaction, gameRef, game, fullPlayers as Player[], targetId, 'hunter_shot', `En su último aliento, el Cazador dispara y se lleva consigo a ${game.players.find(p=>p.userId === targetId)?.displayName}.`);
            
            // Add notable play event for the hunter
            updatedGame.events.push({
                id: `evt_notable_hunter_${Date.now()}`,
                gameId: game.id,
                round: updatedGame.currentRound,
                type: 'special',
                message: 'El cazador se venga.', // Internal message
                createdAt: new Date(),
                data: {
                  notablePlayerId: hunterId,
                  notablePlay: {
                      title: '¡Última Bala!',
                      description: `Caíste, pero te llevaste a ${game.players.find(p=>p.userId === targetId)?.displayName} contigo.`,
                  },
                },
            });

            if(anotherHunterId) {
                updatedGame.pendingHunterShot = anotherHunterId;
                transaction.update(gameRef, toPlainObject(updatedGame));
            } else {
                 // Game over check or next phase logic
                 const gameOverInfo = await checkGameOver(updatedGame, updatedPlayers);
                 if (gameOverInfo.isGameOver) {
                    updatedGame.status = "finished";
                    updatedGame.phase = "finished";
                    updatedGame.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: updatedGame.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
                 } else {
                     updatedGame.phase = 'day';
                     updatedGame.pendingHunterShot = null;
                 }
                 transaction.update(gameRef, toPlainObject(updatedGame));
            }
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting hunter shot:", error);
        return { success: false, error: (error as Error).message };
    }
}
export async function executeMasterAction(gameId: string, actionId: MasterActionId, sourceId: string | null, targetId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
     try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            let game = gameDoc.data() as Game;
            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() as PlayerPrivateData }));


            if (actionId === 'master_kill') {
                 if (game.masterKillUsed) throw new Error("El Zarpazo del Destino ya ha sido utilizado.");
                 const { updatedGame } = await killPlayerUnstoppable(transaction, gameRef, game, fullPlayers, targetId, 'special', `Por intervención divina, ${game.players.find(p=>p.userId === targetId)?.displayName} ha sido eliminado.`);
                 game = updatedGame;
                 game.masterKillUsed = true;
            } else {
                const action = masterActions[actionId as keyof typeof masterActions];
                if (action) {
                    const { updatedGame } = action.execute(game, sourceId!, targetId, fullPlayers);
                    game = updatedGame;
                }
            }
            transaction.update(gameRef, toPlainObject(game));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error executing master action:", error);
        return { success: false, error: (error as Error).message };
    }
}

    
