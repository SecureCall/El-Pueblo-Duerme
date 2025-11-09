
'use client';
import { 
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  runTransaction,
  type Firestore,
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
import { secretObjectives } from "./objectives";
import { processJuryVotes as processJuryVotesEngine, killPlayer, killPlayerUnstoppable, checkGameOver, processVotes as processVotesEngine, processNight as processNightEngine } from './game-engine';
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { roleDetails } from "./roles";


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
  db: Firestore,
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
  const gameRef = doc(db, "games", gameId);
      
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

export async function joinGame(
  db: Firestore,
  gameId: string,
  userId: string,
  displayName: string,
  avatarUrl: string
) {
  const gameRef = doc(db, "games", gameId);
  
  try {
    await runTransaction(db, async (transaction) => {
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
        // Player is already in, just ensure their profile is up to date.
        const playerIndex = game.players.findIndex(p => p.userId === userId);
        if (playerIndex !== -1) {
            let changed = false;
            if(game.players[playerIndex].displayName !== displayName.trim()) {
                game.players[playerIndex].displayName = displayName.trim();
                changed = true;
            }
            if(game.players[playerIndex].avatarUrl !== avatarUrl) {
                game.players[playerIndex].avatarUrl = avatarUrl;
                changed = true;
            }
            if(changed) {
                transaction.update(gameRef, { players: toPlainObject(game.players), lastActiveAt: Timestamp.now() });
            }
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

export async function updatePlayerAvatar(db: Firestore, gameId: string, userId: string, newAvatarUrl: string) {
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
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

export async function startGame(db: Firestore, gameId: string, creatorId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
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
                 // Assign a secret objective to human players
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

export async function submitNightAction(db: Firestore, action: Omit<NightAction, 'createdAt'>) {
  const { gameId, playerId, actionType, targetId } = action;
  const gameRef = doc(db, 'games', gameId);
  try {
    await runTransaction(db, async (transaction) => {
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

export async function executeMasterAction(db: Firestore, gameId: string, actionId: string, sourceId: string | null, targetId: string) {
    const gameRef = doc(db, 'games', gameId);
     try {
        await runTransaction(db, async (transaction) => {
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

export async function submitHunterShot(db: Firestore, gameId: string, hunterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data()!;

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId || game.status === 'finished') {
                return;
            }
            
            const hunterPlayer = game.players.find(p => p.userId === hunterId)!;
            const targetPlayer = game.players.find(p => p.userId === targetId)!;

            let { updatedGame, triggeredHunterId: newTriggeredHunter } = await killPlayerUnstoppable(transaction, gameRef, game, targetId, 'hunter_shot');
            game = updatedGame;
            
             game.events.push({
                id: `evt_huntershot_${Date.now()}`, gameId, round: game.currentRound, type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
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

export async function submitVote(db: Firestore, gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    
    try {
       await runTransaction(db, async (transaction) => {
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

        const gameDoc = await getDoc(gameRef);
        if(gameDoc.exists()){
            const gameData = gameDoc.data();
            const voter = gameData.players.find(p => p.userId === voterId);
            const target = gameData.players.find(p => p.userId === targetId);
            if (voter && target && !voter.isAI) {
                await triggerAIChat(db, gameId, `${voter.displayName} ha votado por ${target.displayName}.`, 'public');
            }
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error submitting vote: ", error);
        return { error: "No se pudo registrar tu voto." };
    }
}

export async function sendChatMessage(
    db: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    isFromAI: boolean = false
) {
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(db, 'games', gameId);

    try {
        let latestGame: Game | null = null;
        await runTransaction(db, async (transaction) => {
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
            await triggerAIChat(db, gameId, triggerMessage, 'public');
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

async function sendSpecialChatMessage(
    db: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    chatType: 'wolf' | 'fairy' | 'lovers' | 'twin' | 'ghost'
) {
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
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

export const sendWolfChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'wolf');
export const sendFairyChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'fairy');
export const sendLoversChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'lovers');
export const sendTwinChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'twin');
export const sendGhostChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'ghost');


export async function resetGame(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
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

export async function submitJuryVote(db: Firestore, gameId: string, jurorId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
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

export async function submitTroublemakerAction(db: Firestore, gameId: string, troublemakerId: string, target1Id: string, target2Id: string) {
  const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;

  try {
    await runTransaction(db, async (transaction) => {
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

export async function sendGhostMessage(db: Firestore, gameId: string, ghostId: string, targetId: string, message: string) {
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
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


// ===============================================================================================
// AI ACTIONS LOGIC
// ===============================================================================================

async function triggerAIChat(db: Firestore, gameId: string, triggerMessage: string, chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost') {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
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
                        await sendChatMessage(db, gameId, aiPlayer.userId, aiPlayer.displayName, message, true);
                    }
                }).catch(aiError => console.error(`Error generating AI chat for ${aiPlayer.displayName}:`, aiError));
            }
        }
    } catch (e) {
        console.error("Error in triggerAIChat:", e);
    }
}

async function triggerPrivateAIChats(db: Firestore, gameId: string, triggerMessage: string) {
     try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        if (game.status === 'finished') return;

        const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
        const twinIds = game.twins || [];
        const loverIds = game.lovers || [];

        const wolves = game.players.filter(p => p.isAI && p.isAlive && p.role && wolfRoles.includes(p.role));
        const twins = game.players.filter(p => p.isAI && p.isAlive && twinIds.includes(p.userId));
        const lovers = game.players.filter(p => p.isAI && p.isAlive && loverIds.includes(p.userId));

        const processChat = async (players: Player[], chatType: 'wolf' | 'twin' | 'lovers', sendMessageFn: Function) => {
            for (const aiPlayer of players) {
                if (Math.random() < 0.8) { 
                    const perspective: AIPlayerPerspective = {
                        game: toPlainObject(game), aiPlayer: toPlainObject(aiPlayer), trigger: triggerMessage,
                        players: toPlainObject(game.players), chatType,
                    };
                    generateAIChatMessage(perspective).then(async ({ message, shouldSend }) => {
                        if (shouldSend && message) {
                            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
                            await sendMessageFn(db, gameId, aiPlayer.userId, aiPlayer.displayName, message);
                        }
                    }).catch(err => console.error(`Error in private AI chat for ${aiPlayer.displayName}:`, err));
                }
            }
        };

        if (wolves.length > 1) await processChat(wolves, 'wolf', sendWolfChatMessage);
        if (twins.length > 1) await processChat(twins, 'twin', sendTwinChatMessage);
        if (lovers.length > 1) await processChat(lovers, 'lovers', sendLoversChatMessage);

    } catch (e) {
        console.error("Error in triggerPrivateAIChats:", e);
    }
}


export async function triggerAIVote(db: Firestore, gameId: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;
        if (game.status === 'finished' || game.phase !== 'day') return;

        const aiPlayersToVote = game.players.filter(p => p.isAI && p.isAlive && !p.votedFor);
        const alivePlayers = game.players.filter(p => p.isAlive);
        const deadPlayers = game.players.filter(p => !p.isAlive);
        
        await triggerPrivateAIChats(db, gameId, "El día ha comenzado. ¿Por quién deberíamos votar?");

        for (const ai of aiPlayersToVote) {
            const { targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);
            if (targetId) {
                 await new Promise(resolve => setTimeout(resolve, Math.random() * 8000 + 2000));
                 await submitVote(db, gameId, ai.userId, targetId);
            }
        }

    } catch(e) {
        console.error("Error in triggerAIVote:", e);
    }
}

export const getDeterministicAIAction = (
    aiPlayer: Player,
    game: Game,
    alivePlayers: Player[],
    deadPlayers: Player[],
): { actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE', targetId: string } => {
    const { role, userId } = aiPlayer;
    const { currentRound, nightActions = [] } = game;
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
    const wolfCubRevengeActive = game.wolfCubRevengeRound === game.currentRound;
    const apprenticeIsActive = role === 'seer_apprentice' && game.seerDied;
    const canFairiesKill = game.fairiesFound && !game.fairyKillUsed && (role === 'seeker_fairy' || role === 'sleeping_fairy');

    const potentialTargets = alivePlayers.filter(p => p.userId !== userId);

    const randomTarget = (targets: Player[], count = 1): string => {
        if (targets.length === 0) return '';
        let availableTargets = [...targets];
        let selectedTargets: string[] = [];
        for (let i = 0; i < count && availableTargets.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availableTargets.length);
            const target = availableTargets.splice(randomIndex, 1)[0];
            if (target) {
                selectedTargets.push(target.userId);
            }
        }
        return selectedTargets.join('|');
    };

    if (game.phase === 'day') {
        if (aiPlayer.role === 'executioner' && aiPlayer.executionerTargetId) {
            const targetIsAlive = alivePlayers.some(p => p.userId === aiPlayer.executionerTargetId);
            if (targetIsAlive && Math.random() < 0.75) {
                return { actionType: 'VOTE', targetId: aiPlayer.executionerTargetId };
            }
        }
        return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
    }

    if (game.phase === 'hunter_shot' && game.pendingHunterShot === userId) {
        return { actionType: 'SHOOT', targetId: randomTarget(potentialTargets) };
    }

    if (game.phase !== 'night' || aiPlayer.isExiled) {
        return { actionType: 'NONE', targetId: '' };
    }

    if (canFairiesKill) {
        const nonFairies = potentialTargets.filter(p => p.role !== 'seeker_fairy' && p.role !== 'sleeping_fairy');
        return { actionType: 'fairy_kill', targetId: randomTarget(nonFairies) };
    }

    switch (role) {
        case 'werewolf':
        case 'wolf_cub': {
             const wolfActions = nightActions.filter(a => a.round === currentRound && a.actionType === 'werewolf_kill' && a.playerId !== userId && wolfRoles.includes(game.players.find(p=>p.userId === a.playerId)?.role || null));
             if (wolfActions.length > 0 && Math.random() < 0.8) { 
                 const leaderAction = wolfActions[0];
                 if (leaderAction && leaderAction.targetId) {
                    return { actionType: 'werewolf_kill', targetId: leaderAction.targetId };
                 }
             }

            const nonWolves = potentialTargets.filter(p => {
                if (p.role && wolfRoles.includes(p.role)) return false;
                if (game.witchFoundSeer && p.role === 'witch') return false; 
                return true;
            });

            const prince = nonWolves.find(p => p.princeRevealed);
            if (prince && Math.random() < 0.7) {
                return { actionType: 'werewolf_kill', targetId: prince.userId };
            }

            const playersWhoVotedForWolves = game.players.filter(p => {
                const lastVote = game.events.find(e => e.type === 'vote_result' && e.round === currentRound -1);
                if (!lastVote) return false;
                const lynchedPlayer = game.players.find(p => p.userId === lastVote.data.lynchedPlayerId);
                return p.votedFor === lynchedPlayer?.userId && lynchedPlayer?.role && wolfRoles.includes(lynchedPlayer.role);
            }).map(p => p.userId);

            const suspiciousPlayers = nonWolves.filter(p => playersWhoVotedForWolves.includes(p.userId));
            if (suspiciousPlayers.length > 0 && Math.random() < 0.6) {
                 return { actionType: 'werewolf_kill', targetId: randomTarget(suspiciousPlayers) };
            }

            const killCount = wolfCubRevengeActive ? 2 : 1;
            return { actionType: 'werewolf_kill', targetId: randomTarget(nonWolves, killCount) };
        }
        case 'seer':
        case 'seer_apprentice':
            if (role === 'seer' || apprenticeIsActive) {
                const previousTargets = nightActions.filter(a => a.playerId === userId && a.actionType === 'seer_check').map(a => a.targetId);
                const uninvestigatedTargets = potentialTargets.filter(p => !previousTargets.includes(p.userId));

                const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === currentRound - 1);
                const suspicionMap: Record<string, number> = {};
                (uninvestigatedTargets.length > 0 ? uninvestigatedTargets : potentialTargets).forEach(p => {
                     suspicionMap[p.userId] = 1;
                });
                
                if(lastVoteEvent?.data) {
                    const lynchedPlayerId = lastVoteEvent.data.lynchedPlayerId;
                    const lynchedPlayer = game.players.find(p => p.userId === lynchedPlayerId);
                    if(lynchedPlayer?.role === 'villager') {
                         game.players.filter(p => p.votedFor === lynchedPlayerId).forEach(voter => {
                            if (suspicionMap[voter.userId]) suspicionMap[voter.userId] += 10;
                         });
                    }
                    (lastVoteEvent.data.tiedPlayerIds || []).forEach((id: string) => {
                         if (suspicionMap[id]) suspicionMap[id] += 5;
                    });
                }
                
                const sortedSuspects = Object.keys(suspicionMap).sort((a,b) => suspicionMap[b] - suspicionMap[a]);
                if (sortedSuspects.length > 0 && Math.random() < 0.7) {
                    return { actionType: 'seer_check', targetId: sortedSuspects[0] };
                }

                return { actionType: 'seer_check', targetId: randomTarget(uninvestigatedTargets.length > 0 ? uninvestigatedTargets : potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'doctor':
        case 'guardian': {
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            const seer = healableTargets.find(p => p.role === 'seer');
            if (seer && Math.random() < 0.6) {
                 return { actionType: role === 'doctor' ? 'doctor_heal' : 'guardian_protect', targetId: seer.userId };
            }
            if (role === 'guardian' && (aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) {
                 return { actionType: 'guardian_protect', targetId: userId };
            }
            return { actionType: role === 'doctor' ? 'doctor_heal' : 'guardian_protect', targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
        }
        case 'priest':
            if (!aiPlayer.priestSelfHealUsed && Math.random() < 0.2) return { actionType: 'priest_bless', targetId: userId };
            const seer = potentialTargets.find(p => p.role === 'seer');
            if (seer && Math.random() < 0.5) return { actionType: 'priest_bless', targetId: seer.userId };
            return { actionType: 'priest_bless', targetId: randomTarget(potentialTargets) };
        case 'resurrector_angel':
            if (!aiPlayer.resurrectorAngelUsed && deadPlayers.length > 0) {
                 return { actionType: 'resurrect', targetId: randomTarget(deadPlayers, 1) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'vampire': {
            const biteableTargets = potentialTargets.filter(p => (p.biteCount || 0) < 3);
            return { actionType: 'vampire_bite', targetId: randomTarget(biteableTargets.length > 0 ? biteableTargets : potentialTargets) };
        }
        case 'cult_leader': {
            const nonCultMembers = potentialTargets.filter(p => !p.isCultMember);
            return { actionType: 'cult_recruit', targetId: randomTarget(nonCultMembers) };
        }
        case 'fisherman': {
            const nonBoatTargets = potentialTargets.filter(p => !game.boat?.includes(p.userId));
            return { actionType: 'fisherman_catch', targetId: randomTarget(nonBoatTargets) };
        }
        case 'silencer':
        case 'elder_leader':
             return { actionType: role === 'silencer' ? 'silencer_silence' : 'elder_leader_exile', targetId: randomTarget(potentialTargets) };
        case 'seeker_fairy':
            if (!game.fairiesFound) {
                 const sleepingFairy = alivePlayers.find(p => p.role === 'sleeping_fairy');
                 if (sleepingFairy && Math.random() < 0.25) {
                     return { actionType: 'fairy_find', targetId: sleepingFairy.userId };
                 }
                 return { actionType: 'fairy_find', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'witch':
            if (!game.witchFoundSeer) {
                return { actionType: 'witch_hunt', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'cupid':
            if (currentRound === 1) {
                return { actionType: 'cupid_love', targetId: randomTarget(potentialTargets, 2) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'shapeshifter':
            if (currentRound === 1) {
                return { actionType: 'shapeshifter_select', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'virginia_woolf':
            if (currentRound === 1) {
                return { actionType: 'virginia_woolf_link', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'river_siren':
            if (currentRound === 1) {
                return { actionType: 'river_siren_charm', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'hechicera':
             const hasPoison = !aiPlayer.potions?.poison;
             if (hasPoison) {
                 return { actionType: 'hechicera_poison', targetId: randomTarget(potentialTargets) };
             }
             return { actionType: 'NONE', targetId: '' };
        case 'executioner':
            return { actionType: 'NONE', targetId: '' };
        default:
            return { actionType: 'NONE', targetId: '' };
    }
};

export async function runAIActions(db: Firestore, gameId: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if(game.phase !== 'night' || game.status === 'finished') return;

        await triggerPrivateAIChats(db, gameId, "La noche ha caído. ¿Cuál es nuestro plan?");

        const aiPlayers = game.players.filter(p => p.isAI && p.isAlive && !p.usedNightAbility);
        const alivePlayers = game.players.filter(p => p.isAlive);
        const deadPlayers = game.players.filter(p => !p.isAlive);

        for (const ai of aiPlayers) {
            const { actionType, targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);

            if (!actionType || actionType === 'NONE' || !targetId || actionType === 'VOTE' || actionType === 'SHOOT') continue;

            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
            await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType, targetId });
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}


export async function runAIHunterShot(db: Firestore, gameId: string, hunter: Player) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunter.userId) return;

        const alivePlayers = game.players.filter(p => p.isAlive && p.userId !== hunter.userId);
        
        const { targetId } = getDeterministicAIAction(hunter, game, alivePlayers, []);

        if (targetId) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            await submitHunterShot(db, gameId, hunter.userId, targetId);
        } else {
             console.error(`AI Hunter ${hunter.displayName} could not find a target to shoot.`);
        }

    } catch(e) {
         console.error("Error in runAIHunterShot:", e);
    }
}

export async function processNight(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(db, async (transaction) => {
            await processNightEngine(transaction, gameRef);
        });
    } catch (e) {
        console.error("Failed to process night", e);
    }
}

export async function processVotes(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(db, async (transaction) => {
            await processVotesEngine(transaction, gameRef);
        });
    } catch (e) {
        console.error("Failed to process votes", e);
    }
}

export async function processJuryVotes(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(db, async (transaction) => {
            await processJuryVotesEngine(transaction, gameRef);
        });
    } catch (e) {
        console.error("Failed to process jury votes", e);
    }
}

    