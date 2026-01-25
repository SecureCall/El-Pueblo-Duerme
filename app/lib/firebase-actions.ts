
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
  type AIPlayerPerspective,
  PlayerPublicData,
  PlayerPrivateData
} from "@/types";
import { toPlainObject } from "./utils";
import { masterActions } from "./master-actions";
import { secretObjectives } from "./objectives";
import { processJuryVotes as processJuryVotesEngine, killPlayer, killPlayerUnstoppable, checkGameOver, processVotes as processVotesEngine, processNight as processNightEngine } from './game-engine';
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { getAuthenticatedSdks } from "./firebase-server";
import { runAIActions, runAIHunterShot } from "./ai-actions";


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

function splitPlayerData(player: Player): { publicData: PlayerPublicData, privateData: PlayerPrivateData } {
  return {
    publicData: {
      userId: player.userId,
      gameId: player.gameId,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      isAlive: player.isAlive,
      isAI: player.isAI,
      isExiled: player.isExiled,
      princeRevealed: player.princeRevealed,
      biteCount: player.biteCount,
      isCultMember: player.isCultMember,
      isLover: player.isLover,
      joinedAt: player.joinedAt,
      votedFor: player.votedFor,
    },
    privateData: {
      role: player.role,
      secretObjectiveId: player.secretObjectiveId,
      executionerTargetId: player.executionerTargetId,
      potions: player.potions,
      priestSelfHealUsed: player.priestSelfHealUsed,
      guardianSelfProtects: player.guardianSelfProtects,
      usedNightAbility: player.usedNightAbility,
      shapeshifterTargetId: player.shapeshifterTargetId,
      virginiaWoolfTargetId: player.virginiaWoolfTargetId,
      riverSirenTargetId: player.riverSirenTargetId,
      ghostMessageSent: player.ghostMessageSent,
      resurrectorAngelUsed: player.resurrectorAngelUsed,
      bansheeScreams: player.bansheeScreams,
      lookoutUsed: player.lookoutUsed,
      lastHealedRound: player.lastHealedRound,
    }
  };
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
  const { firestore } = await getAuthenticatedSdks();
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
  const { publicData, privateData } = splitPlayerData(creatorPlayer);

  const gameData: Game = {
      id: gameId,
      name: gameName.trim(),
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
    const creatorPrivateRef = doc(firestore, `games/${gameId}/playerData/${userId}`);
    
    await runTransaction(firestore, async (transaction) => {
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
  const { firestore } = await getAuthenticatedSdks();
  const { gameId, userId, displayName, avatarUrl } = options;
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
      const playerPrivateRef = doc(firestore, `games/${gameId}/playerData/${userId}`);

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

const generateRoles = (playerCount: number, settings: Game['settings']): (PlayerRole)[] => {
    let roles: PlayerRole[] = [];
    
    const numWerewolves = Math.max(1, Math.floor(playerCount / 5));
    for (let i = 0; i < numWerewolves; i++) {
        roles.push('werewolf');
    }

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
    
    while (roles.length < playerCount) {
        roles.push('villager');
    }

    return roles.sort(() => Math.random() - 0.5);
};

export async function startGame(gameId: string, creatorId: string) {
    const { firestore } = await getAuthenticatedSdks();
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
            
            let finalPublicPlayers = [...game.players];
            let allPlayersFullData: Player[] = [];

            // Reconstruct full data for existing players
            for (const publicPlayer of game.players) {
                const privateDataDoc = await transaction.get(doc(firestore, `games/${gameId}/playerData/${publicPlayer.userId}`));
                if(privateDataDoc.exists()){
                    allPlayersFullData.push({ ...publicPlayer, ...privateDataDoc.data() } as Player);
                }
            }
            
            // Add AI players if needed
            if (game.settings.fillWithAI && finalPublicPlayers.length < game.maxPlayers) {
                const aiPlayerCount = game.maxPlayers - finalPublicPlayers.length;
                const availableAINames = AI_NAMES.filter(name => !finalPublicPlayers.some(p => p.displayName === name));

                for (let i = 0; i < aiPlayerCount; i++) {
                    const aiUserId = `ai_${Date.now()}_${i}`;
                    const aiName = availableAINames[i % availableAINames.length] || `Bot ${i + 1}`;
                    const aiAvatar = `/logo.png`;
                    const aiPlayerData = createPlayerObject(aiUserId, gameId, aiName, aiAvatar, true);
                    allPlayersFullData.push(aiPlayerData);
                }
            }
            
            const totalPlayers = allPlayersFullData.length;
            if (totalPlayers < MINIMUM_PLAYERS) {
                throw new Error(`Se necesitan al menos ${MINIMUM_PLAYERS} jugadores para comenzar.`);
            }
            
            const newRoles = generateRoles(totalPlayers, game.settings);
            
            // Assign roles and objectives
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
            
            // Update all documents in a single transaction
            const publicPlayersData: PlayerPublicData[] = [];
            finalPlayersWithRoles.forEach(player => {
                const { publicData, privateData } = splitPlayerData(player);
                publicPlayersData.push(publicData);
                const playerPrivateRef = doc(firestore, `games/${gameId}/playerData/${player.userId}`);
                transaction.set(playerPrivateRef, toPlainObject(privateData), { merge: true });
            });

            transaction.update(gameRef, toPlainObject({
                players: publicPlayersData,
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
// ... the rest of the file remains the same ...
