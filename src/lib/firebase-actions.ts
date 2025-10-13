
'use client';
import { 
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  increment,
  runTransaction,
  type Firestore,
  type Transaction,
  DocumentReference,
  collection,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import type { Game, Player, NightAction, GameEvent, PlayerRole, NightActionType, ChatMessage, AIPlayerPerspective } from "@/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { roleDetails } from "@/lib/roles";

function generateGameId(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const createPlayerObject = (userId: string, gameId: string, displayName: string, isAI: boolean = false): Player => ({
    userId,
    gameId,
    displayName: displayName.trim(),
    role: null,
    isAlive: true,
    votedFor: null,
    joinedAt: Timestamp.now(),
    isAI,
    lastHealedRound: 0,
    potions: {
        poison: null,
        save: null,
    },
    priestSelfHealUsed: false,
    princeRevealed: false,
});


export async function createGame(
  db: Firestore,
  userId: string,
  displayName: string,
  gameName: string,
  maxPlayers: number,
  settings: Game['settings']
) {
  if (!userId || !displayName?.trim() || !gameName?.trim()) {
    return { error: "Datos incompletos para crear la partida." };
  }
  if (maxPlayers < 3 || maxPlayers > 32) {
    return { error: "El número de jugadores debe ser entre 3 y 32." };
  }

  const gameId = generateGameId();
  const gameRef = doc(db, "games", gameId);
      
  const werewolfCount = Math.max(1, Math.floor(maxPlayers / 5));

  const gameData: Omit<Game, 'id'> = {
      name: gameName.trim(),
      status: "waiting",
      phase: "waiting", 
      creator: userId,
      players: [], 
      events: [],
      chatMessages: [],
      maxPlayers: maxPlayers,
      createdAt: Timestamp.now(),
      currentRound: 0,
      settings: {
          ...settings,
          werewolves: werewolfCount,
      },
      pendingHunterShot: null,
      lovers: null,
      twins: null,
      wolfCubRevengeRound: 0,
      nightActions: [],
  };
  
  try {
    await setDoc(gameRef, gameData);
    
    // Unirse a la partida después de crearla
    const joinResult = await joinGame(db, gameId, userId, displayName);
    if (joinResult.error) {
      // A pesar de que la partida se creó, si el creador no puede unirse, es un error crítico.
      console.error(`Game created (${gameId}), but creator failed to join:`, joinResult.error);
      return { error: `La partida se creó, pero no se pudo unir: ${joinResult.error}` };
    }

    return { gameId };
  } catch (error: any) {
    if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: gameRef.path,
            operation: 'create',
            requestResourceData: gameData,
        });
        errorEmitter.emit('permission-error', permissionError);
        return { error: "Permiso denegado al crear la partida." };
    }
    console.error("Error creating game:", error);
    return { error: `Error al crear la partida: ${error.message || 'Error desconocido'}` };
  }
}

export async function joinGame(
  db: Firestore,
  gameId: string,
  userId: string,
  displayName: string
) {
  const gameRef = doc(db, "games", gameId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);

      if (!gameSnap.exists()) {
        throw new Error("Partida no encontrada.");
      }

      const game = gameSnap.data() as Game;

      if (game.status !== "waiting") {
        throw new Error("La partida ya ha comenzado.");
      }
      
      const playerExists = game.players.some(p => p.userId === userId);
      
      const nameExists = game.players.some(p => p.displayName.toLowerCase() === displayName.trim().toLowerCase());
      if (nameExists && !playerExists) {
        throw new Error("Ese nombre ya está en uso en esta partida.");
      }

      if (game.players.length >= game.maxPlayers && !playerExists) {
        throw new Error("Esta partida está llena.");
      }
      
      if (!playerExists) {
        const newPlayer = createPlayerObject(userId, gameId, displayName, false);
        transaction.update(gameRef, {
          players: arrayUnion(newPlayer),
        });
      }
    });

    return { success: true };

  } catch(error: any) {
    if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: gameRef.path,
            operation: 'update',
            requestResourceData: { players: '...' },
        });
        errorEmitter.emit('permission-error', permissionError);
        return { error: "Permiso denegado al unirse a la partida." };
    }
    console.error("Error joining game:", error);
    return { error: `No se pudo unir a la partida: ${error.message}` };
  }
}

const generateRoles = (playerCount: number, settings: Game['settings']): (PlayerRole)[] => {
    let roles: (PlayerRole)[] = [];
    const specialRoles: Exclude<NonNullable<PlayerRole>, 'villager' | 'werewolf'>[] = Object.keys(settings)
        .filter(key => key !== 'werewolves' && key !== 'fillWithAI' && settings[key as keyof typeof settings] === true) as any;

    // Add werewolves first
    const numWerewolves = Math.max(1, Math.floor(playerCount / 5));
    for (let i = 0; i < numWerewolves; i++) {
        if(roles.length < playerCount) roles.push('werewolf');
    }

    // Add selected special roles
    for (const role of specialRoles) {
        if (role === 'twin') {
            if (roles.length < playerCount - 1) {
                roles.push('twin', 'twin');
            }
        } else {
            if (roles.length < playerCount) {
                roles.push(role);
            }
        }
    }
    
    // Fill the rest with villagers
    while (roles.length < playerCount) {
        roles.push('villager');
    }

    // Trim excess roles if any
    roles = roles.slice(0, playerCount);

    // Ensure there is at least one werewolf if roles were manually selected
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
    const hasWolfRole = roles.some(r => wolfRoles.includes(r));
    
    if (!hasWolfRole && playerCount > 0) {
        const villagerIndex = roles.indexOf('villager');
        if (villagerIndex !== -1) {
            roles[villagerIndex] = 'werewolf';
        } else if (roles.length > 0) { // If no villagers, replace the last role
            roles[roles.length - 1] = 'werewolf';
        } else { // Should not happen, but as a fallback
            roles.push('werewolf');
        }
    }
    
    // Shuffle and return
    return roles.sort(() => Math.random() - 0.5);
};


