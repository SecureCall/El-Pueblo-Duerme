
'use server';
import { 
  type Game, 
  type Player, 
  type PlayerPublicData,
  type PlayerPrivateData,
  type PlayerRole, 
} from "@/types";
import { adminDb, FieldValue } from './firebase-admin';
import { toPlainObject, splitPlayerData } from "./utils";
import { secretObjectives } from "./objectives";
import { generateRoles } from './game-engine';

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
    bansheePoints: 0,
    lookoutUsed: false,
    executionerTargetId: null,
    secretObjectiveId: null,
    lastActiveAt: new Date(),
    seerChecks: [],
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
      events: [],
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
      playerCount: 1,
  };
    
  try {
    const batch = adminDb.batch();
    
    batch.set(gameRef, toPlainObject(gameData));
    
    const privateDataRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(userId);
    batch.set(privateDataRef, toPlainObject(creatorPrivateData));
    
    const publicPlayerRef = adminDb.collection('games').doc(gameId).collection('players').doc(userId);
    batch.set(publicPlayerRef, toPlainObject(creatorPublicData));

    if (settings.isPublic) {
      const publicGameRef = adminDb.collection("publicGames").doc(gameId);
      batch.set(publicGameRef, {
        name: gameName.trim(),
        creatorId: userId,
        creatorName: displayName,
        playerCount: 1,
        maxPlayers: maxPlayers,
        lastActiveAt: new Date(),
      });
    }
    
    await batch.commit();

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
  const { gameId, userId, displayName, avatarUrl } = options;
  const gameRef = adminDb.collection("games").doc(gameId);
  const playerPublicRef = gameRef.collection('players').doc(userId);
  const privateDataRef = gameRef.collection('playerData').doc(userId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists) throw new Error("Partida no encontrada.");

      const game = gameSnap.data() as Game;

      if (game.status !== "waiting" && !(await transaction.get(playerPublicRef)).exists) {
        throw new Error("Esta partida ya ha comenzado.");
      }
      
      const playerSnap = await transaction.get(playerPublicRef);
      if (playerSnap.exists) return; // Player already in game
      
      const playersInGameSnap = await transaction.get(gameRef.collection('players'));
      const nameExists = playersInGameSnap.docs.some(doc => doc.data().displayName.trim().toLowerCase() === displayName.trim().toLowerCase());
      if (nameExists) throw new Error("Ese nombre ya está en uso en esta partida.");

      if (playersInGameSnap.size >= game.maxPlayers) throw new Error("Esta partida está llena.");
      
      const newPlayer = createPlayerObject(userId, gameId, displayName, avatarUrl, false);
      const { publicData, privateData } = splitPlayerData(newPlayer);
      
      transaction.set(privateDataRef, toPlainObject(privateData));
      transaction.set(playerPublicRef, toPlainObject(publicData));
      
      const updateData: any = {
        playerCount: FieldValue.increment(1),
        lastActiveAt: new Date(),
      };
      
      transaction.update(gameRef, updateData);

      if (game.settings.isPublic) {
        const publicGameRef = adminDb.collection("publicGames").doc(gameId);
        transaction.update(publicGameRef, {
          playerCount: FieldValue.increment(1),
          lastActiveAt: new Date(),
        });
      }
    });

    return { success: true };

  } catch(error: any) {
    console.error("Error joining game:", error);
    return { error: `No se pudo unir a la partida: ${error.message}` };
  }
}


