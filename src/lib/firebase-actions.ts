
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
    guardianSelfProtects: 0,
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
      
      if (!playerExists) {
        // Stricter name check
        const nameExists = game.players.some(p => p.displayName.trim().toLowerCase() === displayName.trim().toLowerCase());
        if (nameExists) {
          throw new Error("Ese nombre ya está en uso en esta partida.");
        }
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
            
            const assignedPlayers = finalPlayers.map((player, index) => {
                return { ...player, role: newRoles[index] };
            });

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
        if (game.phase !== 'night') return;
        const player = game.players.find(p => p.userId === action.playerId);
        if (!player) throw new Error("Player not found");
        
        const nightActions = game.nightActions ? [...game.nightActions] : [];
        const existingActionIndex = nightActions.findIndex(a => a.round === action.round && a.playerId === action.playerId);

        if (action.actionType === 'doctor_heal') {
            const targetPlayer = game.players.find(p => p.userId === action.targetId);
            if (targetPlayer?.lastHealedRound === game.currentRound - 1) {
                console.warn(`Doctor ${action.playerId} tried to heal ${action.targetId} two nights in a row. Action ignored.`);
                return; 
            }
        }
        if (action.actionType === 'hechicera_poison' && player.potions?.poison) throw new Error("Ya has usado tu poción de veneno.");
        if (action.actionType === 'hechicera_save' && player.potions?.save) throw new Error("Ya has usado tu poción de salvación.");
        if (action.actionType === 'priest_bless' && action.targetId === action.playerId && player.priestSelfHealUsed) {
            throw new Error("Ya te has bendecido a ti mismo una vez.");
        }
        if (action.actionType === 'guardian_protect' && action.targetId === action.playerId && (player.guardianSelfProtects || 0) >= 1) {
             throw new Error("Solo puedes protegerte a ti mismo una vez por partida.");
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
        } else if (action.actionType === 'guardian_protect' && action.targetId === action.playerId) {
            players[playerIndex].guardianSelfProtects = (players[playerIndex].guardianSelfProtects || 0) + 1;
        }

        nightActions.push(newAction);

        transaction.update(gameRef, {
            nightActions,
            players,
        });
    });

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

    // Use a queue to handle chain reactions
    const killQueue = [...playerIdsToKill];

    while(killQueue.length > 0) {
        const playerId = killQueue.shift();
        if (!playerId || killedThisTurn.has(playerId)) continue;

        const playerIndex = gameData.players.findIndex(p => p.userId === playerId);
        if (playerIndex === -1 || !gameData.players[playerIndex].isAlive) continue;
        
        const playerToKill = gameData.players[playerIndex];
        
        gameData.players[playerIndex].isAlive = false;
        killedThisTurn.add(playerId);

        // Check for special roles on death
        if (playerToKill.role === 'hunter' && gameData.settings.hunter && gameData.phase !== 'hunter_shot') {
             hunterTriggeredId = playerToKill.userId;
        }
        if (playerToKill.role === 'wolf_cub' && gameData.settings.wolf_cub) {
            gameData.wolfCubRevengeRound = gameData.currentRound; 
        }

        // Check for lover's death
        if (gameData.lovers?.includes(playerToKill.userId)) {
            const otherLoverId = gameData.lovers.find(id => id !== playerToKill.userId)!;
            if (!killedThisTurn.has(otherLoverId)) {
                const otherLover = gameData.players.find(p => p.userId === otherLoverId);
                
                gameData.events.push({
                    id: `evt_lover_${Date.now()}_${otherLoverId}`,
                    gameId: gameData.id!,
                    round: gameData.currentRound,
                    type: 'lover_death',
                    message: `${otherLover?.displayName || 'Alguien'} no pudo soportar la pérdida de ${playerToKill.displayName} y ha muerto de desamor.`,
                    data: { killedPlayerId: otherLoverId, originalVictimId: playerId },
                    createdAt: Timestamp.now(),
                });
                killQueue.push(otherLoverId);
            }
        }
    }
    
    if (hunterTriggeredId) {
        // SAFETY CHECK: Ensure the hunter is a valid player before setting phase.
        const isHunterValid = gameData.players.some(p => p.userId === hunterTriggeredId);
        if (isHunterValid) {
            gameData.pendingHunterShot = hunterTriggeredId;
            gameData.phase = 'hunter_shot';
        } else {
             console.warn(`Hunter ability triggered for a non-existent player (${hunterTriggeredId}). Skipping hunter_shot phase.`);
        }
    }

    return { updatedGame: gameData, triggeredHunterId: hunterTriggeredId };
}