const AI_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jessie", "Jamie", "Kai", "Rowan"];

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
                    const aiPlayerData = createPlayerObject(aiUserId, gameId, aiName, true);
                    finalPlayers.push(aiPlayerData);
                }
            }
            
            const totalPlayers = finalPlayers.length;
            if (totalPlayers < 3) {
                throw new Error('Se necesitan al menos 3 jugadores para comenzar.');
            }
            
            const newRoles = generateRoles(finalPlayers.length, game.settings);
            const assignedPlayers = finalPlayers.map((player, index) => ({
                ...player,
                role: newRoles[index],
            }));

            const twinUserIds = assignedPlayers.filter(p => p.role === 'twin').map(p => p.userId);
            
            transaction.update(gameRef, {
                players: assignedPlayers,
                twins: twinUserIds.length === 2 ? twinUserIds : null,
                status: 'in_progress',
                phase: 'role_reveal',
                currentRound: 1,
            });
        });
        
        return { success: true };

    } catch (e: any) {
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al iniciar la partida." };
        }
        console.error("Error starting game:", e);
        return { error: e.message || 'Error al iniciar la partida.' };
    }
}


export async function submitNightAction(db: Firestore, action: Omit<NightAction, 'createdAt' | 'round'> & { round: number }) {
  const { gameId } = action;
  const gameRef = doc(db, 'games', gameId);
  try {
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        
        let game = gameSnap.data() as Game;
        const player = game.players.find(p => p.userId === action.playerId);
        if (!player) throw new Error("Player not found");
        
        const nightActions = game.nightActions ? [...game.nightActions] : [];
        const existingActionIndex = nightActions.findIndex(a => a.round === action.round && a.playerId === action.playerId);

        // Client-side validation should prevent this, but double check on server
        if (action.actionType === 'doctor_heal') {
            const targetPlayer = game.players.find(p => p.userId === action.targetId);
            if (targetPlayer?.lastHealedRound === game.currentRound - 1) {
                // We don't throw an error, we just ignore the action.
                console.warn(`Doctor ${action.playerId} tried to heal ${action.targetId} two nights in a row. Action ignored.`);
                return; 
            }
        }
        if (action.actionType === 'hechicera_poison' && player.potions?.poison) throw new Error("Ya has usado tu poción de veneno.");
        if (action.actionType === 'hechicera_save' && player.potions?.save) throw new Error("Ya has usado tu poción de salvación.");
        if (action.actionType === 'priest_bless' && action.targetId === action.playerId && player.priestSelfHealUsed) {
            throw new Error("Ya te has bendecido a ti mismo una vez.");
        }
        
        // Remove previous actions for this player this round
        if (existingActionIndex > -1) {
            nightActions.splice(existingActionIndex, 1);
        }

        const newAction: NightAction = { ...action, createdAt: Timestamp.now() };
        
        let players = [...game.players];
        const playerIndex = players.findIndex(p => p.userId === action.playerId);
        
        if (action.actionType === 'doctor_heal') {
            const targetIndex = players.findIndex(p => p.userId === action.targetId);
            if (targetIndex > -1) {
                players[targetIndex].lastHealedRound = action.round;
            }
        } else if (action.actionType === 'hechicera_poison') {
            players[playerIndex].potions!.poison = action.round;
        } else if (action.actionType === 'hechicera_save') {
            players[playerIndex].potions!.save = action.round;
        } else if (action.actionType === 'priest_bless' && action.targetId === action.playerId) {
            players[playerIndex].priestSelfHealUsed = true;
        }

        nightActions.push(newAction);

        transaction.update(gameRef, {
            nightActions,
            players,
        });
    });

    await checkEndNightEarly(db, action.gameId);
    return { success: true };

  } catch (error: any) {
    if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: gameRef.path,
            operation: 'update',
            requestResourceData: { nightActions: '...' }
        });
        errorEmitter.emit('permission-error', permissionError);
        return { error: "Permiso denegado al realizar la acción nocturna." };
    }
    console.error("Error submitting night action: ", error);
    return { success: false, error: error.message || "No se pudo registrar tu acción." };
  }
}

export async function submitCupidAction(db: Firestore, gameId: string, cupidId: string, target1Id: string, target2Id: string) {
    const gameRef = doc(db, 'games', gameId);
    try {
        await updateDoc(gameRef, {
            lovers: [target1Id, target2Id],
            nightActions: arrayUnion({
                gameId,
                round: 1,
                playerId: cupidId,
                actionType: 'cupid_enchant',
                targetId: `${target1Id}|${target2Id}`,
                createdAt: Timestamp.now(),
            } as NightAction)
        });

        return { success: true };
    } catch (error) {
        if ((error as any).code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: { lovers: [target1Id, target2Id] },
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al elegir enamorados." };
        }
        console.error("Error submitting cupid action: ", error);
        return { error: "No se pudo registrar tu acción." };
    }
}

