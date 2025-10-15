

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
import type { Game, Player, NightAction, GameEvent, PlayerRole, NightActionType, ChatMessage, AIPlayerPerspective, GameStatus, GamePhase } from "@/types";
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
    biteCount: 0,
    isCultMember: false,
    ghostMessageSent: false,
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
      vampireKills: 0,
      boat: [],
      leprosaBlockedRound: 0,
      witchFoundSeer: false,
      seerDied: false,
      silencedPlayerId: null,
      exiledPlayerId: null,
      troublemakerUsed: false,
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
      const nameExists = game.players.some(p => p.displayName.trim().toLowerCase() === displayName.trim().toLowerCase() && p.userId !== userId);

      if (nameExists) {
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
      } else {
        // Player exists, check if they are changing their name to a valid one
        const currentPlayers = game.players;
        const playerIndex = currentPlayers.findIndex(p => p.userId === userId);
        if (playerIndex !== -1 && currentPlayers[playerIndex].displayName !== displayName) {
          currentPlayers[playerIndex].displayName = displayName.trim();
          transaction.update(gameRef, { players: currentPlayers });
        }
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
            const usedNames = new Set(finalPlayers.map(p => p.displayName.toLowerCase()));

            if (game.settings.fillWithAI && finalPlayers.length < game.maxPlayers) {
                const aiPlayerCount = game.maxPlayers - finalPlayers.length;
                const availableAINames = AI_NAMES.filter(name => !usedNames.has(name.toLowerCase()));

                for (let i = 0; i < aiPlayerCount; i++) {
                    const aiUserId = `ai_${Date.now()}_${i}`;
                    
                    let aiName = availableAINames.shift() || AI_NAMES[i % AI_NAMES.length];
                    let nameSuffix = 2;
                    let finalAiName = aiName;

                    while (usedNames.has(finalAiName.toLowerCase())) {
                        finalAiName = `${aiName} ${nameSuffix}`;
                        nameSuffix++;
                    }

                    usedNames.add(finalAiName.toLowerCase());
                    const aiPlayerData = createPlayerObject(aiUserId, gameId, finalAiName, true);
                    finalPlayers.push(aiPlayerData);
                }
            }
            
            const totalPlayers = finalPlayers.length;
            if (totalPlayers < 3) {
                throw new Error('Se necesitan al menos 3 jugadores para comenzar.');
            }
            
            const newRoles = generateRoles(finalPlayers.length, game.settings);
            
            const assignedPlayers = finalPlayers.map((player, index) => {
                const p = { ...player, role: newRoles[index] };
                // The cult leader starts as a cult member.
                if (p.role === 'cult_leader') {
                    p.isCultMember = true;
                }
                return p;
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
             throw new Error("Solo puedes protegerte a ti mismo una vez.");
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

function handleDrunkManWin(transaction: Transaction, gameRef: DocumentReference, gameData: Game, drunkPlayer: Player) {
    const gameOverEvent: GameEvent = {
        id: `evt_gameover_${Date.now()}`,
        gameId: gameData.id!,
        round: gameData.currentRound,
        type: 'game_over',
        message: `¡El Hombre Ebrio ha ganado! Su único objetivo era ser eliminado y lo ha conseguido.`,
        data: { winners: [drunkPlayer.userId], winnerCode: 'drunk' },
        createdAt: Timestamp.now(),
    };
    const playerIndex = gameData.players.findIndex(p => p.userId === drunkPlayer.userId);
    if(playerIndex > -1) {
        gameData.players[playerIndex].isAlive = false;
    }
    transaction.update(gameRef, {
        status: 'finished',
        phase: 'finished',
        players: gameData.players,
        events: arrayUnion(gameOverEvent)
    });
    return true; // Indicates game is over
}

// This function modifies the game state directly (pass by reference)
function killPlayer(
    gameData: Game,
    playerIdsToKill: string[]
): { updatedGame: Game; triggeredHunterId: string | null; gameOver: boolean; } {
    let hunterTriggeredId: string | null = null;
    const killedThisTurn = new Set<string>();
    let gameOver = false;

    // Use a queue to handle chain reactions (like lover's/twin's death)
    const killQueue = [...new Set(playerIdsToKill)]; // Use Set to avoid duplicates

    while(killQueue.length > 0) {
        const playerId = killQueue.shift();
        if (!playerId || killedThisTurn.has(playerId)) continue;

        const playerIndex = gameData.players.findIndex(p => p.userId === playerId);
        if (playerIndex === -1 || !gameData.players[playerIndex].isAlive) continue;
        
        const playerToKill = { ...gameData.players[playerIndex] };

        // **CRITICAL CHECK FOR DRUNK MAN**
        if (playerToKill.role === 'drunk_man' && gameData.settings.drunk_man) {
            // We can't call a transaction-based function here.
            // We'll signal that the game is over and let the caller handle the transaction.
            gameData.players[playerIndex].isAlive = false; // Mark as dead
            gameOver = true; // Signal game over
            return { updatedGame: gameData, triggeredHunterId: null, gameOver: true };
        }
        
        gameData.players[playerIndex].isAlive = false;
        killedThisTurn.add(playerId);

        // Check for special roles on death
        if (playerToKill.role === 'seer') {
            gameData.seerDied = true;
        }
        if (playerToKill.role === 'hunter' && gameData.settings.hunter && gameData.phase !== 'hunter_shot') {
             hunterTriggeredId = playerToKill.userId;
        }
        if (playerToKill.role === 'wolf_cub' && gameData.settings.wolf_cub) {
            gameData.wolfCubRevengeRound = gameData.currentRound; 
        }
         if (playerToKill.role === 'leprosa' && gameData.settings.leprosa) {
            gameData.leprosaBlockedRound = gameData.currentRound + 1;
        }

        // Check for lover's death
        if (gameData.lovers?.includes(playerToKill.userId)) {
            const otherLoverId = gameData.lovers.find(id => id !== playerToKill.userId);
            if (otherLoverId && !killedThisTurn.has(otherLoverId)) {
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
                killQueue.push(otherLoverId); // Add to queue for processing
            }
        }
        
        // Check for twin's death
        if (gameData.twins?.includes(playerToKill.userId)) {
            const otherTwinId = gameData.twins.find(id => id !== playerToKill.userId);
            if (otherTwinId && !killedThisTurn.has(otherTwinId)) {
                const otherTwin = gameData.players.find(p => p.userId === otherTwinId);
                gameData.events.push({
                    id: `evt_twin_${Date.now()}_${otherTwinId}`,
                    gameId: gameData.id!,
                    round: gameData.currentRound,
                    type: 'special',
                    message: `Tras la muerte de ${playerToKill.displayName}, su gemelo/a ${otherTwin?.displayName || 'desconocido'} muere de pena.`,
                    data: { killedPlayerId: otherTwinId, originalVictimId: playerId },
                    createdAt: Timestamp.now(),
                });
                killQueue.push(otherTwinId);
            }
        }

        // Check for Virginia Woolf's linked player
        const virginiaLink = gameData.players.find(p => p.role === 'virginia_woolf' && p.virginiaWoolfTargetId && p.userId === playerToKill.userId);
        if (virginiaLink && virginiaLink.virginiaWoolfTargetId && !killedThisTurn.has(virginiaLink.virginiaWoolfTargetId)) {
            const linkedPlayer = gameData.players.find(p => p.userId === virginiaLink.virginiaWoolfTargetId);
            gameData.events.push({
                id: `evt_virginia_${Date.now()}_${linkedPlayer?.userId}`,
                gameId: gameData.id!,
                round: gameData.currentRound,
                type: 'special',
                message: `Tras la muerte de ${playerToKill.displayName}, ${linkedPlayer?.displayName || 'alguien'} muere por un vínculo misterioso.`,
                data: { killedPlayerId: linkedPlayer?.userId, originalVictimId: playerToKill.userId },
                createdAt: Timestamp.now(),
            });
            killQueue.push(linkedPlayer!.userId);
        }
    }
    
    if (hunterTriggeredId) {
        const isHunterValid = gameData.players.some(p => p.userId === hunterTriggeredId);
        if (isHunterValid) {
            gameData.pendingHunterShot = hunterTriggeredId;
            gameData.phase = 'hunter_shot';
        } else {
             console.warn(`Hunter ability triggered for a non-existent player (${hunterTriggeredId}). Skipping hunter_shot phase.`);
        }
    }

    return { updatedGame: gameData, triggeredHunterId: hunterTriggeredId, gameOver };
}


function checkGameOver(gameData: Game): { isGameOver: boolean; message: string; winners: string[]; winnerCode: string | null } {
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy'];
    const villagerRoles: Player['role'][] = ['villager', 'seer', 'doctor', 'hunter', 'guardian', 'priest', 'prince', 'lycanthrope', 'twin', 'hechicera', 'ghost', 'virginia_woolf', 'leprosa', 'river_siren', 'lookout', 'troublemaker', 'silencer', 'seer_apprentice', 'elder_leader', 'sleeping_fairy'];
    
    const aliveWerewolves = alivePlayers.filter(p => wolfRoles.includes(p.role));
    const aliveVillagers = alivePlayers.filter(p => villagerRoles.includes(p.role));
    const aliveCultMembers = alivePlayers.filter(p => p.isCultMember);

    // Condition 1: Lovers Win (only 2 players left and they are the lovers)
    if (gameData.lovers && alivePlayers.length === 2 && alivePlayers.every(p => gameData.lovers!.includes(p.userId))) {
        const lover1 = gameData.players.find(p => p.userId === gameData.lovers![0]);
        const lover2 = gameData.players.find(p => p.userId === gameData.lovers![1]);
        return {
            isGameOver: true,
            message: `¡Los enamorados han ganado! Desafiando a sus bandos, ${lover1?.displayName} y ${lover2?.displayName} han triunfado solos contra el mundo.`,
            winners: gameData.lovers,
            winnerCode: 'lovers',
        };
    }

    // Condition 2: Cult Leader wins (all alive players are cult members)
    if (gameData.settings.cult_leader && aliveCultMembers.length > 0 && aliveCultMembers.length === alivePlayers.length) {
         const cultLeader = gameData.players.find(p => p.role === 'cult_leader');
         return {
            isGameOver: true,
            message: '¡El Culto ha ganado! Todos los supervivientes se han unido a la sombra del Líder.',
            winners: cultLeader ? [cultLeader.userId] : aliveCultMembers.map(p => p.userId),
            winnerCode: 'cult',
        };
    }
    
    // Condition 3: Vampire wins
    if (gameData.settings.vampire && gameData.players.some(p => p.role === 'vampire' && p.isAlive) && (gameData.vampireKills || 0) >= 3) {
        return {
            isGameOver: true,
            message: '¡El Vampiro ha ganado! Ha reclamado sus tres víctimas y ahora reina en la oscuridad.',
            winners: gameData.players.filter(p => p.role === 'vampire').map(p => p.userId),
            winnerCode: 'vampire',
        };
    }

    // Condition 4: Fisherman wins
    const fisherman = gameData.players.find(p => p.role === 'fisherman');
    if (gameData.settings.fisherman && fisherman && fisherman.isAlive) {
        const aliveVillagersOnBoat = aliveVillagers.every(v => gameData.boat?.includes(v.userId));
        if (aliveVillagers.length > 0 && aliveVillagersOnBoat) {
            return {
                isGameOver: true,
                message: `¡El Pescador ha ganado! Ha conseguido salvar a todos los aldeanos en su barco.`,
                winners: [fisherman.userId],
                winnerCode: 'fisherman',
            };
        }
    }

     // Condition Banshee
    const banshee = gameData.players.find(p => p.role === 'banshee');
    if (gameData.settings.banshee && banshee && banshee.isAlive) {
        const screams = banshee.bansheeScreams || {};
        if (Object.keys(screams).length >= 2) {
             return {
                isGameOver: true,
                message: `¡La Banshee ha ganado! Sus dos gritos han sentenciado a muerte y ha cumplido su objetivo.`,
                winners: [banshee.userId],
                winnerCode: 'banshee',
            };
        }
    }


    // Condition 5: Werewolves Win (number of werewolves is equal or greater than non-wolves)
    const nonWolves = alivePlayers.filter(p => !wolfRoles.includes(p.role));
    if (aliveWerewolves.length > 0 && aliveWerewolves.length >= nonWolves.length) {
        return {
            isGameOver: true,
            message: "¡Los hombres lobo han ganado! Superan en número a los aldeanos y la oscuridad consume el pueblo.",
            winners: aliveWerewolves.map(p => p.userId),
            winnerCode: 'wolves',
        };
    }
    
    // Condition 6: Villagers Win (no threats left)
    const threats = alivePlayers.filter(p => wolfRoles.includes(p.role) || p.role === 'vampire');
    if (threats.length === 0 && alivePlayers.length > 0) {
        // Cult members don't win with villagers unless they are the only ones left (handled above)
        return {
            isGameOver: true,
            message: "¡El pueblo ha ganado! Todas las amenazas han sido eliminadas.",
            winners: aliveVillagers.map(p => p.userId),
            winnerCode: 'villagers',
        };
    }
    
    // Condition 7: Draw (no one left alive)
    if (alivePlayers.length === 0) {
        return {
            isGameOver: true,
            message: "¡Nadie ha sobrevivido a la masacre!",
            winners: [],
            winnerCode: 'draw',
        };
    }

    return { isGameOver: false, message: "", winners: [], winnerCode: null };
}


export async function processNight(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found!");
            
            let game = gameSnap.data() as Game;
            if (game.phase !== 'night' || game.status !== 'in_progress') {
                console.log("Skipping night process, phase is no longer 'night'.");
                return;
            }
            
            // Initialize arrays if they don't exist
            game.nightActions = game.nightActions || [];
            game.events = game.events || [];
            game.chatMessages = game.chatMessages || [];
            game.vampireKills = game.vampireKills || 0;
            game.boat = game.boat || [];

            const actions = game.nightActions.filter(a => a.round === game.currentRound);
            
            // Initialize night state variables
            let finalKilledPlayerIds: string[] = [];
            let killedPlayerNamesAndRoles = [];
            let killedByPoisonId: string | null = null;
            let savedPlayerIds: string[] = [];
            let fishermanDied = false;

            // --- PROCESS ACTIONS IN ORDER ---

            // 0. Set up protections
            const savedByDoctorId = actions.find(a => a.actionType === 'doctor_heal')?.targetId || null;
            const savedByHechiceraId = actions.find(a => a.actionType === 'hechicera_save')?.targetId || null;
            const savedByGuardianId = actions.find(a => a.actionType === 'guardian_protect')?.targetId || null;
            const savedByPriestId = actions.find(a => a.actionType === 'priest_bless')?.targetId || null;
            const allProtectedIds = new Set([savedByDoctorId, savedByHechiceraId, savedByGuardianId, savedByPriestId].filter(Boolean) as string[]);
            savedPlayerIds = Array.from(allProtectedIds);

            // 1. NON-KILLING ACTIONS FIRST
            actions.filter(a => a.actionType === 'cult_recruit' || a.actionType === 'shapeshifter_select' || a.actionType === 'virginia_woolf_link' || a.actionType === 'river_siren_charm' || a.actionType === 'silencer_silence' || a.actionType === 'elder_leader_exile' || a.actionType === 'witch_hunt').forEach(action => {
                const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
                const playerIndex = game.players.findIndex(p => p.userId === action.playerId);
                if (targetIndex > -1) {
                    if(action.actionType === 'cult_recruit') game.players[targetIndex].isCultMember = true;
                    if(action.actionType === 'shapeshifter_select' && playerIndex > -1) game.players[playerIndex].shapeshifterTargetId = action.targetId;
                    if(action.actionType === 'virginia_woolf_link' && playerIndex > -1) game.players[playerIndex].virginiaWoolfTargetId = action.targetId;
                    if(action.actionType === 'river_siren_charm' && playerIndex > -1) game.players[playerIndex].riverSirenTargetId = action.targetId;
                    if(action.actionType === 'silencer_silence') game.silencedPlayerId = action.targetId;
                    if(action.actionType === 'elder_leader_exile') game.exiledPlayerId = action.targetId;
                    if(action.actionType === 'witch_hunt') {
                        const target = game.players[targetIndex];
                        if (target.role === 'seer') {
                            game.witchFoundSeer = true;
                        }
                    }
                }
            });


            // 2. KILLING ACTIONS
            // Vampire Bites
            const vampireAction = actions.find(a => a.actionType === 'vampire_bite');
            if (vampireAction?.targetId) {
                const targetIndex = game.players.findIndex(p => p.userId === vampireAction.targetId);
                if (targetIndex > -1) {
                    game.players[targetIndex].biteCount = (game.players[targetIndex].biteCount || 0) + 1;
                    if (game.players[targetIndex].biteCount >= 3) {
                        if (!allProtectedIds.has(vampireAction.targetId)) {
                             finalKilledPlayerIds.push(vampireAction.targetId);
                             game.vampireKills = (game.vampireKills || 0) + 1;
                        }
                    }
                }
            }

            // Fisherman Catch
            const fishermanAction = actions.find(a => a.actionType === 'fisherman_catch');
            if (fishermanAction?.targetId) {
                const targetPlayer = game.players.find(p => p.userId === fishermanAction.targetId);
                const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
                if (targetPlayer && wolfRoles.includes(targetPlayer.role)) {
                    finalKilledPlayerIds.push(fishermanAction.playerId);
                    fishermanDied = true;
                } else if (targetPlayer) {
                    if (!game.boat.includes(targetPlayer.userId)) {
                         game.boat.push(targetPlayer.userId);
                    }
                }
            }


            // Werewolf Attack
            if (game.leprosaBlockedRound !== game.currentRound) {
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
                           // Saved
                        } else if (targetPlayer.role === 'cursed' && game.settings.cursed) {
                            const playerIndex = game.players.findIndex(p => p.userId === targetId);
                            if (playerIndex > -1) {
                                game.players[playerIndex].role = 'werewolf';
                                game.events.push({ id: `evt_transform_${Date.now()}`, gameId, round: game.currentRound, type: 'player_transformed', message: `${targetPlayer.displayName} ha sido transformado en Hombre Lobo.`, data: { playerId: targetId }, createdAt: Timestamp.now() });
                            }
                        } else {
                            finalKilledPlayerIds.push(targetId);
                        }
                    }
                }
            }
            
            // Hechicera Poison
            const poisonAction = actions.find(a => a.actionType === 'hechicera_poison');
            if (poisonAction?.targetId && !finalKilledPlayerIds.includes(poisonAction.targetId) && !allProtectedIds.has(poisonAction.targetId)) {
                finalKilledPlayerIds.push(poisonAction.targetId);
                killedByPoisonId = poisonAction.targetId;
            }

            // Banshee Scream
            const bansheeAction = actions.find(a => a.actionType === 'banshee_scream');
            if (bansheeAction?.targetId) {
                const playerIndex = game.players.findIndex(p => p.userId === bansheeAction.playerId);
                if(playerIndex > -1) {
                    game.players[playerIndex].bansheeScreams = {
                        ...(game.players[playerIndex].bansheeScreams || {}),
                        [game.currentRound]: bansheeAction.targetId
                    };
                }
            }


            // 3. APPLY KILLS AND CHECK FOR GAME OVER
            if (finalKilledPlayerIds.length > 0) {
                const { gameOver } = killPlayer(game, finalKilledPlayerIds);
                if (gameOver) {
                    const drunkPlayer = game.players.find(p => p.role === 'drunk_man' && !p.isAlive);
                    if (drunkPlayer) {
                         handleDrunkManWin(transaction, gameRef, game, drunkPlayer);
                    }
                    return; // Drunk man win handled, exit transaction.
                }
            }
            
            // 4. Create Night Event
            const nightEvent: GameEvent = {
                id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result',
                message: '',
                data: { killedPlayerIds: finalKilledPlayerIds, savedPlayerIds: savedPlayerIds, killedByPoisonId: killedByPoisonId },
                createdAt: Timestamp.now(),
            };
            const newlyKilledPlayers = game.players.filter(p => !p.isAlive && finalKilledPlayerIds.includes(p.userId));
            killedPlayerNamesAndRoles = newlyKilledPlayers.map(p => `${p.displayName} (que era ${roleDetails[p.role!]?.name || 'un rol desconocido'})`);

            if (killedPlayerNamesAndRoles.length > 0) {
                nightEvent.message = `Anoche, el pueblo perdió a ${killedPlayerNamesAndRoles.join(' y a ')}.`;
                 if (fishermanDied) {
                    nightEvent.message += ` El Pescador eligió a un lobo y murió.`;
                }
            } else if (game.leprosaBlockedRound === game.currentRound) {
                nightEvent.message = "Gracias a la Leprosa, los lobos no pudieron atacar esta noche. Nadie murió.";
            } else if (actions.some(a => a.actionType === 'werewolf_kill' || a.actionType === 'hechicera_poison' || a.actionType === 'vampire_bite')) {
                 nightEvent.message = "Se escuchó un grito en la noche, ¡pero alguien fue salvado en el último momento!";
            } else {
                 nightEvent.message = "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
            }
            game.events.push(nightEvent);
            
            // 5. Check for game over state again after all deaths are resolved
            const { isGameOver, message, winners, winnerCode } = checkGameOver(game);
            if (isGameOver) {
                const gameOverEvent: GameEvent = {
                    id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message, data: { winners, winnerCode }, createdAt: Timestamp.now(),
                };
                transaction.update(gameRef, {
                    status: 'finished', phase: 'finished', players: game.players,
                    events: arrayUnion(gameOverEvent, ...game.events.filter(e => e.id.startsWith('evt_lover_death') || e.id.startsWith('evt_twin_'))),
                    pendingHunterShot: null
                });
                return;
            }

            // 6. If hunter was triggered, stop and transition to hunter_shot phase
            if (game.phase === 'hunter_shot') {
                transaction.update(gameRef, { 
                    players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot
                });
                return;
            }

            // 7. Transition to next phase (day)
            game.players.forEach(p => p.votedFor = null); // Reset votes for the new day
            
            transaction.update(gameRef, {
              players: game.players,
              events: game.events,
              phase: 'day',
              chatMessages: [], 
              wolfCubRevengeRound: game.wolfCubRevengeRound === game.currentRound ? 0 : game.wolfCubRevengeRound,
              pendingHunterShot: null,
            });
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
      if (!gameSnap.exists()) throw new Error("Partida no encontrada");

      let game = gameSnap.data() as Game;

      if (game.phase !== 'day' || game.status !== 'in_progress') {
        console.log("Omitiendo procesamiento de votos, la fase ya no es 'día' o la partida no está en curso.");
        return;
      }

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
              createdAt: Timestamp.now(), data: { lynchedPlayerId: null },
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
          const { gameOver } = killPlayer(game, [lynchedPlayerId]);
          if (gameOver) {
            const drunkPlayer = game.players.find(p => p.role === 'drunk_man' && !p.isAlive);
            if (drunkPlayer) {
                handleDrunkManWin(transaction, gameRef, game, drunkPlayer);
            }
            return;
          }
      }
      
      const { isGameOver, message, winners, winnerCode } = checkGameOver(game);
      if (isGameOver) {
          const gameOverEvent: GameEvent = {
              id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message, data: { winners, winnerCode }, createdAt: Timestamp.now(),
          };
          transaction.update(gameRef, {
              status: 'finished', phase: 'finished', players: game.players, events: arrayUnion(gameOverEvent, ...game.events.filter(e => e.id.startsWith('evt_lover_death') || e.id.startsWith('evt_twin_'))), pendingHunterShot: null,
          });
          return;
      }

      if (game.phase === 'hunter_shot') {
        transaction.update(gameRef, {
          players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot,
        });
        return;
      }

      game.players.forEach(p => { p.votedFor = null; });

      transaction.update(gameRef, {
        players: game.players, events: game.events, phase: 'night', currentRound: increment(1), pendingHunterShot: null,
      });
    });

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
    if (!seerPlayer || (seerPlayer.role !== 'seer' && !(seerPlayer.role === 'seer_apprentice' && game.seerDied))) {
      throw new Error("No tienes el don de la videncia.");
    }
    
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
            
            const { gameOver } = killPlayer(game, [targetId]);
            if (gameOver) {
                 const drunkPlayer = game.players.find(p => p.role === 'drunk_man' && !p.isAlive);
                 if (drunkPlayer) {
                    handleDrunkManWin(transaction, gameRef, game, drunkPlayer);
                 }
                return;
            }
            
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

            const { isGameOver, message, winners, winnerCode } = checkGameOver(game);
            if (isGameOver) {
                const gameOverEvent: GameEvent = {
                    id: `evt_gameover_${Date.now()}`,
                    gameId,
                    round: game.currentRound,
                    type: 'game_over',
                    message,
                    data: { winners, winnerCode },
                    createdAt: Timestamp.now(),
                };
                transaction.update(gameRef, {
                    status: 'finished',
                    phase: 'finished',
                    players: game.players,
                    events: arrayUnion(gameOverEvent, ...game.events.filter(e => e.id.startsWith('evt_lover_death') || e.id.startsWith('evt_twin_'))),
                    pendingHunterShot: null,
                });
                return;
            }
            
            // Determine next phase based on how the original hunter died.
            const hunterDeathEvent = [...game.events]
                .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
                .find(e => 
                    (e.type === 'vote_result' && e.data?.lynchedPlayerId === hunterId) ||
                    (e.type === 'night_result' && e.data?.killedPlayerIds?.includes(hunterId)) ||
                    (e.type === 'lover_death' && e.data?.killedPlayerId === hunterId)
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
         case 'vampire': {
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            // Vampire bites someone they haven't bitten 3 times yet
            const biteableTargets = potentialTargets.filter(p => (p.biteCount || 0) < 3);
            return { actionType: 'vampire_bite', targetId: randomTarget(biteableTargets.length > 0 ? biteableTargets : potentialTargets) };
        }
        case 'cult_leader': {
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            const nonCultMembers = potentialTargets.filter(p => !p.isCultMember);
            return { actionType: 'cult_recruit', targetId: randomTarget(nonCultMembers) };
        }
        case 'fisherman': {
            if (game.phase === 'day') {
                return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            }
            const nonBoatTargets = potentialTargets.filter(p => !game.boat?.includes(p.userId));
            return { actionType: 'fisherman_catch', targetId: randomTarget(nonBoatTargets) };
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
                case 'vampire_bite':
                case 'cult_recruit':
                case 'fisherman_catch':
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
            
            let game = gameSnap.data() as Game;
            if (game.phase !== 'day') return;
            
            const playerIndex = game.players.findIndex(p => p.userId === voterId && p.isAlive);
            if (playerIndex === -1) throw new Error("Player not found or is not alive");
            
            // Prevent re-voting
            if (game.players[playerIndex].votedFor) return;

            voterName = game.players[playerIndex].displayName;
            const targetPlayer = game.players.find(p => p.userId === targetId);
            if (!targetPlayer) throw new Error("Target player not found");
            targetName = targetPlayer.displayName;

            game.players[playerIndex].votedFor = targetId;
            
            transaction.update(gameRef, { players: game.players });

            // Check if all alive players have voted
            const alivePlayers = game.players.filter(p => p.isAlive);
            const allVotesIn = alivePlayers.every(p => {
                const currentPlayerState = game.players.find(gp => gp.userId === p.userId);
                return !!currentPlayerState?.votedFor;
            });

            if (allVotesIn) {
                // This is now safe because it's the final action of this transaction and will trigger the next one.
                // We call this OUTSIDE and AFTER the transaction completes.
            }
        });
        
        // NOW check if we should process votes, outside the transaction.
        const finalGameSnap = await getDoc(gameRef);
        if (finalGameSnap.exists()) {
            const game = finalGameSnap.data() as Game;
            const alivePlayers = game.players.filter(p => p.isAlive);
            const allVotesIn = alivePlayers.every(p => p.votedFor);
            if (allVotesIn) {
                await processVotes(db, gameId);
            }
        }


        // Trigger AI chat after vote is committed
        if (voterName && targetName) {
             const allPlayers = ((await getDoc(gameRef)).data() as Game).players || [];
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
                guardianSelfProtects: 0,
                biteCount: 0,
                isCultMember: false,
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
                vampireKills: 0,
                boat: [],
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

export async function sendGhostMessage(
    db: Firestore,
    gameId: string,
    ghostId: string,
    targetId: string,
    message: string
) {
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

            // Create a special event only visible to the target
            const ghostEvent: GameEvent = {
                id: `evt_ghost_${Date.now()}`,
                gameId,
                round: game.currentRound,
                type: 'special',
                // This message is only truly seen by the target.
                message: `Has recibido un misterioso mensaje desde el más allá: "${message}"`,
                createdAt: Timestamp.now(),
                data: {
                    targetId: targetId, // This is key for filtering on the client
                    originalMessage: message,
                },
            };

            game.players[playerIndex].ghostMessageSent = true;

            transaction.update(gameRef, {
                players: game.players,
                events: arrayUnion(ghostEvent),
            });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error sending ghost message:", error);
         if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado para enviar el mensaje." };
        }
        return { success: false, error: error.message || "No se pudo enviar el mensaje." };
    }
}