async function checkGameOver(transaction: Transaction, gameRef: DocumentReference, gameData: Game): Promise<boolean> {
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    if (alivePlayers.length === 0) {
        const gameOverEvent: GameEvent = {
            id: `evt_gameover_${Date.now()}`,
            gameId: gameData.id!,
            round: gameData.currentRound,
            type: 'game_over',
            message: "¡Nadie ha sobrevivido a la masacre!",
            data: { winners: [] },
            createdAt: Timestamp.now(),
        };
        transaction.update(gameRef, { 
            status: 'finished',
            phase: 'finished',
            events: arrayUnion(gameOverEvent) 
        });
        return true;
    }

    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed'];
    const aliveWerewolves = alivePlayers.filter(p => wolfRoles.includes(p.role));
    const aliveVillagers = alivePlayers.filter(p => !wolfRoles.includes(p.role));

    let gameOver = false;
    let message = "";
    let winners: string[] = [];
    
    if (gameData.lovers && alivePlayers.length >= 2 && alivePlayers.every(p => gameData.lovers!.includes(p.userId))) {
        gameOver = true;
        const lover1 = gameData.players.find(p => p.userId === gameData.lovers![0]);
        const lover2 = gameData.players.find(p => p.userId === gameData.lovers![1]);
        message = `¡Los enamorados han ganado! Desafiando a sus bandos, ${lover1?.displayName} y ${lover2?.displayName} han triunfado solos contra el mundo.`;
        winners = gameData.lovers;
    }

    if (!gameOver) {
        if (aliveWerewolves.length === 0 && alivePlayers.length > 0) {
            gameOver = true;
            message = "¡El pueblo ha ganado! Todos los hombres lobo han sido eliminados.";
            winners = aliveVillagers.map(p => p.userId);
        } 
        else if (aliveWerewolves.length > 0 && aliveWerewolves.length >= aliveVillagers.length && alivePlayers.length > 0) {
            gameOver = true;
            message = "¡Los hombres lobo han ganado! Han superado en número a los aldeanos.";
            winners = aliveWerewolves.map(p => p.userId);
        }
    }

    if (gameOver) {
        const gameOverEvent: GameEvent = {
            id: `evt_gameover_${Date.now()}`,
            gameId: gameData.id!,
            round: gameData.currentRound,
            type: 'game_over',
            message: message,
            data: { winners },
            createdAt: Timestamp.now(),
        };
        transaction.update(gameRef, { 
            status: 'finished',
            phase: 'finished',
            events: arrayUnion(gameOverEvent) 
        });
        return true;
    }

    return false;
}