// This function modifies the game state directly (pass by reference)
function killPlayer(
    gameData: Game,
    playerIdsToKill: string[]
): { updatedGame: Game; triggeredHunterId: string | null } {
    let hunterTriggeredId: string | null = null;
    const killedThisTurn = new Set<string>();

    for (const playerId of playerIdsToKill) {
        if (killedThisTurn.has(playerId)) continue;

        const playerIndex = gameData.players.findIndex(p => p.userId === playerId);
        if (playerIndex === -1 || !gameData.players[playerIndex].isAlive) continue;

        const playerToKill = gameData.players[playerIndex];
        gameData.players[playerIndex].isAlive = false;
        killedThisTurn.add(playerId);

        // Check for special roles on death
        if (playerToKill.role === 'hunter' && gameData.settings.hunter) {
            hunterTriggeredId = playerToKill.userId;
        }
        if (playerToKill.role === 'wolf_cub' && gameData.settings.wolf_cub) {
            gameData.wolfCubRevengeRound = gameData.currentRound + 1;
        }

        // Check for lover's death
        if (gameData.lovers?.includes(playerToKill.userId)) {
            const otherLoverId = gameData.lovers.find(id => id !== playerToKill.userId)!;
            const otherLoverIndex = gameData.players.findIndex(p => p.userId === otherLoverId && p.isAlive);

            if (otherLoverIndex !== -1) {
                const otherLover = gameData.players[otherLoverIndex];
                gameData.players[otherLoverIndex].isAlive = false;
                killedThisTurn.add(otherLoverId);
                
                gameData.events.push({
                    id: `evt_${Date.now()}_${Math.random()}`,
                    gameId: gameData.id,
                    round: gameData.currentRound,
                    type: 'lover_death',
                    message: `${otherLover.displayName} no pudo soportar la pérdida de ${playerToKill.displayName} y ha muerto de desamor.`,
                    createdAt: Timestamp.now(),
                    data: { killedPlayerId: otherLoverId }
                });

                if (otherLover.role === 'hunter' && gameData.settings.hunter && !hunterTriggeredId) {
                    hunterTriggeredId = otherLover.userId;
                }
            }
        }
    }
    
    if (hunterTriggeredId) {
        gameData.pendingHunterShot = hunterTriggeredId;
        gameData.phase = 'hunter_shot';
    }

    return { updatedGame: gameData, triggeredHunterId: hunterTriggeredId };
}


function sanitizeValue(value: any): any {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString(); // Convert Timestamp to ISO string
    }
    if (value instanceof Date) {
        return value.toISOString(); // Convert Date to ISO string
    }
    if (value === undefined) {
        return null; // Firestore doesn't support undefined, use null instead
    }
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    // It's a plain object, recursively sanitize its properties
    const sanitizedObject: { [key: string]: any } = {};
    for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            const sanitized = sanitizeValue(value[key]);
            if (sanitized !== undefined) {
                 sanitizedObject[key] = sanitized;
            }
        }
    }
    return sanitizedObject;
}


function sanitizeGameForUpdate(gameData: Partial<Game>): { [key: string]: any } {
    const sanitizedGame = { ...gameData };

    for (const key in sanitizedGame) {
        if (Object.prototype.hasOwnProperty.call(sanitizedGame, key)) {
            const typedKey = key as keyof Game;
            if (sanitizedGame[typedKey] === undefined) {
                delete sanitizedGame[typedKey];
            } else {
                 (sanitizedGame as any)[typedKey] = sanitizeValue(sanitizedGame[typedKey]);
            }
        }
    }

    // This is a workaround for Firestore transactions which don't like ISO strings for dates
    // We convert them back to Timestamps ONLY for the final update.
    const finalUpdateObject = { ...sanitizedGame };
    if (finalUpdateObject.createdAt && typeof finalUpdateObject.createdAt === 'string') {
        finalUpdateObject.createdAt = Timestamp.fromDate(new Date(finalUpdateObject.createdAt));
    }
    if (finalUpdateObject.players) {
        finalUpdateObject.players = finalUpdateObject.players.map((p: any) => ({
            ...p,
            joinedAt: (p.joinedAt && typeof p.joinedAt === 'string') ? Timestamp.fromDate(new Date(p.joinedAt)) : p.joinedAt
        }));
    }
     if (finalUpdateObject.events) {
        finalUpdateObject.events = finalUpdateObject.events.map((e: any) => ({
            ...e,
            createdAt: (e.createdAt && typeof e.createdAt === 'string') ? Timestamp.fromDate(new Date(e.createdAt)) : e.createdAt
        }));
    }
    if (finalUpdateObject.chatMessages) {
        finalUpdateObject.chatMessages = finalUpdateObject.chatMessages.map((m: any) => ({
            ...m,
            createdAt: (m.createdAt && typeof m.createdAt === 'string') ? Timestamp.fromDate(new Date(m.createdAt)) : m.createdAt
        }));
    }
    if (finalUpdateObject.nightActions) {
        finalUpdateObject.nightActions = finalUpdateObject.nightActions.map((a: any) => ({
            ...a,
            createdAt: (a.createdAt && typeof a.createdAt === 'string') ? Timestamp.fromDate(new Date(a.createdAt)) : a.createdAt
        }));
    }


    return finalUpdateObject;
}


