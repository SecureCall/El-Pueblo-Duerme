
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
} from "firebase/firestore";
import type { Game, Player, NightAction, GameEvent, PlayerRole, NightActionType } from "@/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

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
      phase: "night", 
      creator: userId,
      players: [], 
      events: [],
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
    
    const joinResult = await joinGame(db, gameId, userId, displayName);
    if (joinResult.error) {
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
  const newPlayer = createPlayerObject(userId, gameId, displayName, false);
  
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
      
      if (game.players.length >= game.maxPlayers && !playerExists) {
        throw new Error("Esta partida está llena.");
      }
      
      if (!playerExists) {
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
            requestResourceData: { players: arrayUnion(newPlayer) },
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
        
        const game = gameSnap.data() as Game;
        const player = game.players.find(p => p.userId === action.playerId);
        if (!player) throw new Error("Player not found");
        
        const nightActions = game.nightActions ? [...game.nightActions] : [];
        const existingActionIndex = nightActions.findIndex(a => a.round === action.round && a.playerId === action.playerId);

        // Validations
        if (action.actionType === 'doctor_heal') {
            const targetPlayer = game.players.find(p => p.userId === action.targetId);
            if (!targetPlayer) throw new Error("Target player not found");
            if (targetPlayer.lastHealedRound === action.round - 1) {
                throw new Error("No puedes proteger a la misma persona dos noches seguidas.");
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
        nightActions.push(newAction);

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

async function killPlayer(
    transaction: Transaction,
    gameRef: DocumentReference,
    gameData: Game
): Promise<{ game: Game; hunterId: string | null }> {
    let newGameData = { ...gameData };
    let hunterTriggeredId: string | null = null;

    const playersToKill = newGameData.players.filter(p => p.votedFor === 'TO_BE_KILLED' && p.isAlive);

    for (const playerToKill of playersToKill) {
        const playerIndex = newGameData.players.findIndex(p => p.userId === playerToKill.userId);
        if (playerIndex === -1) continue;

        newGameData.players[playerIndex].isAlive = false;

        // Check for special roles on death
        if (playerToKill.role === 'hunter' && newGameData.settings.hunter) {
            hunterTriggeredId = playerToKill.userId;
        } else if (playerToKill.role === 'wolf_cub' && newGameData.settings.wolf_cub) {
            newGameData.wolfCubRevengeRound = newGameData.currentRound + 1;
        }

        // Check for lover's death
        if (newGameData.lovers && newGameData.lovers.includes(playerToKill.userId)) {
            const otherLoverId = newGameData.lovers.find(id => id !== playerToKill.userId)!;
            const otherLoverIndex = newGameData.players.findIndex(p => p.userId === otherLoverId && p.isAlive);

            if (otherLoverIndex > -1) {
                const otherLover = newGameData.players[otherLoverIndex];
                newGameData.players[otherLoverIndex].isAlive = false;

                const newEvent: GameEvent = {
                    id: `evt_${Date.now()}_${Math.random()}`,
                    gameId: newGameData.id,
                    round: newGameData.currentRound,
                    type: 'lover_death',
                    message: `${otherLover.displayName} no pudo soportar la pérdida de ${playerToKill.displayName} y ha muerto de desamor.`,
                    createdAt: Timestamp.now(),
                    data: { killedPlayerId: otherLoverId }
                };
                newGameData.events.push(newEvent);

                if (otherLover.role === 'hunter' && newGameData.settings.hunter && !hunterTriggeredId) {
                    hunterTriggeredId = otherLover.userId;
                }
            }
        }
    }
    
    if (hunterTriggeredId) {
        newGameData.pendingHunterShot = hunterTriggeredId;
        newGameData.phase = 'hunter_shot';
        // Clear the 'TO_BE_KILLED' status from the hunter so they aren't processed again
        const hunterIndex = newGameData.players.findIndex(p => p.userId === hunterTriggeredId);
        if(hunterIndex > -1) {
            newGameData.players[hunterIndex].votedFor = null;
        }
    }

    return { game: newGameData, hunterId: hunterTriggeredId };
}


function sanitizeGameForUpdate(gameData: Game): Partial<Game> {
    const sanitizedGame: Partial<Game> = { ...gameData };

    // Sanitize top-level fields
    for (const key in sanitizedGame) {
        if (sanitizedGame[key as keyof Game] === undefined) {
            sanitizedGame[key as keyof Game] = null as any;
        }
    }

    // Sanitize players array
    if (sanitizedGame.players) {
        sanitizedGame.players = sanitizedGame.players.map(p => {
            const sanitizedPlayer: Player = { ...p };
            for (const playerKey in sanitizedPlayer) {
                if (sanitizedPlayer[playerKey as keyof Player] === undefined) {
                    sanitizedPlayer[playerKey as keyof Player] = null as any;
                }
            }
            if (sanitizedPlayer.potions === undefined) {
                sanitizedPlayer.potions = { poison: null, save: null };
            }
            return sanitizedPlayer;
        });
    }

    // Ensure potentially undefined top-level objects are at least null
    sanitizedGame.lovers = sanitizedGame.lovers ?? null;
    sanitizedGame.twins = sanitizedGame.twins ?? null;
    sanitizedGame.pendingHunterShot = sanitizedGame.pendingHunterShot ?? null;
    sanitizedGame.nightActions = sanitizedGame.nightActions ?? [];
    sanitizedGame.events = sanitizedGame.events ?? [];
    sanitizedGame.phaseEndsAt = sanitizedGame.phaseEndsAt ?? undefined; // Firestore handles Timestamp or undefined, but not `null` if it's a Timestamp field. Let's remove it if undefined.
    if(sanitizedGame.phaseEndsAt === undefined) delete sanitizedGame.phaseEndsAt;


    return sanitizedGame;
}


async function checkGameOver(gameData: Game): Promise<{ game: Game, isOver: boolean }> {
    let newGameData = { ...gameData };

    const alivePlayers = newGameData.players.filter(p => p.isAlive);
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed'];
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

            if (game.phase !== 'night' || game.status !== 'in_progress') return;

            const actions = game.nightActions?.filter(a => a.round === game.currentRound) || [];
            
            let killedByWerewolfIds: string[] = [];
            let killedByPoisonId: string | null = null;
            let savedByDoctorId: string | null = null;
            let savedByHechiceraId: string | null = null;
            let savedByGuardianId: string | null = null;
            let savedByPriestId: string | null = null;

            savedByDoctorId = actions.find(a => a.actionType === 'doctor_heal')?.targetId || null;
            savedByHechiceraId = actions.find(a => a.actionType === 'hechicera_save')?.targetId || null;
            savedByGuardianId = actions.find(a => a.actionType === 'guardian_protect')?.targetId || null;
            savedByPriestId = actions.find(a => a.actionType === 'priest_bless')?.targetId || null;

            const werewolfVotes = actions.filter(a => a.actionType === 'werewolf_kill');
            if (werewolfVotes.length > 0) {
                const voteCounts = werewolfVotes.reduce((acc, vote) => {
                    const targets = vote.targetId.split('|');
                    targets.forEach(targetId => {
                        if(targetId) acc[targetId] = (acc[targetId] || 0) + 1;
                    });
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
                while (killedByWerewolfIds.length < killCount && mostVotedPlayerIds.length > 0) {
                    const randomIndex = Math.floor(Math.random() * mostVotedPlayerIds.length);
                    const killedId = mostVotedPlayerIds.splice(randomIndex, 1)[0];
                    killedByWerewolfIds.push(killedId);
                }
            }
            
            killedByPoisonId = actions.find(a => a.actionType === 'hechicera_poison')?.targetId || null;

            let messages: string[] = [];
            const finalSavedPlayerIds = [savedByDoctorId, savedByHechiceraId, savedByGuardianId].filter(id => id && id !== savedByPriestId).filter(Boolean) as string[];
            
            const markPlayerForDeath = (playerId: string) => {
                const playerIndex = game.players.findIndex(p => p.userId === playerId);
                if (playerIndex > -1) {
                    game.players[playerIndex].votedFor = 'TO_BE_KILLED';
                }
            };
            
            for (const killedId of killedByWerewolfIds) {
                 const targetPlayer = game.players.find(p => p.userId === killedId);

                 if (targetPlayer?.role === 'cursed' && game.settings.cursed) {
                    const playerIndex = game.players.findIndex(p => p.userId === targetPlayer.userId);
                    if (playerIndex > -1) game.players[playerIndex].role = 'werewolf';
                    
                    messages.push(`En la oscuridad, ${targetPlayer.displayName} no muere, ¡sino que se une a la manada! Ahora es un Hombre Lobo.`);
                    game.events.push({
                        id: `evt_${Date.now()}_${Math.random()}`,
                        gameId,
                        round: game.currentRound,
                        type: 'player_transformed',
                        message: `${targetPlayer.displayName} fue atacado, pero en lugar de morir, ha sido transformado en un Hombre Lobo.`,
                        data: { playerId: targetPlayer.userId },
                        createdAt: Timestamp.now(),
                    });
                } else if (killedId === savedByPriestId) {
                     messages.push("Una bendición ha protegido a un aldeano de un destino fatal.");
                } else if (finalSavedPlayerIds.includes(killedId)) {
                    messages.push("Se escuchó un grito en la noche, ¡pero alguien fue salvado en el último momento!");
                } else {
                    const killedPlayer = game.players.find(p => p.userId === killedId)!;
                    messages.push(`${killedPlayer.displayName} fue atacado en la noche.`);
                    markPlayerForDeath(killedId);
                }
            }

            if (killedByPoisonId && !killedByWerewolfIds.includes(killedByPoisonId)) {
                if (killedByPoisonId === savedByPriestId) {
                    messages.push("Una bendición ha protegido a un aldeano de un veneno mortal.");
                } else if (finalSavedPlayerIds.includes(killedByPoisonId)) {
                    messages.push("La poción de una hechicera ha salvado a alguien de un veneno.");
                } else {
                    const killedPlayer = game.players.find(p => p.userId === killedByPoisonId)!;
                    messages.push(`${killedPlayer.displayName} ha muerto misteriosamente, víctima de un veneno.`);
                    markPlayerForDeath(killedByPoisonId);
                }
            }
            
            if (messages.length === 0) {
                messages.push("La noche transcurre en un inquietante silencio.");
            }
            
            const allProtectedIds = [savedByPriestId, ...finalSavedPlayerIds];
            const killedWerewolfTargets = killedByWerewolfIds.filter(id => !allProtectedIds.includes(id));
            const killedPoisonTarget = (killedByPoisonId && !killedByWerewolfIds.includes(killedByPoisonId) && !allProtectedIds.includes(killedByPoisonId)) ? killedByPoisonId : null;

            game.events.push({
                id: `evt_${Date.now()}_${Math.random()}`,
                gameId,
                round: game.currentRound,
                type: 'night_result',
                message: messages.join(' '),
                data: { killedByWerewolfIds: killedWerewolfTargets, killedByPoisonId: killedPoisonTarget, savedPlayerIds: allProtectedIds },
                createdAt: Timestamp.now(),
            });

            const { game: gameAfterKills, hunterId } = await killPlayer(transaction, gameRef, game);
            game = gameAfterKills;
            
            if (hunterId) {
                transaction.update(gameRef, sanitizeGameForUpdate(game));
                return;
            }

            const { game: finalGame, isOver } = await checkGameOver(game);
            game = finalGame;
            if (isOver) {
                transaction.update(gameRef, sanitizeGameForUpdate(game));
                return;
            }
            
            game.players.forEach(p => p.votedFor = null);
            game.phase = 'day';
            if (game.wolfCubRevengeRound === game.currentRound) {
                game.wolfCubRevengeRound = 0;
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
            const game = gameSnap.data() as Game;

            const playerIndex = game.players.findIndex(p => p.userId === voterId && p.isAlive);
            if (playerIndex === -1) throw new Error("Player not found or is not alive");
            
            game.players[playerIndex].votedFor = targetId;

            transaction.update(gameRef, { players: game.players });
        });
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
            alivePlayers.forEach(player => {
                if (player.votedFor) {
                    voteCounts[player.votedFor] = (voteCounts[player.votedFor] || 0) + 1;
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

            let lynchedPlayerId: string | null = null;
            let eventMessage: string;

            if (mostVotedPlayerIds.length === 1 && maxVotes > 0) {
                const potentialLynchedId = mostVotedPlayerIds[0];
                const lynchedPlayerIndex = game.players.findIndex(p => p.userId === potentialLynchedId);
                
                if (lynchedPlayerIndex > -1) {
                    const lynchedPlayer = game.players[lynchedPlayerIndex];
                    if (lynchedPlayer.role === 'prince' && game.settings.prince && !lynchedPlayer.princeRevealed) {
                        eventMessage = `${lynchedPlayer.displayName} ha sido sentenciado, pero revela su identidad como ¡el Príncipe! y sobrevive a la votación.`;
                        game.players[lynchedPlayerIndex].princeRevealed = true;
                    } else {
                        lynchedPlayerId = potentialLynchedId;
                        eventMessage = `El pueblo ha decidido. ${lynchedPlayer.displayName} ha sido linchado.`;
                        game.players[lynchedPlayerIndex].votedFor = 'TO_BE_KILLED';
                    }
                } else {
                    eventMessage = "El jugador a linchar no fue encontrado.";
                }
            } else if (mostVotedPlayerIds.length > 1) {
                eventMessage = "La votación resultó en un empate. Nadie fue linchado hoy.";
            } else {
                eventMessage = "El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.";
            }

            game.events.push({
                id: `evt_${Date.now()}_${Math.random()}`,
                gameId,
                round: game.currentRound,
                type: 'vote_result',
                message: eventMessage,
                data: { lynchedPlayerId },
                createdAt: Timestamp.now(),
            });
            
            const { game: gameAfterKill, hunterId } = await killPlayer(transaction, gameRef, game);
            game = gameAfterKill;

            if (hunterId) {
                transaction.update(gameRef, sanitizeGameForUpdate(game));
                return;
            }

            const { game: finalGame, isOver } = await checkGameOver(game);
            
            let gameToUpdate: Partial<Game>;
            
            if (isOver) {
                gameToUpdate = finalGame;
            } else {
                let nextGame = { ...finalGame };
                nextGame.players.forEach(p => {
                    p.votedFor = null;
                });
                nextGame.phase = 'night';
                nextGame.currentRound = nextGame.currentRound + 1;
                gameToUpdate = nextGame;
            }
            
            transaction.update(gameRef, sanitizeGameForUpdate(gameToUpdate as Game));
        });

        return { success: true };
    } catch (error) {
        console.error("Error processing votes:", error);
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

    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy'];
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
                id: `evt_${Date.now()}_${Math.random()}`,
                gameId,
                round: game.currentRound,
                type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
                createdAt: Timestamp.now(),
                data: {},
            });
            
            const targetIndex = game.players.findIndex(p => p.userId === targetId);
            if (targetIndex > -1) {
                game.players[targetIndex].votedFor = 'TO_BE_KILLED';
            }
            
            const { game: gameAfterKill, hunterId: newHunterId } = await killPlayer(transaction, gameRef, game);
            game = gameAfterKill;
            
            if (newHunterId) { // Another hunter was killed by the shot
                transaction.update(gameRef, sanitizeGameForUpdate(game));
                return;
            }

            const { game: finalGame, isOver } = await checkGameOver(game);
            game = finalGame;

            if (isOver) {
                transaction.update(gameRef, sanitizeGameForUpdate(game));
                return;
            }
            
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
    if (game.phase !== 'night') return;

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

    const wolfActionSubmitted = werewolves.some(w => submittedPlayerIds.has(w.userId));
    if (werewolves.length > 0 && wolfActionSubmitted) {
        werewolves.forEach(w => requiredPlayerIds.delete(w.userId));
    }


    const allRequiredSubmitted = Array.from(requiredPlayerIds).every(id => submittedPlayerIds.has(id));

    if (allRequiredSubmitted) {
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
    
    if (allPlayersVoted) {
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
            return { actionType: 'seer_check', targetId: randomTarget(potentialTargets) };
        case 'doctor': {
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            return { actionType: 'doctor_heal', targetId: randomTarget(healableTargets) };
        }
        case 'guardian': {
            return { actionType: 'guardian_protect', targetId: randomTarget(potentialTargets) };
        }
        // Simplified AI for other roles - they do nothing at night for now
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

            switch(actionType) {
                case 'werewolf_kill':
                case 'seer_check':
                case 'doctor_heal':
                case 'guardian_protect':
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