export async function processNight(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found!");
            
            let game = gameSnap.data() as Game;
            if (game.phase !== 'night') {
                // Another process might have already handled this.
                console.log("Skipping night process, phase is no longer 'night'.");
                return;
            }
            
            game.nightActions = game.nightActions || [];
            game.events = game.events || [];
            game.chatMessages = game.chatMessages || [];

            const actions = game.nightActions.filter(a => a.round === game.currentRound);
            
            let finalKilledPlayerIds: string[] = [];
            let messages: string[] = [];
            let killedPlayerNamesAndRoles = [];
            let killedByPoisonId: string | null = null;
            let savedPlayerIds: string[] = [];

            const savedByDoctorId = actions.find(a => a.actionType === 'doctor_heal')?.targetId || null;
            const savedByHechiceraId = actions.find(a => a.actionType === 'hechicera_save')?.targetId || null;
            const savedByGuardianId = actions.find(a => a.actionType === 'guardian_protect')?.targetId || null;
            const savedByPriestId = actions.find(a => a.actionType === 'priest_bless')?.targetId || null;
            
            const allProtectedIds = new Set([savedByDoctorId, savedByHechiceraId, savedByGuardianId, savedByPriestId].filter(Boolean) as string[]);
            savedPlayerIds = Array.from(allProtectedIds);

            // 1. Process Werewolf Attack
            const werewolfVotes = actions.filter(a => a.actionType === 'werewolf_kill');
            let wasSomeoneAttackedByWolves = false;
            if (werewolfVotes.length > 0) {
                wasSomeoneAttackedByWolves = true;
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
                       // Saved
                    } else if (targetPlayer.role === 'cursed' && game.settings.cursed) {
                        const playerIndex = game.players.findIndex(p => p.userId === targetId);
                        if (playerIndex > -1) {
                            game.players[playerIndex].role = 'werewolf';
                            game.events.push({ id: `evt_transform_${Date.now()}`, gameId, round: game.currentRound, type: 'player_transformed', message: `${targetPlayer.displayName} ha sido transformado en Hombre Lobo.`, data: { playerId: targetId }, createdAt: Timestamp.now() });
                        }
                    } else if (targetPlayer.role !== 'prince') {
                        finalKilledPlayerIds.push(targetId);
                    }
                }
            }
            
            // 2. Process Hechicera Poison
            const poisonAction = actions.find(a => a.actionType === 'hechicera_poison');
            if (poisonAction && poisonAction.targetId && !finalKilledPlayerIds.includes(poisonAction.targetId)) {
                const targetPlayer = game.players.find(p => p.userId === poisonAction.targetId);
                if (targetPlayer && !allProtectedIds.has(poisonAction.targetId)) {
                    finalKilledPlayerIds.push(poisonAction.targetId);
                    killedByPoisonId = poisonAction.targetId;
                }
            }
            
            const nightEvent: GameEvent = {
                id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result',
                message: "Placeholder",
                data: { 
                    killedPlayerIds: finalKilledPlayerIds, 
                    savedPlayerIds: savedPlayerIds,
                    killedByPoisonId: killedByPoisonId
                },
                createdAt: Timestamp.now(),
            };
            game.events.push(nightEvent); // Add event right away
            
            // 3. Apply Kills and check consequences
            if (finalKilledPlayerIds.length > 0) {
                const { updatedGame } = killPlayer(game, finalKilledPlayerIds);
                game = updatedGame; // game is now updated with deaths and potential hunter
                
                const newlyKilledPlayers = game.players.filter(p => !p.isAlive && finalKilledPlayerIds.includes(p.userId));

                killedPlayerNamesAndRoles = newlyKilledPlayers.map(p => `${p.displayName} (que era ${roleDetails[p.role!]?.name || 'un rol desconocido'})`);
                if (killedPlayerNamesAndRoles.length > 0) {
                    messages.push(`Anoche, el pueblo perdió a ${killedPlayerNamesAndRoles.join(' y a ')}.`);
                }
            } else if (wasSomeoneAttackedByWolves || poisonAction) {
                 messages.push("Se escuchó un grito en la noche, ¡pero alguien fue salvado en el último momento!");
            } else {
                 messages.push("La noche transcurre en un inquietante silencio. Nadie ha muerto.");
            }
            
            nightEvent.message = messages.join(' ') || "La noche transcurre en un inquietante silencio.";
            
            // 4. Check for game over (after kills are applied)
            if (await checkGameOver(transaction, gameRef, game)) {
                return; // Game over logic has already updated transaction and will stop execution.
            }

            // 5. If hunter was triggered, stop and transition to hunter_shot phase
            if (game.phase === 'hunter_shot') {
                transaction.update(gameRef, { 
                    players: game.players,
                    events: game.events,
                    phase: 'hunter_shot',
                    pendingHunterShot: game.pendingHunterShot
                });
                return;
            }

            // 6. Transition to next phase (day)
            game.players.forEach(p => p.votedFor = null);
            
            const updates = {
              players: game.players,
              events: game.events,
              phase: 'day',
              chatMessages: [], // Clear chat at the start of the day
              wolfCubRevengeRound: game.wolfCubRevengeRound === game.currentRound ? 0 : game.wolfCubRevengeRound,
              pendingHunterShot: null,
            };

            transaction.update(gameRef, updates);
        });

        await triggerAIAwake(db, gameId, `Comienza el día ${gameId}.`);
        
        return { success: true };
    } catch (error: any) {
        console.error("Error processing night:", error);
         if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al procesar la noche." };
        }
        return { error: `Hubo un problema al procesar la noche: ${error.message}` };
    }
}