async function checkGameOver(gameData: Game): Promise<{ game: Game, isOver: boolean }> {
    let newGameData = { ...gameData };

    const alivePlayers = newGameData.players.filter(p => p.isAlive);
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub'];
    const aliveWerewolves = alivePlayers.filter(p => wolfRoles.includes(p.role));
    const aliveVillagers = alivePlayers.filter(p => !wolfRoles.includes(p.role));

    let gameOver = false;
    let message = "";
    let winners: string[] = [];

    if (newGameData.lovers) {
        const aliveLovers = alivePlayers.filter(p => newGameData.lovers!.includes(p.userId));
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length >= 2) {
            gameOver = true;
            const lover1 = newGameData.players.find(p => p.userId === newGameData.lovers![0]);
            const lover2 = newGameData.players.find(p => p.userId === newGameData.lovers![1]);
            message = `¡Los enamorados han ganado! Desafiando a sus bandos, ${lover1?.displayName} y ${lover2?.displayName} han triunfado solos contra el mundo.`;
            winners = newGameData.lovers;
        }
    }
    
    if (!gameOver) {
        if (aliveWerewolves.length === 0 && aliveVillagers.length > 0) {
            gameOver = true;
            message = "¡El pueblo ha ganado! Todos los hombres lobo han sido eliminados.";
            winners = aliveVillagers.map(p => p.userId);
        } else if (aliveWerewolves.length >= aliveVillagers.length) {
            gameOver = true;
            message = "¡Los hombres lobo han ganado! Han superado en número a los aldeanos.";
            winners = aliveWerewolves.map(p => p.userId);
        } else if (alivePlayers.length === 0) {
            gameOver = true;
            message = "¡Nadie ha sobrevivido a la masacre!";
        }
    }

    if (gameOver) {
        newGameData.status = 'finished';
        newGameData.phase = 'finished';
        const newEvent: GameEvent = {
            id: `evt_${Date.now()}_${Math.random()}`,
            gameId: newGameData.id,
            round: newGameData.currentRound,
            type: 'game_over',
            message: message,
            data: { winners },
            createdAt: Timestamp.now(),
        };
        newGameData.events = [...(newGameData.events || []), newEvent];
        return { game: newGameData, isOver: true };
    }

    return { game: newGameData, isOver: false };
}


