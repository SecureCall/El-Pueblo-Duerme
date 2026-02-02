
'use server';
import { 
  FieldValue,
  runTransaction
} from "firebase-admin/firestore";
import { 
  type Game, 
  type Player, 
  type PlayerPublicData,
  type PlayerPrivateData,
  type PlayerRole, 
} from "@/types";
import { adminDb } from "./server-init";
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

    if (settings.isPublic) {
      const publicGameRef = adminDb.collection("publicGames").doc(gameId);
      await publicGameRef.set({
        name: gameName.trim(),
        creatorId: userId,
        creatorName: displayName,
        playerCount: 1,
        maxPlayers: maxPlayers,
        lastActiveAt: new Date(),
      });
    }

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
      
      const updateData: any = {
        players: FieldValue.arrayUnion(toPlainObject(publicData)),
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

            transaction.update(gameRef, toPlainObject({
                status: 'waiting', phase: 'waiting', currentRound: 0,
                events: [], nightActions: [],
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

    