export async function processVotes(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data() as Game;

            // LOCK: Check if the phase is still 'day'. If not, another process has already run.
            if (game.phase !== 'day' || game.status !== 'in_progress') {
                console.log("Skipping vote processing, phase is no longer 'day' or game is not in progress.");
                return;
            }

            // Ensure arrays exist
            game.events = game.events || [];
            game.players = game.players || [];
            
            const alivePlayers = game.players.filter(p => p.isAlive);
            const voteCounts: Record<string, number> = {};
            
            alivePlayers.forEach(player => {
                if (player.votedFor) {
                    voteCounts[player.votedFor] = (voteCounts[player.votedFor] || 0) + 1;
                }
            });
            
            let lynchedPlayerId: string | null = null;
            let voteResultEvent: GameEvent;
            
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
            
            if (mostVotedPlayerIds.length === 1 && maxVotes > 0) {
                const potentialLynchedId = mostVotedPlayerIds[0];
                const lynchedPlayer = game.players.find(p => p.userId === potentialLynchedId);
                
                if (lynchedPlayer) {
                    if (lynchedPlayer.role === 'prince' && game.settings.prince && !lynchedPlayer.princeRevealed) {
                        const playerIndex = game.players.findIndex(p => p.userId === potentialLynchedId);
                        if (playerIndex > -1) {
                           game.players[playerIndex].princeRevealed = true;
                        }
                        
                        voteResultEvent = {
                            id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result',
                            message: `${lynchedPlayer.displayName} ha sido sentenciado, pero revela su identidad como ¡el Príncipe! y sobrevive a la votación.`,
                            createdAt: Timestamp.now(),
                            data: { lynchedPlayerId: null },
                        };
                    } else {
                        lynchedPlayerId = potentialLynchedId;
                        const lynchedPlayerRole = roleDetails[lynchedPlayer.role!]?.name || 'un rol desconocido';
                        voteResultEvent = {
                            id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result',
                            message: `${lynchedPlayer.displayName} fue linchado por el pueblo. Su rol era: ${lynchedPlayerRole}.`,
                            data: { lynchedPlayerId }, createdAt: Timestamp.now(),
                        };
                    }
                } else {
                    voteResultEvent = { id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message: "La votación fue inconclusa.", data: { lynchedPlayerId: null }, createdAt: Timestamp.now() };
                }
            } else {
                const eventMessage = mostVotedPlayerIds.length > 1 ? "La votación resultó en un empate. Nadie fue linchado hoy." : "El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.";
                voteResultEvent = { id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message: eventMessage, data: { lynchedPlayerId: null }, createdAt: Timestamp.now() };
            }

            game.events.push(voteResultEvent);
            
            if (lynchedPlayerId) {
                const { updatedGame } = killPlayer(game, [lynchedPlayerId]);
                game = updatedGame; // game is updated with death info
            }
            
            if (await checkGameOver(transaction, gameRef, game)) {
                 return; // SHORT-CIRCUIT: Game is over, transaction is committed by checkGameOver. Do not continue.
            }
            
            if (game.phase === 'hunter_shot') {
               transaction.update(gameRef, { 
                    players: game.players,
                    events: game.events,
                    phase: 'hunter_shot',
                    pendingHunterShot: game.pendingHunterShot,
                });
               return; // SHORT-CIRCUIT: Wait for hunter to shoot.
            }

            // Prepare for next night
            game.players.forEach(p => { p.votedFor = null; });
            
            transaction.update(gameRef, {
                players: game.players,
                events: game.events,
                phase: 'night',
                currentRound: increment(1),
                pendingHunterShot: null, // Clear any pending shot from previous rounds
            });
        });

        await runAIActions(db, gameId, 'night');

        return { success: true };
    } catch (error: any) {
        console.error("Error processing votes:", error);
         if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al procesar la votación." };
        }
        return { error: `Hubo un problema al procesar la votación: ${error.message}` };
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

            const shotEvent: GameEvent = {
                id: `evt_huntershot_${Date.now()}`,
                gameId,
                round: game.currentRound,
                type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
                createdAt: Timestamp.now(),
                data: {killedPlayerId: targetId},
            };
            
            game.events = game.events || [];
            game.events.push(shotEvent);
            
            const { updatedGame } = killPlayer(game, [targetId]);
            game = updatedGame;
            
            // This is a nested hunter shot, handle it and stop.
            if (game.phase === 'hunter_shot' && game.pendingHunterShot !== hunterId) {
                transaction.update(gameRef, { 
                    players: game.players,
                    events: game.events,
                    phase: 'hunter_shot',
                    pendingHunterShot: game.pendingHunterShot
                });
                return;
            }

            if (await checkGameOver(transaction, gameRef, game)) {
                return; // Stop if game ended
            }
            
            // Determine next phase based on how the original hunter died.
            const hunterDeathEvent = [...game.events]
                .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
                .find(e => 
                    (e.type === 'vote_result' && e.data?.lynchedPlayerId === hunterId) ||
                    (e.type === 'night_result' && e.data?.killedPlayerIds?.includes(hunterId))
                );

            const nextPhase = hunterDeathEvent?.type === 'vote_result' ? 'night' : 'day';
            const nextRound = nextPhase === 'night' ? game.currentRound + 1 : game.currentRound;

            game.players.forEach(p => { p.votedFor = null; });
            
            transaction.update(gameRef, {
                players: game.players,
                events: game.events,
                phase: nextPhase,
                currentRound: nextRound,
                pendingHunterShot: null,
            });
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
        return { success: false, error: error.message || "No se pudo registrar el disparo." };
    }
}