export async function processNight(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found!");
            
            let game = gameSnap.data() as Game;
            if (game.phase !== 'night') return; // LOCK: Exit if phase has already changed

            const actions = game.nightActions?.filter(a => a.round === game.currentRound) || [];
            
            let finalKilledPlayerIds: string[] = [];
            let messages: string[] = [];

            const savedByDoctorId = actions.find(a => a.actionType === 'doctor_heal')?.targetId || null;
            const savedByHechiceraId = actions.find(a => a.actionType === 'hechicera_save')?.targetId || null;
            const savedByGuardianId = actions.find(a => a.actionType === 'guardian_protect')?.targetId || null;
            const savedByPriestId = actions.find(a => a.actionType === 'priest_bless')?.targetId || null;
            
            const allProtectedIds = new Set([savedByDoctorId, savedByHechiceraId, savedByGuardianId, savedByPriestId].filter(Boolean) as string[]);

            // 1. Process Werewolf Attack
            const werewolfVotes = actions.filter(a => a.actionType === 'werewolf_kill');
            if (werewolfVotes.length > 0) {
                const voteCounts = werewolfVotes.reduce((acc, vote) => {
                    const targets = vote.targetId.split('|');
                    targets.forEach(targetId => { if(targetId) acc[targetId] = (acc[targetId] || 0) + 1; });
                    return acc;
                }, {} as Record<string, number>);

                let maxVotes = 0;
                let mostVotedPlayerIds: string[] = [];
                for (const targetId in voteCounts) {
                    if (voteCounts[targetId] > maxVotes) {
                        maxVotes = voteCounts[targetId];
                        mostVotedPlayerIds = [targetId];
                    } else if (voteCounts[targetId] === maxVotes) {
                        mostVotedPlayerIds.push(targetId);
                    }
                }
                
                const killCount = game.wolfCubRevengeRound === game.currentRound ? 2 : 1;
                for(let i = 0; i < killCount && mostVotedPlayerIds.length > 0; i++) {
                    const randomIndex = Math.floor(Math.random() * mostVotedPlayerIds.length);
                    const targetId = mostVotedPlayerIds.splice(randomIndex, 1)[0];
                    const targetPlayer = game.players.find(p => p.userId === targetId);

                    if (!targetPlayer) continue;

                    if (allProtectedIds.has(targetId)) {
                        messages.push("Se escuchó un grito en la noche, ¡pero alguien fue salvado en el último momento!");
                    } else if (targetPlayer.role === 'cursed' && game.settings.cursed) {
                        const playerIndex = game.players.findIndex(p => p.userId === targetId);
                        if (playerIndex > -1) game.players[playerIndex].role = 'werewolf';
                        messages.push(`En la oscuridad, ${targetPlayer.displayName} no muere, ¡sino que se une a la manada! Ahora es un Hombre Lobo.`);
                        game.events.push({ id: `evt_transform_${targetId}`, gameId, round: game.currentRound, type: 'player_transformed', message: `${targetPlayer.displayName} ha sido transformado en Hombre Lobo.`, data: { playerId: targetId }, createdAt: Timestamp.now() });
                    } else {
                        finalKilledPlayerIds.push(targetId);
                        const roleName = roleDetails[targetPlayer.role!]?.name || 'un rol desconocido';
                        messages.push(`${targetPlayer.displayName} fue asesinado y era ${roleName}.`);
                    }
                }
            }
            
            // 2. Process Hechicera Poison
            const poisonAction = actions.find(a => a.actionType === 'hechicera_poison');
            if (poisonAction && poisonAction.targetId && !finalKilledPlayerIds.includes(poisonAction.targetId)) {
                if (allProtectedIds.has(poisonAction.targetId)) {
                    messages.push("La poción de una hechicera ha salvado a alguien de un veneno.");
                } else {
                    const killedPlayer = game.players.find(p => p.userId === poisonAction.targetId)!;
                    messages.push(`${killedPlayer.displayName} ha muerto misteriosamente, víctima de un veneno.`);
                    finalKilledPlayerIds.push(poisonAction.targetId);
                }
            }

            if (messages.length === 0) {
                messages.push("La noche transcurre en un inquietante silencio.");
            }
            
            game.events.push({
                id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result',
                message: messages.join(' '),
                data: { killedPlayerIds: finalKilledPlayerIds, savedPlayerIds: Array.from(allProtectedIds) },
                createdAt: Timestamp.now(),
            });

            // 3. Apply Kills and check consequences
            if (finalKilledPlayerIds.length > 0) {
                const { updatedGame, triggeredHunterId } = killPlayer(game, finalKilledPlayerIds);
                game = updatedGame;
                
                if (triggeredHunterId) {
                    transaction.update(gameRef, sanitizeGameForUpdate(game));
                    return; // Stop here, phase is now 'hunter_shot'
                }
            }
            
            // 4. Check for game over
            const { game: finalGame, isOver } = await checkGameOver(game);
            game = finalGame;

            if (isOver) {
                transaction.update(gameRef, sanitizeGameForUpdate(game));
                return;
            }

            // 5. Transition to next phase
            game.players.forEach(p => p.votedFor = null);
            game.phase = 'day';
            game.chatMessages = [];
            if (game.wolfCubRevengeRound === game.currentRound) {
                game.wolfCubRevengeRound = 0; // Reset revenge flag
            }
            
            transaction.update(gameRef, sanitizeGameForUpdate(game));
        });
        return { success: true };
    } catch (error) {
        console.error("Error processing night:", error);
        return { error: "Hubo un problema al procesar la noche." };
    }
}


export async function submitVote(db: Firestore, gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
       await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            
            const currentGame = gameSnap.data() as Game;
            
            const playerIndex = currentGame.players.findIndex(p => p.userId === voterId && p.isAlive);
            if (playerIndex === -1) throw new Error("Player not found or is not alive");
            
            currentGame.players[playerIndex].votedFor = targetId;
            transaction.update(gameRef, { players: currentGame.players });
        });

        // Trigger AI *after* transaction
        const gameDoc = await getDoc(gameRef);
        if(gameDoc.exists()){
            const game = gameDoc.data() as Game;
            const targetPlayer = game.players.find(p => p.userId === targetId);
            const voterPlayer = game.players.find(p => p.userId === voterId);

            if (targetPlayer?.isAI) {
                const perspective: AIPlayerPerspective = {
                    game: sanitizeValue(game),
                    aiPlayer: sanitizeValue(targetPlayer),
                    trigger: `${voterPlayer?.displayName || 'Someone'} te ha votado.`,
                    players: sanitizeValue(game.players),
                };

                generateAIChatMessage(perspective).then(async ({ message, shouldSend }) => {
                    if (shouldSend) {
                        await sendChatMessage(db, gameId, targetPlayer!.userId, targetPlayer!.displayName, message);
                    }
                }).catch(aiError => console.error("Error generating AI chat message on vote:", aiError));
            }
        }


        await checkEndDayEarly(db, gameId);
        return { success: true };
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al votar." };
        }
        console.error("Error submitting vote: ", error);
        return { error: "No se pudo registrar tu voto." };
    }
}