export async function startGame(gameId: string, creatorId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);
    
    try {
        await adminDb.runTransaction(async (transaction) => {
            // ================== 1. READ PHASE ==================
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists) throw new Error('Partida no encontrada.');
            
            const playersSnap = await transaction.get(gameRef.collection('players'));
            
            // ================== 2. PREPARE IN-MEMORY ==================
            const game = gameSnap.data() as Game;

            if (game.creator !== creatorId) throw new Error('Solo el creador puede iniciar la partida.');
            if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado.');
            
            const existingPlayers = playersSnap.docs.map(doc => doc.data() as PlayerPublicData);
            let finalPlayerPublicData: PlayerPublicData[] = [...existingPlayers];
            
            // Generate AI players if needed
            const aiPlayersToCreate: { publicData: PlayerPublicData, privateData: PlayerPrivateData }[] = [];
            if (game.settings.fillWithAI && finalPlayerPublicData.length < game.maxPlayers) {
                const aiPlayerCount = game.maxPlayers - finalPlayerPublicData.length;
                const availableAINames = AI_NAMES.filter(name => !finalPlayerPublicData.some(p => p.displayName === name));

                for (let i = 0; i < aiPlayerCount; i++) {
                    const aiUserId = `ai_${Date.now()}_${i}`;
                    const aiName = availableAINames[i % availableAINames.length] || `Bot ${i + 1}`;
                    const aiAvatar = `/logo.png`;
                    const aiPlayer = createPlayerObject(aiUserId, gameId, aiName, aiAvatar, true);
                    const { publicData, privateData } = splitPlayerData(aiPlayer);
                    
                    aiPlayersToCreate.push({ publicData, privateData });
                    finalPlayerPublicData.push(publicData);
                }
            }

            const finalPlayerCount = finalPlayerPublicData.length;
            if (finalPlayerCount < MINIMUM_PLAYERS) {
                throw new Error(`Se necesitan al menos ${MINIMUM_PLAYERS} jugadores para comenzar.`);
            }
            
            const newRoles = generateRoles(finalPlayerCount, game.settings);
            const allPrivateData: Record<string, PlayerPrivateData> = {};

            // Initialize private data for all players
            finalPlayerPublicData.forEach((player, index) => {
                const role = newRoles[index];
                const { privateData } = splitPlayerData(createPlayerObject(player.userId, gameId, player.displayName, player.avatarUrl, player.isAI));
                privateData.role = role;
                
                if (role === 'cult_leader') privateData.isCultMember = true;

                if (!player.isAI) {
                    const applicableObjectives = secretObjectives.filter(obj => 
                        obj.appliesTo.includes('any') || obj.appliesTo.includes(role!)
                    );
                    if (applicableObjectives.length > 0) {
                        privateData.secretObjectiveId = applicableObjectives[Math.floor(Math.random() * applicableObjectives.length)].id;
                    }
                }
                allPrivateData[player.userId] = privateData;
            });
            
            // Handle special interdependent roles (Executioner)
            const executionerEntry = Object.entries(allPrivateData).find(([, data]) => data.role === 'executioner');
            if (executionerEntry) {
                const executionerId = executionerEntry[0];
                const wolfTeamRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch'];
                const potentialTargets = finalPlayerPublicData.filter(p => {
                    const pRole = allPrivateData[p.userId].role;
                    return p.userId !== executionerId && pRole && !wolfTeamRoles.includes(pRole);
                });
                
                if (potentialTargets.length > 0) {
                    const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                    allPrivateData[executionerId].executionerTargetId = target.userId;
                }
            }

            const twinUserIds = Object.entries(allPrivateData).filter(([, data]) => data.role === 'twin').map(([id]) => id);

            // ================== 3. WRITE PHASE ==================
            // Write AI public data
            aiPlayersToCreate.forEach(ai => {
                const aiPublicRef = gameRef.collection('players').doc(ai.publicData.userId);
                transaction.set(aiPublicRef, toPlainObject(ai.publicData));
            });

            // Write all private data (for both humans and AI)
            for (const [userId, privateData] of Object.entries(allPrivateData)) {
                const privateRef = gameRef.collection('playerData').doc(userId);
                transaction.set(privateRef, toPlainObject(privateData));
            }
            
            // Update the main game document
            transaction.update(gameRef, toPlainObject({
                twins: twinUserIds.length === 2 ? [twinUserIds[0], twinUserIds[1]] : null,
                status: 'in_progress',
                phase: 'role_reveal',
                phaseEndsAt: new Date(Date.now() + 15000),
                playerCount: finalPlayerCount, // Use the real count
            }));

            // If the game was public, remove it from the public listing
            if (game.settings.isPublic) {
              const publicGameRef = adminDb.collection("publicGames").doc(gameId);
              transaction.delete(publicGameRef);
            }
        });
        
        return { success: true };

    } catch (e: any) {
        console.error("Error starting game:", e);
        return { error: e.message || 'Error al iniciar la partida.' };
    }
}

export async function resetGame(gameId: string) {
    const gameRef = adminDb.collection('games').doc(gameId);

    try {
        await adminDb.runTransaction(async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists) throw new Error("Partida no encontrada.");
            const game = gameSnap.data() as Game;

            const playersSnap = await transaction.get(gameRef.collection('players'));
            const currentPlayers = playersSnap.docs.map(d => d.data() as PlayerPublicData);

            const humanPlayers = currentPlayers.filter(p => !p.isAI);

            // Batch delete AI players and reset human players
            for (const player of currentPlayers) {
                if (player.isAI) {
                    // Delete AI player documents
                    transaction.delete(gameRef.collection('players').doc(player.userId));
                    transaction.delete(gameRef.collection('playerData').doc(player.userId));
                } else {
                    // Reset human player to default state, preserving key info
                    const newPlayer = createPlayerObject(player.userId, game.id, player.displayName, player.avatarUrl, player.isAI);
                    newPlayer.joinedAt = player.joinedAt; // Preserve original join time
                    const { publicData, privateData } = splitPlayerData(newPlayer);
                    transaction.set(gameRef.collection('players').doc(player.userId), toPlainObject(publicData));
                    transaction.set(gameRef.collection('playerData').doc(player.userId), toPlainObject(privateData));
                }
            }

            if (game.settings.isPublic) {
              const publicGameRef = adminDb.collection("publicGames").doc(gameId);
              transaction.set(publicGameRef, {
                name: game.name,
                creatorId: game.creator,
                creatorName: humanPlayers.find(p => p.userId === game.creator)?.displayName || 'Desconocido',
                playerCount: humanPlayers.length,
                maxPlayers: game.maxPlayers,
                lastActiveAt: new Date(),
              });
            }

            // Reset game document
            transaction.update(gameRef, toPlainObject({
                status: 'waiting', phase: 'waiting', currentRound: 0,
                events: [], nightActions: [],
                twins: null, lovers: null, phaseEndsAt: new Date(), pendingHunterShot: null,
                pendingTroublemakerDuel: null,
                wolfCubRevengeRound: 0,
                playerCount: humanPlayers.length, // Correctly update playerCount
                vampireKills: 0, boat: [],
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