const getDeterministicAIAction = (
    aiPlayer: Player,
    game: Game,
    alivePlayers: Player[]
): { actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE', targetId: string } => {
    const { role, userId } = aiPlayer;
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
        case 'seer': {
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'seer_check', targetId: randomTarget(potentialTargets) };
        }
        case 'doctor': {
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            return { actionType: 'doctor_heal', targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
        }
        case 'hunter': {
            if (game.phase === 'hunter_shot' && game.pendingHunterShot === userId) {
                return { actionType: 'SHOOT', targetId: randomTarget(potentialTargets) };
            }
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        }
        case 'guardian': {
             if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
             const selfProtectCount = aiPlayer.guardianSelfProtects || 0;
             if (selfProtectCount < 1 && Math.random() < 0.2) { // 20% chance to self-protect if available
                return { actionType: 'guardian_protect', targetId: userId };
             }
            return { actionType: 'guardian_protect', targetId: randomTarget(potentialTargets) };
        }
        case 'priest': {
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            const priestCanSelfHeal = !aiPlayer.priestSelfHealUsed;
            if (priestCanSelfHeal && Math.random() < 0.2) { // 20% chance to self-heal
                return { actionType: 'priest_bless', targetId: userId };
            }
            return { actionType: 'priest_bless', targetId: randomTarget(potentialTargets) };
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

        const aiPlayers = game.players.filter(p => {
            if (!p.isAI) return false;
            // For hunter_shot phase, the pending hunter can act, even if not 'alive'.
            if (phase === 'hunter_shot') {
                return p.userId === game.pendingHunterShot;
            }
            return p.isAlive;
        });

        const alivePlayers = game.players.filter(p => p.isAlive);
        const nightActions = game.nightActions?.filter(a => a.round === game.currentRound) || [];

        for (const ai of aiPlayers) {
             const hasActed = phase === 'night' 
                ? nightActions.some(a => a.playerId === ai.userId)
                : ai.votedFor;
            
            if (hasActed && phase !== 'hunter_shot') continue;
            
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

// Deep-copies and converts Timestamps to ISO strings for AI prompt
function sanitizeValue(value: any): any {
    if (!value) return value;
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(v => sanitizeValue(v));
    }
    if (typeof value === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                newObj[key] = sanitizeValue(value[key]);
            }
        }
        return newObj;
    }
    return value;
}