export async function processVotes(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data() as Game;

            if (game.phase !== 'day' || game.status !== 'in_progress') return;

            const alivePlayers = game.players.filter(p => p.isAlive);
            const voteCounts: Record<string, number> = {};
            let totalVotes = 0;
            alivePlayers.forEach(player => {
                if (player.votedFor) {
                    voteCounts[player.votedFor] = (voteCounts[player.votedFor] || 0) + 1;
                    totalVotes++;
                }
            });

            let maxVotes = 0;
            let mostVotedPlayerIds: string[] = [];
            for (const playerId in voteCounts) {
                if (voteCounts[playerId] > maxVotes) {
                    maxVotes = voteCounts[playerId];
                    mostVotedPlayerIds = [playerId];
                } else if (voteCounts[playerId] === maxVotes) {
                    mostVotedPlayerIds.push(playerId);
                }
            }
            
            // Check for close vote clue
            if (totalVotes > 2) {
                const sortedVotes = Object.values(voteCounts).sort((a,b) => b - a);
                if (sortedVotes.length > 1 && sortedVotes[0] - sortedVotes[1] <= 1) {
                     game.events.push({
                        id: `evt_${Date.now()}_clue`,
                        gameId,
                        round: game.currentRound,
                        type: 'behavior_clue',
                        message: "La votación de ayer estuvo muy reñida, dividiendo al pueblo casi por la mitad. ¿Alianza o confusión?",
                        data: { voteCounts },
                        createdAt: Timestamp.now(),
                    });
                }
            }
            
            let lynchedPlayerId: string | null = null;
            if (mostVotedPlayerIds.length === 1 && maxVotes > 0) {
                const potentialLynchedId = mostVotedPlayerIds[0];
                const lynchedPlayer = game.players.find(p => p.userId === potentialLynchedId);
                
                if (lynchedPlayer) {
                    if (lynchedPlayer.role === 'prince' && game.settings.prince && !lynchedPlayer.princeRevealed) {
                        const playerIndex = game.players.findIndex(p => p.userId === potentialLynchedId);
                        game.players[playerIndex].princeRevealed = true;
                        
                        game.events.push({
                            id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result',
                            message: `${lynchedPlayer.displayName} ha sido sentenciado, pero revela su identidad como ¡el Príncipe! y sobrevive a la votación.`,
                            data: { lynchedPlayerId: null }, createdAt: Timestamp.now(),
                        });
                    } else {
                        lynchedPlayerId = potentialLynchedId;
                        game.events.push({
                            id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result',
                            message: `${lynchedPlayer.displayName} fue apedreado por nuestros votos.`,
                            data: { lynchedPlayerId }, createdAt: Timestamp.now(),
                        });
                    }
                }
            } else {
                 if (mostVotedPlayerIds.length > 1) {
                    game.events.push({
                        id: `evt_${Date.now()}_clue`, gameId, round: game.currentRound, type: 'behavior_clue',
                        message: "Hubo un empate en la votación. ¿Estrategia coordinada o indecisión general?",
                        data: { voteCounts }, createdAt: Timestamp.now(),
                    });
                }
                const eventMessage = mostVotedPlayerIds.length > 1 ? "La votación resultó en un empate. Nadie fue linchado hoy." : "El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.";
                game.events.push({ id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message: eventMessage, data: { lynchedPlayerId: null }, createdAt: Timestamp.now() });
            }
            
            if (lynchedPlayerId) {
                const { updatedGame, triggeredHunterId } = killPlayer(game, [lynchedPlayerId]);
                game = updatedGame;
                
                if (triggeredHunterId) {
                   transaction.update(gameRef, sanitizeGameForUpdate(game));
                   return; // Stop execution here
                } 
            }
            
            const { game: gameOverCheckGame, isOver } = await checkGameOver(game);
            game = gameOverCheckGame;

            if (isOver) {
                 transaction.update(gameRef, sanitizeGameForUpdate(game));
                 return;
            }

            // If game is not over, transition to night
            game.players.forEach(p => { p.votedFor = null; });
            game.phase = 'night';
            game.currentRound += 1;

            transaction.update(gameRef, sanitizeGameForUpdate(game));
        });

        return { success: true };
    } catch (error) {
        console.error("Error processing votes:", error);
        if (error instanceof Error && (error.message.includes("invalid data") || error.message.includes("undefined"))) {
            try {
                const gameDoc = await getDoc(gameRef);
                if (gameDoc.exists()) {
                    console.error("Game state at time of error:", JSON.stringify(gameDoc.data(), null, 2));
                }
            } catch (e) {
                console.error("Could not fetch game state for debugging.", e)
            }
        }
        return { error: "Hubo un problema al procesar la votación." };
    }
}


export async function getSeerResult(db: Firestore, gameId: string, seerId: string, targetId: string) {
  try {
    const gameDoc = await getDoc(doc(db, 'games', gameId));
    if (!gameDoc.exists()) throw new Error("Game not found");
    const game = gameDoc.data() as Game;

    const seerPlayer = game.players.find(p => p.userId === seerId);
    if (!seerPlayer || seerPlayer.role !== 'seer') throw new Error("No eres el vidente.");
    
    const targetPlayer = game.players.find(p => p.userId === targetId);
    if (!targetPlayer) throw new Error("Target player not found");

    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed'];
    const isWerewolf = wolfRoles.includes(targetPlayer.role) || (targetPlayer.role === 'lycanthrope' && game.settings.lycanthrope);

    return { success: true, isWerewolf, targetName: targetPlayer.displayName };
  } catch (error: any) {
    console.error("Error getting seer result: ", error);
    return { success: false, error: error.message };
  }
}


export async function submitHunterShot(db: Firestore, gameId: string, hunterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data() as Game;

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId) {
                throw new Error("No es tu momento de disparar.");
            }
            
            const hunterPlayer = game.players.find(p => p.userId === hunterId)!;
            const targetPlayer = game.players.find(p => p.userId === targetId)!;

            game.events.push({
                id: `evt_huntershot_${game.currentRound}`, gameId, round: game.currentRound, type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
                createdAt: Timestamp.now(),
                data: {killedPlayerId: targetId},
            });
            
            const { updatedGame, triggeredHunterId } = killPlayer(game, [targetId]);
            game = updatedGame;
            
            if (triggeredHunterId) { // Another hunter was killed by the shot
                // The game phase is already 'hunter_shot', we just update the pending ID
                game.pendingHunterShot = triggeredHunterId;
                transaction.update(gameRef, sanitizeGameForUpdate(game));
                return;
            }

            const { game: finalGame, isOver } = await checkGameOver(game);
            game = finalGame;

            if (isOver) {
                transaction.update(gameRef, sanitizeGameForUpdate(game));
                return;
            }
            
            // If the game isn't over, figure out where to go next.
            // Check if the hunter shot happened after a vote or during the night.
            const voteEvent = game.events.find(e => e.round === game.currentRound && e.type === 'vote_result');
            
            game.phase = voteEvent ? 'night' : 'day';
            game.currentRound = voteEvent ? game.currentRound + 1 : game.currentRound;
            game.pendingHunterShot = null;

            transaction.update(gameRef, sanitizeGameForUpdate(game));
        });
        return { success: true };
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al disparar." };
        }
        console.error("Error submitting hunter shot: ", error);
        return { error: error.message || "No se pudo registrar el disparo." };
    }
}

async function checkEndNightEarly(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) return;

    const game = gameDoc.data() as Game;
    if (game.phase !== 'night') return; // Exit if phase already changed

    const alivePlayers = game.players.filter(p => p.isAlive);
    const submittedActions = game.nightActions?.filter(a => a.round === game.currentRound) || [];

    const requiredPlayerIds = new Set<string>();

    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub'];
    const werewolves = alivePlayers.filter(p => wolfRoles.includes(p.role));
    if (werewolves.length > 0) {
        werewolves.forEach(w => requiredPlayerIds.add(w.userId));
    }

    if (game.settings.seer) {
        const seer = alivePlayers.find(p => p.role === 'seer');
        if (seer) requiredPlayerIds.add(seer.userId);
    }
    
    if (game.settings.doctor) {
        const doctor = alivePlayers.find(p => p.role === 'doctor');
        if (doctor) requiredPlayerIds.add(doctor.userId);
    }
    
    if (game.settings.guardian) {
        const guardian = alivePlayers.find(p => p.role === 'guardian');
        if (guardian) requiredPlayerIds.add(guardian.userId);
    }

    if (game.settings.priest) {
        const priest = alivePlayers.find(p => p.role === 'priest');
        if (priest) requiredPlayerIds.add(priest.userId);
    }

    if (game.currentRound === 1 && game.settings.cupid) {
        const cupid = alivePlayers.find(p => p.role === 'cupid');
        if (cupid) requiredPlayerIds.add(cupid.userId);
    }
    
    if (game.settings.hechicera) {
        const hechicera = alivePlayers.find(p => p.role === 'hechicera');
        if (hechicera && (!hechicera.potions?.poison || !hechicera.potions?.save)) {
             requiredPlayerIds.add(hechicera.userId);
        }
    }
    
    const submittedPlayerIds = new Set(submittedActions.map(a => a.playerId));

    // If at least one werewolf has submitted an action, we consider the werewolf team's action as complete.
    const wolfActionSubmitted = werewolves.some(w => submittedPlayerIds.has(w.userId));
    if (werewolves.length > 0 && wolfActionSubmitted) {
        werewolves.forEach(w => requiredPlayerIds.delete(w.userId));
    }


    const allRequiredSubmitted = Array.from(requiredPlayerIds).every(id => submittedPlayerIds.has(id));

    if (allRequiredSubmitted && game.phase === 'night') {
        console.log("All required night actions submitted. Processing night...");
        await processNight(db, gameId);
    }
}

async function checkEndDayEarly(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) return;

    const game = gameDoc.data() as Game;
    if (game.phase !== 'day') return;

    const alivePlayers = game.players.filter(p => p.isAlive && !p.isAI);
    const allPlayersVoted = alivePlayers.every(p => !!p.votedFor);
    
    if (allPlayersVoted && alivePlayers.length > 0) {
        await processVotes(db, gameId);
    }
}

const getDeterministicAIAction = (
    aiPlayer: Player,
    game: Game,
    alivePlayers: Player[]
): { actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE', targetId: string } => {
    const { role, userId, lastHealedRound } = aiPlayer;
    const { currentRound } = game;
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];

    const potentialTargets = alivePlayers.filter(p => p.userId !== userId);

    const randomTarget = (targets: Player[]) => {
        if (targets.length === 0) return '';
        return targets[Math.floor(Math.random() * targets.length)].userId;
    };

    switch (role) {
        case 'werewolf':
        case 'wolf_cub': {
            const nonWolves = potentialTargets.filter(p => !wolfRoles.includes(p.role));
            return { actionType: 'werewolf_kill', targetId: randomTarget(nonWolves) };
        }
        case 'seer':
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'seer_check', targetId: randomTarget(potentialTargets) };
        case 'doctor': {
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            return { actionType: 'doctor_heal', targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
        }
        case 'guardian': {
             if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'guardian_protect', targetId: randomTarget(potentialTargets) };
        }
        case 'priest': {
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            const priestCanSelfHeal = !aiPlayer.priestSelfHealUsed;
            let blessableTargets = potentialTargets;
            if (priestCanSelfHeal) {
                blessableTargets = alivePlayers;
            }
            return { actionType: 'priest_bless', targetId: randomTarget(blessableTargets) };
        }
        default:
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
             if (game.phase === 'hunter_shot' && game.pendingHunterShot === userId) {
                return { actionType: 'SHOOT', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
    }
};