// This function triggers AI players to potentially chat based on a trigger.
async function triggerAIChat(db: Firestore, gameId: string, triggerMessage: string, mentionedPlayerId?: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        const aiPlayersToTrigger = game.players.filter(p => 
            p.isAI && 
            p.isAlive &&
            // If a specific player was mentioned, only trigger them. Otherwise, trigger all.
            (!mentionedPlayerId || p.userId === mentionedPlayerId)
        );

        for (const aiPlayer of aiPlayersToTrigger) {
            const perspective: AIPlayerPerspective = {
                game: sanitizeValue(game),
                aiPlayer: sanitizeValue(aiPlayer),
                trigger: triggerMessage,
                players: sanitizeValue(game.players),
            };

            // Fire-and-forget generation
            generateAIChatMessage(perspective).then(async ({ message, shouldSend }) => {
                if (shouldSend && message) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 2500 + 1000));
                    await sendChatMessage(db, gameId, aiPlayer.userId, aiPlayer.displayName, message, true); // Pass true to prevent recursion
                }
            }).catch(aiError => console.error(`Error generating AI chat for ${aiPlayer.displayName}:`, aiError));
        }
    } catch (e) {
        console.error("Error in triggerAIChat:", e);
    }
}

async function triggerAIAwake(db: Firestore, gameId: string, trigger: string) {
     const gameDoc = await getDoc(doc(db, 'games', gameId));
    if (!gameDoc.exists()) return;
    const game = gameDoc.data() as Game;

    for (const p of game.players) {
        if (p.isAI && p.isAlive) {
            await triggerAIChat(db, gameId, trigger, p.userId);
        }
    }
}


export async function submitVote(db: Firestore, gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId);
    let voterName: string | undefined;
    let targetName: string | undefined;
    
    try {
       await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            
            const currentGame = gameSnap.data() as Game;
            if (currentGame.phase !== 'day') return;
            
            const playerIndex = currentGame.players.findIndex(p => p.userId === voterId && p.isAlive);
            if (playerIndex === -1) throw new Error("Player not found or is not alive");
            
            voterName = currentGame.players[playerIndex].displayName;
            const targetPlayer = currentGame.players.find(p => p.userId === targetId);
            if (!targetPlayer) throw new Error("Target player not found");
            targetName = targetPlayer.displayName;

            currentGame.players[playerIndex].votedFor = targetId;
            transaction.update(gameRef, { players: currentGame.players });
        });

        // Trigger AI chat after vote is committed
        if (voterName && targetName) {
             const allPlayers = (await getDoc(gameRef)).data()?.players || [];
             for (const p of allPlayers) {
                if (p.isAI && p.isAlive) {
                     await triggerAIChat(db, gameId, `${voterName} ha votado por ${targetName}.`, p.userId);
                }
            }
        }


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

export async function sendChatMessage(
    db: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    isFromAI: boolean = false // Add flag to prevent recursion
) {
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(db, 'games', gameId);
    let mentionedPlayerIds: string[] = [];
    let latestGame: Game | null = null;

    try {
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            latestGame = game;
            
            const textLowerCase = text.toLowerCase();
            game.players.forEach(p => {
                if (p.isAlive && textLowerCase.includes(p.displayName.toLowerCase())) {
                    mentionedPlayerIds.push(p.userId);
                }
            });
            
            const messageData: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId,
                senderName,
                text: text.trim(),
                round: game.currentRound,
                createdAt: Timestamp.now(),
                mentionedPlayerIds,
            };

            transaction.update(gameRef, {
                chatMessages: arrayUnion(messageData)
            });
        });

        // Only trigger AI responses if the message is from a human and there's a game state
        if (!isFromAI && latestGame) {
            const triggerMessage = `${senderName} dijo: "${text.trim()}"`;
            for (const p of latestGame.players) {
                if (p.isAI && p.isAlive && p.userId !== senderId && mentionedPlayerIds.includes(p.userId)) {
                    // This function now just fires and forgets the AI trigger
                    triggerAIChat(db, gameId, triggerMessage, p.userId);
                }
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
                guardianSelfProtects: 0, // Reset guardian self protects
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

export async function advanceToNightPhase(db: Firestore, gameId: string) {
  const gameRef = doc(db, "games", gameId);
  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists()) throw new Error("Game not found");
      const game = gameSnap.data() as Game;

      // Only advance if we are in the role reveal phase
      if (game.phase === 'role_reveal') {
        transaction.update(gameRef, { phase: 'night' });
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Error advancing to night phase:", error);
    return { success: false, error: (error as Error).message };
  }
}
    

    




    

    




      















    