export async function runAIActions(db: Firestore, gameId: string, phase: Game['phase']) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        const aiPlayers = game.players.filter(p => p.isAI && p.isAlive);
        const alivePlayers = game.players.filter(p => p.isAlive);
        const nightActions = game.nightActions?.filter(a => a.round === game.currentRound) || [];

        for (const ai of aiPlayers) {
             const hasActed = phase === 'night' 
                ? nightActions.some(a => a.playerId === ai.userId)
                : ai.votedFor;
            
            if (hasActed) continue;
            
            if (phase === 'hunter_shot' && ai.userId !== game.pendingHunterShot) continue;
            
            const { actionType, targetId } = getDeterministicAIAction(ai, game, alivePlayers);

            if (!actionType || actionType === 'NONE' || !targetId) continue;

            // Introduce a random delay for each AI action to make them feel more natural
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));

            switch(actionType) {
                case 'werewolf_kill':
                case 'seer_check':
                case 'doctor_heal':
                case 'guardian_protect':
                case 'priest_bless':
                    await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType, targetId });
                    break;
                case 'VOTE':
                    if (phase === 'day') {
                        await submitVote(db, gameId, ai.userId, targetId);
                    }
                    break;
                case 'SHOOT':
                    if (phase === 'hunter_shot' && ai.userId === game.pendingHunterShot) {
                        await submitHunterShot(db, gameId, ai.userId, targetId);
                    }
                    break;
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

export async function sendChatMessage(db: Firestore, gameId: string, senderId: string, senderName: string, text: string) {
    const gameRef = doc(db, 'games', gameId);
    
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    try {
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) {
                throw new Error("Game not found");
            }
            const currentGame = gameDoc.data() as Game;
            
            const player = currentGame.players.find(p => p.userId === senderId);
            if (!player || !player.isAlive) {
                throw new Error('No puedes enviar mensajes.');
            }
            
            const mentionedPlayerIds: string[] = [];
            for (const p of currentGame.players) {
                if (p.userId !== senderId && text.toLowerCase().includes(p.displayName.toLowerCase())) {
                    mentionedPlayerIds.push(p.userId);
                }
            }

            const newMessage: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId,
                senderName,
                text: text.trim(),
                round: currentGame.currentRound,
                createdAt: Timestamp.now(),
            };

            if (mentionedPlayerIds.length > 0) {
                newMessage.mentionedPlayerIds = mentionedPlayerIds;
            }
            
            transaction.update(gameRef, { 
                chatMessages: arrayUnion(newMessage)
            });
        });

        // Trigger AI response *after* the transaction is successful
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists()) {
            const game = gameDoc.data() as Game;
            const mentionedPlayer = game.players.find(p => text.toLowerCase().includes(p.displayName.toLowerCase()) && p.isAI && p.isAlive);

            if (mentionedPlayer) {
                 const perspective: AIPlayerPerspective = {
                    game: sanitizeValue(game),
                    aiPlayer: sanitizeValue(mentionedPlayer),
                    trigger: `${senderName} te ha mencionado en el chat: "${text.trim()}"`,
                    players: sanitizeValue(game.players),
                };
                
                generateAIChatMessage(perspective).then(async ({ message, shouldSend }) => {
                    if (shouldSend) {
                        await sendChatMessage(db, gameId, mentionedPlayer!.userId, mentionedPlayer!.displayName, message);
                    }
                }).catch(aiError => console.error("Error generating AI chat message on mention:", aiError));
            }
        }


        return { success: true };
    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: { chatMessages: '...' }
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: 'Permiso denegado para enviar mensaje.' };
        }
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function resetGame(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) {
                throw new Error("Partida no encontrada.");
            }
            const game = gameSnap.data() as Game;

            // Filter for human players to keep them in the lobby
            const humanPlayers = game.players.filter(p => !p.isAI);

            const resetHumanPlayers = humanPlayers.map(player => ({
                ...player,
                role: null,
                isAlive: true,
                votedFor: null,
                lastHealedRound: 0,
                potions: { poison: null, save: null },
                priestSelfHealUsed: false,
                princeRevealed: false,
            }));

            transaction.update(gameRef, {
                status: 'waiting',
                phase: 'waiting',
                currentRound: 0,
                events: [],
                chatMessages: [],
                nightActions: [],
                lovers: null,
                twins: null,
                pendingHunterShot: null,
                wolfCubRevengeRound: 0,
                players: resetHumanPlayers, 
            });
        });
        return { success: true };
    } catch (e: any) {
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado para reiniciar la partida." };
        }
        console.error("Error resetting game:", e);
        return { error: e.message || 'No se pudo reiniciar la partida.' };
    }
}

    

    

    
