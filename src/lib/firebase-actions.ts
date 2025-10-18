
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
    shapeshifterTargetId: null,
    virginiaWoolfTargetId: null,
    riverSirenTargetId: null,
    ghostMessageSent: false,
    resurrectorAngelUsed: false,
    lookoutUsed: false,
    bansheeScreams: {},
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
      wolfChatMessages: [],
      fairyChatMessages: [],
      twinChatMessages: [],
      maxPlayers: maxPlayers,
      createdAt: Timestamp.now(),
      currentRound: 0,
      settings: {
          ...settings,
          werewolves: werewolfCount,
      },
      pendingHunterShot: null,
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
      fairiesFound: false,
      fairyKillUsed: false,
  };
  
  try {
    await setDoc(gameRef, gameData);
    
    // Unirse a la partida después de crearla
    const joinResult = await joinGame(db, gameId, userId, displayName);
    if (joinResult.error) {
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
        .filter(key => key !== 'werewolves' && key !== 'fillWithAI' && key !== 'isPublic' && settings[key as keyof typeof settings] === true) as any;

    const numWerewolves = Math.max(1, Math.floor(playerCount / 5));
    for (let i = 0; i < numWerewolves; i++) {
        if(roles.length < playerCount) roles.push('werewolf');
    }

    // Shuffle roles before assigning to avoid predictable role groups
    const shuffledSpecialRoles = specialRoles.sort(() => Math.random() - 0.5);

    for (const role of shuffledSpecialRoles) {
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
    
    while (roles.length < playerCount) {
        roles.push('villager');
    }

    roles = roles.slice(0, playerCount);

    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy'];
    const hasWolfRole = roles.some(r => wolfRoles.includes(r));
    
    if (!hasWolfRole && playerCount > 0) {
        const villagerIndex = roles.indexOf('villager');
        if (villagerIndex !== -1) {
            roles[villagerIndex] = 'werewolf';
        } else if (roles.length > 0) {
            // If no villagers, replace the last special role
            roles[roles.length - 1] = 'werewolf';
        } else { 
            // Should not happen if playerCount > 0, but as a fallback
            roles.push('werewolf');
        }
    }
    
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
                const p = { ...player, role: newRoles[index] };
                if (p.role === 'cult_leader') {
                    p.isCultMember = true;
                }
                return p;
            });

            const twinUserIds = assignedPlayers.filter(p => p.role === 'twin').map(p => p.userId);
            
            transaction.update(gameRef, {
                players: assignedPlayers,
                twins: twinUserIds.length === 2 ? [twinUserIds[0], twinUserIds[1]] as [string, string] : null,
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
  const { gameId, playerId } = action;
  const gameRef = doc(db, 'games', gameId);
  try {
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        
        let game = gameSnap.data() as Game;
        if (game.phase !== 'night') return;

        if (game.exiledPlayerId === playerId) {
            throw new Error("Has sido exiliado esta noche y no puedes usar tu habilidad.");
        }

        const player = game.players.find(p => p.userId === action.playerId);
        if (!player) throw new Error("Player not found");
        
        const nightActions = game.nightActions ? [...game.nightActions] : [];
        const existingActionIndex = nightActions.findIndex(a => a.round === action.round && a.playerId === action.playerId);

        if (action.actionType === 'doctor_heal') {
            const targetPlayer = game.players.find(p => p.userId === action.targetId);
            if (targetPlayer?.lastHealedRound === game.currentRound - 1) {
                console.warn(`Doctor ${action.playerId} tried to heal ${action.targetId} two nights in a row. Action ignored.`);
                throw new Error("No puedes proteger a la misma persona dos noches seguidas.");
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
        if (action.actionType === 'lookout_spy' && player.lookoutUsed) {
            throw new Error("Ya has usado tu habilidad de Vigía.");
        }
        if (action.actionType === 'resurrect' && player.resurrectorAngelUsed) {
            throw new Error("Ya has usado tu poder de resurrección.");
        }
        
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
        } else if (action.actionType === 'hechicera_poison' && playerIndex > -1) {
            players[playerIndex].potions!.poison = action.round;
        } else if (action.actionType === 'hechicera_save' && playerIndex > -1) {
            players[playerIndex].potions!.save = action.round;
        } else if (action.actionType === 'priest_bless' && action.targetId === action.playerId && playerIndex > -1) {
            players[playerIndex].priestSelfHealUsed = true;
        } else if (action.actionType === 'guardian_protect' && action.targetId === action.playerId && playerIndex > -1) {
            players[playerIndex].guardianSelfProtects = (players[playerIndex].guardianSelfProtects || 0) + 1;
        } else if (action.actionType === 'lookout_spy' && playerIndex > -1) {
            players[playerIndex].lookoutUsed = true;
        } else if (action.actionType === 'river_siren_charm' && playerIndex > -1) {
            players[playerIndex].riverSirenTargetId = action.targetId;
        } else if (action.actionType === 'resurrect' && playerIndex > -1) {
            players[playerIndex].resurrectorAngelUsed = true;
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

function handleDrunkManWin(transaction: Transaction, gameRef: DocumentReference, gameData: Game, drunkPlayer: Player) {
    const gameOverEvent: GameEvent = {
        id: `evt_gameover_${Date.now()}`,
        gameId: gameData.id!,
        round: gameData.currentRound,
        type: 'game_over',
        message: `¡El Hombre Ebrio ha ganado! Su único objetivo era ser eliminado y lo ha conseguido.`,
        data: { winnerCode: 'drunk', winners: [drunkPlayer.userId] },
        createdAt: Timestamp.now(),
    };
    const playerIndex = gameData.players.findIndex(p => p.userId === drunkPlayer.userId);
    if(playerIndex > -1) {
        gameData.players[playerIndex].isAlive = false;
    }
    
    gameData.events.push(gameOverEvent);
    
    transaction.update(gameRef, {
        status: 'finished',
        phase: 'finished',
        players: gameData.players,
        events: gameData.events,
    });
    return true; 
}


function killPlayer(
    gameData: Game,
    playerIdsToKill: string[],
    cause: 'vampire' | 'wolf' | 'other' = 'other'
): { updatedGame: Game; triggeredHunterId: string | null; gameOver: boolean; } {
    let triggeredHunterId: string | null = null;
    let gameOver = false;
    
    const killQueue = [...new Set(playerIdsToKill)];
    const alreadyProcessed = new Set<string>();

    while (killQueue.length > 0) {
        const playerIdToKill = killQueue.shift();

        if (!playerIdToKill || alreadyProcessed.has(playerIdToKill)) {
            continue;
        }

        const playerIndex = gameData.players.findIndex(p => p.userId === playerIdToKill);
        if (playerIndex === -1 || !gameData.players[playerIndex].isAlive) {
            continue;
        }
        
        alreadyProcessed.add(playerIdToKill);
        const playerToKill = gameData.players[playerIndex];

        if (playerToKill.role === 'drunk_man' && gameData.settings.drunk_man) {
            gameData.players[playerIndex].isAlive = false;
            gameOver = true; // Drunk man win condition takes precedence
            return { updatedGame: gameData, triggeredHunterId: null, gameOver: true };
        }
        
        gameData.players[playerIndex].isAlive = false;
        
        if (cause === 'vampire') {
             gameData.events.push({
                id: `evt_vampire_kill_${Date.now()}_${playerIdToKill}`,
                gameId: gameData.id!,
                round: gameData.currentRound,
                type: 'vampire_kill',
                message: `${playerToKill.displayName} ha sido desangrado por un vampiro.`,
                data: { killedPlayerId: playerIdToKill },
                createdAt: Timestamp.now(),
            });
        }
        
        if (playerToKill.role === 'seer') gameData.seerDied = true;
        if (playerToKill.role === 'hunter' && gameData.settings.hunter && !triggeredHunterId) {
            triggeredHunterId = playerToKill.userId;
        }
        if (playerToKill.role === 'wolf_cub' && gameData.settings.wolf_cub) {
            gameData.wolfCubRevengeRound = gameData.currentRound;
        }
        if (playerToKill.role === 'leprosa' && gameData.settings.leprosa) gameData.leprosaBlockedRound = gameData.currentRound + 1;

        const checkAndQueueChainDeath = (linkedIds: string[] | null | undefined, deadPlayer: Player, eventType: 'special', messageTemplate: string) => {
            if (!linkedIds || !linkedIds.includes(deadPlayer.userId)) return;

            const otherId = linkedIds.find(id => id !== deadPlayer.userId);
            const otherPlayer = otherId ? gameData.players.find(p => p.userId === otherId) : undefined;
            
            if (otherPlayer && otherPlayer.isAlive && !alreadyProcessed.has(otherId) && !killQueue.includes(otherId)) {
                gameData.events.push({
                    id: `evt_${eventType}_${Date.now()}_${otherId}`,
                    gameId: gameData.id!,
                    round: gameData.currentRound,
                    type: eventType,
                    message: messageTemplate.replace('{otherName}', otherPlayer.displayName).replace('{victimName}', deadPlayer.displayName),
                    data: { killedPlayerId: otherId, originalVictimId: deadPlayer.userId },
                    createdAt: Timestamp.now(),
                });
                killQueue.push(otherId);
            }
        };

        checkAndQueueChainDeath(gameData.twins, playerToKill, 'special', 'Tras la muerte de {victimName}, su gemelo/a {otherName} muere de pena.');
        
        const virginiaLinker = gameData.players.find(p => p.role === 'virginia_woolf' && p.userId === playerToKill.userId);
        if (virginiaLinker && virginiaLinker.virginiaWoolfTargetId) {
             const linkedPlayerId = virginiaLinker.virginiaWoolfTargetId;
             const linkedPlayer = gameData.players.find(p => p.userId === linkedPlayerId);
             if (linkedPlayer && linkedPlayer.isAlive && !alreadyProcessed.has(linkedPlayerId) && !killQueue.includes(linkedPlayerId)) {
                 gameData.events.push({
                    id: `evt_virginia_${Date.now()}_${linkedPlayer.userId}`,
                    gameId: gameData.id!,
                    round: gameData.currentRound,
                    type: 'special',
                    message: `Tras la muerte de ${playerToKill.displayName}, ${linkedPlayer.displayName} muere por un vínculo misterioso.`,
                    data: { killedPlayerId: linkedPlayer.userId, originalVictimId: playerToKill.userId },
                    createdAt: Timestamp.now(),
                });
                killQueue.push(linkedPlayerId);
             }
        }
    }
    
    if (triggeredHunterId) {
        gameData.pendingHunterShot = triggeredHunterId;
        gameData.phase = 'hunter_shot';
    }

    return { updatedGame: gameData, triggeredHunterId: triggeredHunterId, gameOver };
}


function checkGameOver(gameData: Game): { isGameOver: boolean; message: string; winnerCode?: string; winners: string[] } {
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy']; // Seeker fairy is wolf team
    
    const aliveWerewolves = alivePlayers.filter(p => wolfRoles.includes(p.role));
    const aliveCultMembers = alivePlayers.filter(p => p.isCultMember);

    // Fairies win condition
    if (gameData.fairyKillUsed) {
        const fairies = gameData.players.filter(p => p.role === 'seeker_fairy' || p.role === 'sleeping_fairy');
        const fairiesAreAlive = fairies.every(f => f.isAlive);
        if (fairiesAreAlive) {
            return {
                isGameOver: true,
                winnerCode: 'fairies',
                message: '¡Las Hadas han ganado! Han lanzado su maldición y cumplido su misterioso objetivo.',
                winners: fairies.map(f => f.userId)
            };
        }
    }
    
    if (gameData.settings.cult_leader && aliveCultMembers.length > 0 && aliveCultMembers.length === alivePlayers.length) {
         const cultLeader = gameData.players.find(p => p.role === 'cult_leader');
         return {
            isGameOver: true,
            winnerCode: 'cult',
            message: '¡El Culto ha ganado! Todos los supervivientes se han unido a la sombra del Líder.',
            winners: cultLeader ? [cultLeader.userId] : aliveCultMembers.map(p => p.userId)
        };
    }
    
    if (gameData.settings.vampire && gameData.players.some(p => p.role === 'vampire' && p.isAlive) && (gameData.vampireKills || 0) >= 3) {
        return {
            isGameOver: true,
            winnerCode: 'vampire',
            message: '¡El Vampiro ha ganado! Ha reclamado sus tres víctimas y ahora reina en la oscuridad.',
            winners: gameData.players.filter(p => p.role === 'vampire').map(p => p.userId)
        };
    }

    const fisherman = gameData.players.find(p => p.role === 'fisherman');
    if (gameData.settings.fisherman && fisherman && fisherman.isAlive) {
        const aliveVillagers = alivePlayers.filter(p => !wolfRoles.includes(p.role) && p.role !== 'vampire');
        const aliveVillagersOnBoat = aliveVillagers.every(v => gameData.boat?.includes(v.userId));
        if (aliveVillagers.length > 0 && aliveVillagersOnBoat) {
            return {
                isGameOver: true,
                winnerCode: 'fisherman',
                message: `¡El Pescador ha ganado! Ha conseguido salvar a todos los aldeanos en su barco.`,
                winners: [fisherman.userId],
            };
        }
    }

    const banshee = gameData.players.find(p => p.role === 'banshee');
    if (gameData.settings.banshee && banshee?.isAlive) {
        const screams = banshee.bansheeScreams || {};
        if (Object.keys(screams).length >= 2) {
             const scream1TargetId = screams[Object.keys(screams)[0]];
             const scream2TargetId = screams[Object.keys(screams)[1]];
             const target1 = gameData.players.find(p => p.userId === scream1TargetId);
             const target2 = gameData.players.find(p => p.userId === scream2TargetId);

             if (target1 && target2 && !target1.isAlive && !target2.isAlive) {
                return {
                    isGameOver: true,
                    winnerCode: 'banshee',
                    message: `¡La Banshee ha ganado! Sus dos gritos han sentenciado a muerte y ha cumplido su objetivo.`,
                    winners: [banshee.userId],
                };
             }
        }
    }

    const nonWolves = alivePlayers.filter(p => !wolfRoles.includes(p.role));
    if (aliveWerewolves.length > 0 && aliveWerewolves.length >= nonWolves.length) {
        return {
            isGameOver: true,
            winnerCode: 'wolves',
            message: "¡Los hombres lobo han ganado! Superan en número a los aldeanos y la oscuridad consume el pueblo.",
            winners: aliveWerewolves.map(p => p.userId)
        };
    }
    
    // Villagers win if all threats are gone
    const threats = alivePlayers.filter(p => wolfRoles.includes(p.role) || p.role === 'vampire' || (p.role === 'sleeping_fairy' && gameData.fairiesFound));
    if (threats.length === 0 && alivePlayers.length > 0) {
        const villageWinners = alivePlayers.filter(p => !p.isCultMember && p.role !== 'sleeping_fairy'); // Sleeping fairy is neutral if not found
        return {
            isGameOver: true,
            winnerCode: 'villagers',
            message: "¡El pueblo ha ganado! Todas las amenazas han sido eliminadas.",
            winners: villageWinners.map(p => p.userId)
        };
    }
    
    if (alivePlayers.length === 0) {
        return {
            isGameOver: true,
            winnerCode: 'draw',
            message: "¡Nadie ha sobrevivido a la masacre!",
            winners: []
        };
    }

    return { isGameOver: false, message: "", winners: [] };
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

            const initialPlayerState = JSON.parse(JSON.stringify(game.players));

            game.nightActions = game.nightActions || [];
            game.events = game.events || [];
            game.players.forEach(p => {
                p.bansheeScreams = p.bansheeScreams || {};
                p.potions = p.potions || { poison: null, save: null };
                p.biteCount = p.biteCount || 0;
            });
            
            const actions = game.nightActions.filter(a => a.round === game.currentRound);
            
            let allKilledPlayerIds: string[] = [];
            let vampireKilledPlayerIds: string[] = [];
            let savedPlayerIds: string[] = [];
            let fishermanDied = false;

            // Process Resurrection first
            const resurrectAction = actions.find(a => a.actionType === 'resurrect');
            if (resurrectAction) {
                const targetIndex = game.players.findIndex(p => p.userId === resurrectAction.targetId);
                if (targetIndex > -1 && !game.players[targetIndex].isAlive) {
                    game.players[targetIndex].isAlive = true;
                    game.events.push({
                        id: `evt_resurrect_${Date.now()}`,
                        gameId,
                        round: game.currentRound,
                        type: 'special',
                        message: `¡Un milagro! ${game.players[targetIndex].displayName} ha sido devuelto a la vida por el Ángel Resucitador.`,
                        data: { resurrectedPlayerId: resurrectAction.targetId },
                        createdAt: Timestamp.now(),
                    });
                }
            }

            const savedByDoctorId = actions.find(a => a.actionType === 'doctor_heal')?.targetId || null;
            const savedByHechiceraId = actions.find(a => a.actionType === 'hechicera_save')?.targetId || null;
            const savedByGuardianId = actions.find(a => a.actionType === 'guardian_protect')?.targetId || null;
            const savedByPriestId = actions.find(a => a.actionType === 'priest_bless')?.targetId || null;
            const allProtectedIds = new Set([savedByDoctorId, savedByHechiceraId, savedByGuardianId, savedByPriestId].filter(Boolean) as string[]);
            savedPlayerIds = Array.from(allProtectedIds);

            actions.filter(a => ['cult_recruit', 'shapeshifter_select', 'virginia_woolf_link', 'river_siren_charm', 'silencer_silence', 'elder_leader_exile', 'witch_hunt', 'fairy_find', 'banshee_scream'].includes(a.actionType)).forEach(action => {
                const playerIndex = game.players.findIndex(p => p.userId === action.playerId);
                const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
                
                if (playerIndex > -1) {
                    if(action.actionType === 'cult_recruit' && targetIndex > -1) game.players[targetIndex].isCultMember = true;
                    if(action.actionType === 'shapeshifter_select') game.players[playerIndex].shapeshifterTargetId = action.targetId;
                    if(action.actionType === 'virginia_woolf_link') game.players[playerIndex].virginiaWoolfTargetId = action.targetId;
                    if(action.actionType === 'river_siren_charm') game.players[playerIndex].riverSirenTargetId = action.targetId;
                    if(action.actionType === 'silencer_silence') game.silencedPlayerId = action.targetId;
                    if(action.actionType === 'elder_leader_exile') game.exiledPlayerId = action.targetId;
                    if(action.actionType === 'witch_hunt' && targetIndex > -1) {
                        if (game.players[targetIndex].role === 'seer') game.witchFoundSeer = true;
                    }
                    if(action.actionType === 'fairy_find' && targetIndex > -1) {
                        if (game.players[targetIndex].role === 'sleeping_fairy') {
                             game.fairiesFound = true;
                             game.events.push({ id: `evt_fairy_found_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `¡Las hadas se han encontrado! Un nuevo poder ha despertado.`, data: {}, createdAt: Timestamp.now() });
                        }
                    }
                     if (action.actionType === 'banshee_scream') {
                        game.players[playerIndex].bansheeScreams![game.currentRound] = action.targetId;
                    }
                }
            });

            const lookoutAction = actions.find(a => a.actionType === 'lookout_spy');
            if (lookoutAction) {
                const isSuccessful = Math.random() < 0.4;
                if (isSuccessful) {
                    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
                    const wolves = game.players.filter(p => wolfRoles.includes(p.role) && p.isAlive);
                    const wolfNames = wolves.map(w => w.displayName).join(', ');
                    game.events.push({ id: `evt_lookout_success_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `¡Has espiado con éxito! Los lobos son: ${wolfNames || 'ninguno'}.`, data: { targetId: lookoutAction.playerId }, createdAt: Timestamp.now() });
                } else {
                    game.events.push({ id: `evt_lookout_fail_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `¡Te han descubierto! Los lobos te han visto espiar y te han eliminado.`, data: { targetId: lookoutAction.playerId }, createdAt: Timestamp.now() });
                    allKilledPlayerIds.push(lookoutAction.playerId);
                }
            }

            const vampireAction = actions.find(a => a.actionType === 'vampire_bite');
            if (vampireAction?.targetId) {
                const targetIndex = game.players.findIndex(p => p.userId === vampireAction.targetId);
                if (targetIndex > -1) {
                    game.players[targetIndex].biteCount = (game.players[targetIndex].biteCount || 0) + 1;
                    if (game.players[targetIndex].biteCount >= 3 && !allProtectedIds.has(vampireAction.targetId)) {
                        vampireKilledPlayerIds.push(vampireAction.targetId);
                        game.vampireKills = (game.vampireKills || 0) + 1;
                    }
                }
            }
            
            const fishermanAction = actions.find(a => a.actionType === 'fisherman_catch');
            if (fishermanAction?.targetId) {
                const targetPlayer = game.players.find(p => p.userId === fishermanAction.targetId);
                const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
                if (targetPlayer && wolfRoles.includes(targetPlayer.role)) {
                    allKilledPlayerIds.push(fishermanAction.playerId);
                    fishermanDied = true;
                } else if (targetPlayer && !game.boat?.includes(targetPlayer.userId)) {
                    game.boat.push(targetPlayer.userId);
                }
            }

            if (game.leprosaBlockedRound !== game.currentRound) {
                const wolfKillActions = actions.filter(a => a.actionType === 'werewolf_kill' || a.actionType === 'fairy_kill');
                if (wolfKillActions.length > 0) {
                     const voteCounts = wolfKillActions.reduce((acc, vote) => {
                        if (vote.targetId) {
                            const targets = vote.targetId.split('|');
                            targets.forEach(targetId => { if(targetId) acc[targetId] = (acc[targetId] || 0) + 1; });
                        }
                        return acc;
                    }, {} as Record<string, number>);

                    let maxVotes = 0;
                    let mostVotedPlayerIds: string[] = [];
                     for (const targetId in voteCounts) {
                        if(!targetId) continue;
                        const targetPlayer = game.players.find(p => p.userId === targetId);
                        if (game.witchFoundSeer && targetPlayer?.role === 'witch') continue;
                        if (voteCounts[targetId] > maxVotes) {
                            maxVotes = voteCounts[targetId];
                            mostVotedPlayerIds = [targetId];
                        } else if (voteCounts[targetId] === maxVotes) {
                            mostVotedPlayerIds.push(targetId);
                        }
                    }

                    const isFairyKill = actions.some(a => a.actionType === 'fairy_kill');
                    const killCount = (game.wolfCubRevengeRound === game.currentRound) ? 2 : 1;
                    
                    let targetsToKill: string[] = [];
                    if (mostVotedPlayerIds.length > 0 && maxVotes > 0) {
                        if (mostVotedPlayerIds.length <= killCount) {
                            targetsToKill = mostVotedPlayerIds;
                        }
                    }
                     if (isFairyKill) game.fairyKillUsed = true;

                    for (const targetId of targetsToKill) {
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
                            allKilledPlayerIds.push(targetId);
                        }
                    }
                }
            }

            const poisonAction = actions.find(a => a.actionType === 'hechicera_poison');
            if (poisonAction?.targetId && !allKilledPlayerIds.includes(poisonAction.targetId) && !allProtectedIds.has(poisonAction.targetId)) {
                allKilledPlayerIds.push(poisonAction.targetId);
            }

            // Process vampire kills separately to assign correct cause
            let vampireKillResult: ReturnType<typeof killPlayer> = { updatedGame: game, triggeredHunterId: null, gameOver: false };
            if (vampireKilledPlayerIds.length > 0) {
                vampireKillResult = killPlayer(game, vampireKilledPlayerIds, 'vampire');
                game = vampireKillResult.updatedGame;
            }

            // Process all other kills
            const otherKillResult = killPlayer(game, allKilledPlayerIds, 'wolf');
            game = otherKillResult.updatedGame;

            const finalHunterId = vampireKillResult.triggeredHunterId || otherKillResult.triggeredHunterId;
            const isDrunkWin = vampireKillResult.gameOver || otherKillResult.gameOver;

            if (finalHunterId) game.pendingHunterShot = finalHunterId;

            if (isDrunkWin) {
                const drunkPlayer = game.players.find(p => p.role === 'drunk_man' && !p.isAlive);
                if (drunkPlayer) {
                    handleDrunkManWin(transaction, gameRef, game, drunkPlayer);
                    return;
                }
            }
            
            const nightEvent: GameEvent = {
                id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result',
                message: '', data: {}, createdAt: Timestamp.now(),
            };
            
            const newlyKilledPlayers = game.players.filter((p, i) => {
                 const oldPlayerState = initialPlayerState.find(ip => ip.userId === p.userId);
                 return !p.isAlive && (oldPlayerState?.isAlive ?? true);
            });

            const killedPlayerDetails = newlyKilledPlayers.map(p => `${p.displayName} (que era ${roleDetails[p.role!]?.name || 'un rol desconocido'})`);

            if (newlyKilledPlayers.length > 0) {
                nightEvent.message = `Anoche, el pueblo perdió a ${killedPlayerDetails.join(' y a ')}.`;
                if (fishermanDied) nightEvent.message += ` El Pescador eligió a un lobo y murió.`;
            } else if (game.leprosaBlockedRound === game.currentRound) {
                nightEvent.message = "Gracias a la Leprosa, los lobos no pudieron atacar esta noche. Nadie murió.";
            } else if (actions.some(a => ['werewolf_kill', 'hechicera_poison', 'vampire_bite', 'lookout_spy', 'fairy_kill'].includes(a.actionType))) {
                 nightEvent.message = "Se escuchó un grito en la noche, ¡pero alguien fue salvado en el último momento!";
            } else if(actions.filter(a => a.actionType === 'werewolf_kill').length > 0) {
                 nightEvent.message = "Los lobos no se pusieron de acuerdo en su víctima. Nadie murió por su ataque.";
            } else {
                 nightEvent.message = "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
            }

            if (resurrectAction) {
                const resurrectedPlayer = game.players.find(p => p.userId === resurrectAction.targetId);
                if (resurrectedPlayer) {
                    nightEvent.message += ` Pero un milagro ha ocurrido: ¡${resurrectedPlayer.displayName} ha vuelto a la vida!`;
                }
            }

            game.events.push(nightEvent);
            
            const { isGameOver, message, winnerCode, winners } = checkGameOver(game);
            if (isGameOver) {
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message, data: { winnerCode, winners }, createdAt: Timestamp.now() });
                transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
                return;
            }

            if (game.phase === 'hunter_shot') { 
                transaction.update(gameRef, {
                    players: game.players,
                    events: game.events,
                    phase: 'hunter_shot',
                    pendingHunterShot: game.pendingHunterShot,
                    wolfCubRevengeRound: game.wolfCubRevengeRound,
                });
                return;
            }

            game.players.forEach(p => p.votedFor = null);
            
            transaction.update(gameRef, {
                players: game.players,
                events: game.events,
                phase: 'day',
                chatMessages: [],
                wolfChatMessages: [],
                fairyChatMessages: [],
                twinChatMessages: [],
                pendingHunterShot: null,
                fairiesFound: game.fairiesFound,
                fairyKillUsed: game.fairyKillUsed,
                witchFoundSeer: game.witchFoundSeer,
                vampireKills: game.vampireKills || 0,
                seerDied: game.seerDied,
                boat: game.boat || [],
                leprosaBlockedRound: game.leprosaBlockedRound,
                wolfCubRevengeRound: game.wolfCubRevengeRound,
                nightActions: game.nightActions,
                silencedPlayerId: null,
                exiledPlayerId: null
            });
        });

        await triggerAIAwake(db, gameId, `Comienza el día ${gameId}.`);
        
        return { success: true };
    } catch (error: any) {
        console.error("Error processing night:", error);
         if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
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
      game.players.forEach(p => {
        p.bansheeScreams = p.bansheeScreams || {};
      });

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
            if (playerIndex > -1) game.players[playerIndex].princeRevealed = true;
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
          const { gameOver, updatedGame } = killPlayer(game, [lynchedPlayerId]);
          game = updatedGame; 
          if (gameOver) {
            const drunkPlayer = game.players.find(p => p.role === 'drunk_man' && !p.isAlive);
            if (drunkPlayer) {
              handleDrunkManWin(transaction, gameRef, game, drunkPlayer);
              return;
            }
          }
      }
      
      const { isGameOver, message, winnerCode, winners } = checkGameOver(game);
      if (isGameOver) {
          const gameOverEvent: GameEvent = {
              id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message, data: { winnerCode, winners }, createdAt: Timestamp.now(),
          };
          game.events.push(gameOverEvent);
          transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
          return;
      }

      if (game.phase === 'hunter_shot') {
        transaction.update(gameRef, {
          players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot, wolfCubRevengeRound: game.wolfCubRevengeRound,
        });
        return;
      }

      game.players.forEach(p => { p.votedFor = null; });

      transaction.update(gameRef, {
        players: game.players,
        events: game.events,
        phase: 'night',
        currentRound: increment(1),
        pendingHunterShot: null,
        silencedPlayerId: null, // Reset silenced player for the new night
        exiledPlayerId: null, // Reset exiled player for the new night
        wolfCubRevengeRound: game.wolfCubRevengeRound,
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error processing votes:", error);
    if (error.code === 'permission-denied') {
      const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
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
            
            game.events.push(shotEvent);
            
            const { gameOver, updatedGame } = killPlayer(game, [targetId]);
            game = updatedGame; // Use the updated state

            if (gameOver) {
                const drunkPlayer = game.players.find(p => p.role === 'drunk_man' && !p.isAlive);
                if (drunkPlayer) {
                  handleDrunkManWin(transaction, gameRef, game, drunkPlayer);
                  return;
                }
            }
            
            if (game.phase === 'hunter_shot' && game.pendingHunterShot !== hunterId) {
                // Another hunter was triggered by this shot, keep the phase
                transaction.update(gameRef, { 
                    players: game.players,
                    events: game.events,
                    phase: 'hunter_shot',
                    pendingHunterShot: game.pendingHunterShot,
                    wolfCubRevengeRound: game.wolfCubRevengeRound,
                });
                return;
            }

            const { isGameOver, message, winnerCode, winners } = checkGameOver(game);
            if (isGameOver) {
                const gameOverEvent: GameEvent = {
                    id: `evt_gameover_${Date.now()}`,
                    gameId,
                    round: game.currentRound,
                    type: 'game_over',
                    message,
                    data: { winnerCode, winners },
                    createdAt: Timestamp.now(),
                };
                game.events.push(gameOverEvent);
                transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events, wolfCubRevengeRound: game.wolfCubRevengeRound });
                return;
            }
            
            const hunterDeathEvent = [...game.events]
                .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
                .find(e => {
                    const killedId = e.data?.killedPlayerId || (e.data?.killedPlayerIds && e.data.killedPlayerIds[0]) || e.data?.lynchedPlayerId;
                    return killedId === hunterId;
                });

            const nextPhase = hunterDeathEvent?.type === 'vote_result' ? 'night' : 'day';
            const nextRound = nextPhase === 'night' ? game.currentRound + 1 : game.currentRound;

            game.players.forEach(p => { p.votedFor = null; });
            
            transaction.update(gameRef, {
                players: game.players,
                events: game.events,
                phase: nextPhase,
                currentRound: nextRound,
                pendingHunterShot: null,
                wolfCubRevengeRound: game.wolfCubRevengeRound,
            });
        });
        return { success: true };
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
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
    alivePlayers: Player[],
    deadPlayers: Player[],
): { actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE', targetId: string } => {
    const { role, userId } = aiPlayer;
    const { currentRound } = game;
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
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
            selectedTargets.push(availableTargets.splice(randomIndex, 1)[0].userId);
        }
        return selectedTargets.join('|');
    };

    if (game.exiledPlayerId === userId) {
        return { actionType: 'NONE', targetId: '' };
    }

    if (canFairiesKill) {
        const nonFairies = potentialTargets.filter(p => p.role !== 'seeker_fairy' && p.role !== 'sleeping_fairy');
        return { actionType: 'fairy_kill', targetId: randomTarget(nonFairies) };
    }

    switch (role) {
        case 'werewolf':
        case 'wolf_cub': {
            const nonWolves = potentialTargets.filter(p => {
                if (wolfRoles.includes(p.role)) return false;
                if (game.witchFoundSeer && p.role === 'witch') return false; // Don't attack allied witch
                return true;
            });
            const killCount = wolfCubRevengeActive ? 2 : 1;
            return { actionType: 'werewolf_kill', targetId: randomTarget(nonWolves, killCount) };
        }
        case 'seer':
        case 'seer_apprentice': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            if (role === 'seer' || apprenticeIsActive) {
                return { actionType: 'seer_check', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        }
        case 'doctor': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            return { actionType: 'doctor_heal', targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
        }
        case 'hunter': {
            if (game.phase === 'hunter_shot' && game.pendingHunterShot === userId) return { actionType: 'SHOOT', targetId: randomTarget(potentialTargets) };
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            return { actionType: 'NONE', targetId: '' };
        }
        case 'guardian': {
             if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
             if ((aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) return { actionType: 'guardian_protect', targetId: userId };
            return { actionType: 'guardian_protect', targetId: randomTarget(potentialTargets) };
        }
        case 'priest': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            if (!aiPlayer.priestSelfHealUsed && Math.random() < 0.2) return { actionType: 'priest_bless', targetId: userId };
            return { actionType: 'priest_bless', targetId: randomTarget(potentialTargets) };
        }
        case 'resurrector_angel': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            if (!aiPlayer.resurrectorAngelUsed && deadPlayers.length > 0) {
                 return { actionType: 'resurrect', targetId: randomTarget(deadPlayers, 1) };
            }
            return { actionType: 'NONE', targetId: '' };
        }
         case 'vampire': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            const biteableTargets = potentialTargets.filter(p => (p.biteCount || 0) < 3);
            return { actionType: 'vampire_bite', targetId: randomTarget(biteableTargets.length > 0 ? biteableTargets : potentialTargets) };
        }
        case 'cult_leader': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            const nonCultMembers = potentialTargets.filter(p => !p.isCultMember);
            return { actionType: 'cult_recruit', targetId: randomTarget(nonCultMembers) };
        }
        case 'fisherman': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            const nonBoatTargets = potentialTargets.filter(p => !game.boat?.includes(p.userId));
            return { actionType: 'fisherman_catch', targetId: randomTarget(nonBoatTargets) };
        }
        case 'silencer':
        case 'elder_leader': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
             return { actionType: role === 'silencer' ? 'silencer_silence' : 'elder_leader_exile', targetId: randomTarget(potentialTargets) };
        }
        case 'seeker_fairy': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            if (!game.fairiesFound) {
                 const sleepingFairy = alivePlayers.find(p => p.role === 'sleeping_fairy');
                 if (sleepingFairy && Math.random() < 0.25) { // 25% chance to find the fairy
                     return { actionType: 'fairy_find', targetId: sleepingFairy.userId };
                 }
                 return { actionType: 'fairy_find', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        }
        case 'witch': {
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            if (!game.witchFoundSeer) {
                return { actionType: 'witch_hunt', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        }
        default:
            if (game.phase === 'day') return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
            if (game.phase === 'hunter_shot' && game.pendingHunterShot === userId) return { actionType: 'SHOOT', targetId: randomTarget(potentialTargets) };
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
            if (phase === 'hunter_shot') return p.userId === game.pendingHunterShot;
            return p.isAlive;
        });

        const alivePlayers = game.players.filter(p => p.isAlive);
        const deadPlayers = game.players.filter(p => !p.isAlive);
        const nightActions = game.nightActions?.filter(a => a.round === game.currentRound) || [];

        for (const ai of aiPlayers) {
             const hasActed = phase === 'night' 
                ? nightActions.some(a => a.playerId === ai.userId)
                : ai.votedFor;
            
            if (hasActed && phase !== 'hunter_shot') continue;
            
            if (phase === 'hunter_shot' && ai.userId !== game.pendingHunterShot) continue;
            
            const { actionType, targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);

            if (!actionType || actionType === 'NONE' || !targetId) continue;

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
                case 'silencer_silence':
                case 'elder_leader_exile':
                case 'fairy_find':
                case 'fairy_kill':
                case 'witch_hunt':
                case 'banshee_scream':
                case 'resurrect':
                    await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType, targetId });
                    break;
                case 'VOTE':
                    if (phase === 'day') await submitVote(db, gameId, ai.userId, targetId);
                    break;

                case 'SHOOT':
                    if (phase === 'hunter_shot' && ai.userId === game.pendingHunterShot) await submitHunterShot(db, gameId, ai.userId, targetId);
                    break;
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

function sanitizeValue(value: any): any {
    if (value === undefined) return null;
    if (!value) return value;
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(v => sanitizeValue(v));
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

async function triggerAIChat(db: Firestore, gameId: string, triggerMessage: string, mentionedPlayerId?: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        const aiPlayersToTrigger = game.players.filter(p => 
            p.isAI && 
            p.isAlive &&
            (!mentionedPlayerId || p.userId === mentionedPlayerId)
        );

        for (const aiPlayer of aiPlayersToTrigger) {
            const perspective: AIPlayerPerspective = {
                game: sanitizeValue(game),
                aiPlayer: sanitizeValue(aiPlayer),
                trigger: triggerMessage,
                players: sanitizeValue(game.players),
            };

            generateAIChatMessage(perspective).then(async ({ message, shouldSend }) => {
                if (shouldSend && message) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 2500 + 1000));
                    await sendChatMessage(db, gameId, aiPlayer.userId, aiPlayer.displayName, message, true);
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
            
            if (game.players[playerIndex].votedFor) return;

            voterName = game.players[playerIndex].displayName;
            const targetPlayer = game.players.find(p => p.userId === targetId);
            if (!targetPlayer) throw new Error("Target player not found");
            targetName = targetPlayer.displayName;
            
            const siren = game.players.find(p => p.role === 'river_siren');
            const charmedPlayerId = siren?.riverSirenTargetId;

            // Check if voter is the charmed one
            if (voterId === charmedPlayerId && siren && siren.isAlive) {
                if (siren.votedFor) {
                    game.players[playerIndex].votedFor = siren.votedFor;
                } else {
                    throw new Error("Debes esperar a que la Sirena vote primero.");
                }
            } else {
                 game.players[playerIndex].votedFor = targetId;
            }
            
            transaction.update(gameRef, { players: game.players });
        });
        
        const finalGameSnap = await getDoc(gameRef);
        if (finalGameSnap.exists()) {
            const game = finalGameSnap.data() as Game;
            const alivePlayers = game.players.filter(p => p.isAlive);
            const allVotesIn = alivePlayers.every(p => p.votedFor);
            if (allVotesIn) {
                await processVotes(db, gameId);
            }
        }

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
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
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
    isFromAI: boolean = false
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

            if (game.silencedPlayerId === senderId) {
                throw new Error("No puedes hablar, has sido silenciado esta ronda.");
            }
            
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

        if (!isFromAI && latestGame) {
            const triggerMessage = `${senderName} dijo: "${text.trim()}"`;
            for (const p of latestGame.players) {
                if (p.isAI && p.isAlive && p.userId !== senderId && mentionedPlayerIds.includes(p.userId)) {
                    triggerAIChat(db, gameId, triggerMessage, p.userId);
                }
            }
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update', requestResourceData: { chatMessages: '...' } });
            errorEmitter.emit('permission-error', permissionError);
            return { error: 'Permiso denegado para enviar mensaje.' };
        }
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function sendWolfChatMessage(
    db: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string
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
            const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
            if (!sender || !wolfRoles.includes(sender.role)) {
                throw new Error("Solo la manada puede usar este chat.");
            }

            const messageData: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId,
                senderName,
                text: text.trim(),
                round: game.currentRound,
                createdAt: Timestamp.now(),
            };

            transaction.update(gameRef, {
                wolfChatMessages: arrayUnion(messageData)
            });
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error sending wolf chat message: ", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update', requestResourceData: { wolfChatMessages: '...' } });
            errorEmitter.emit('permission-error', permissionError);
            return { error: 'Permiso denegado para enviar mensaje.' };
        }
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function sendFairyChatMessage(
    db: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string
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
            const fairyRoles: PlayerRole[] = ['seeker_fairy', 'sleeping_fairy'];
            if (!sender || !fairyRoles.includes(sender.role) || !game.fairiesFound) {
                throw new Error("Solo las hadas unidas pueden usar este chat.");
            }

            const messageData: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId,
                senderName,
                text: text.trim(),
                round: game.currentRound,
                createdAt: Timestamp.now(),
            };

            transaction.update(gameRef, {
                fairyChatMessages: arrayUnion(messageData)
            });
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error sending fairy chat message: ", error);
        if ((error as any).code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update', requestResourceData: { fairyChatMessages: '...' } });
            errorEmitter.emit('permission-error', permissionError);
            return { error: 'Permiso denegado para enviar mensaje.' };
        }
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function sendTwinChatMessage(
    db: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string
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
            if (!sender || sender.role !== 'twin' || !game.twins?.includes(senderId)) {
                throw new Error("Solo las gemelas pueden usar este chat.");
            }

            const messageData: ChatMessage = {
                id: `${Date.now()}_${senderId}`,
                senderId,
                senderName,
                text: text.trim(),
                round: game.currentRound,
                createdAt: Timestamp.now(),
            };

            transaction.update(gameRef, {
                twinChatMessages: arrayUnion(messageData)
            });
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error sending twin chat message: ", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update', requestResourceData: { twinChatMessages: '...' } });
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
            if (!gameSnap.exists()) throw new Error("Partida no encontrada.");
            const game = gameSnap.data() as Game;

            const humanPlayers = game.players.filter(p => !p.isAI);

            const resetHumanPlayers = humanPlayers.map(player => ({
                ...createPlayerObject(player.userId, game.id, player.displayName, player.isAI),
                joinedAt: player.joinedAt, // Keep original join time
            }));

            transaction.update(gameRef, {
                status: 'waiting',
                phase: 'waiting',
                currentRound: 0,
                events: [],
                chatMessages: [],
                wolfChatMessages: [],
                fairyChatMessages: [],
                twinChatMessages: [],
                nightActions: [],
                twins: null,
                pendingHunterShot: null,
                wolfCubRevengeRound: 0,
                players: resetHumanPlayers, 
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

      if (game.phase === 'role_reveal') {
        transaction.update(gameRef, { 
            phase: 'night',
        });
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

            const ghostEvent: GameEvent = {
                id: `evt_ghost_${Date.now()}`,
                gameId,
                round: game.currentRound,
                type: 'special',
                message: `Has recibido un misterioso mensaje desde el más allá: "${message}"`,
                createdAt: Timestamp.now(),
                data: {
                    targetId: targetId, 
                    originalMessage: message,
                },
            };

            game.players[playerIndex].ghostMessageSent = true;
            game.events.push(ghostEvent);

            transaction.update(gameRef, {
                players: game.players,
                events: game.events,
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

export async function submitTroublemakerAction(
  db: Firestore,
  gameId: string,
  troublemakerId: string,
  target1Id: string,
  target2Id: string
) {
  const gameRef = doc(db, 'games', gameId);

  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists()) throw new Error("Partida no encontrada");
      let game = gameSnap.data() as Game;

      const player = game.players.find(p => p.userId === troublemakerId);
      if (!player || player.role !== 'troublemaker' || game.troublemakerUsed) {
        throw new Error("No puedes realizar esta acción.");
      }

      const target1 = game.players.find(p => p.userId === target1Id);
      const target2 = game.players.find(p => p.userId === target2Id);

      if (!target1 || !target2 || !target1.isAlive || !target2.isAlive) {
        throw new Error("Los objetivos seleccionados no son válidos.");
      }

      const event: GameEvent = {
        id: `evt_trouble_${Date.now()}`,
        gameId,
        round: game.currentRound,
        type: 'special',
        message: `${player.displayName} ha provocado una pelea mortal. ${target1.displayName} y ${target2.displayName} han sido eliminados.`,
        createdAt: Timestamp.now(),
        data: { eliminated: [target1Id, target2Id] }
      };
      game.events.push(event);

      const { gameOver, updatedGame } = killPlayer(game, [target1Id, target2Id]);
      game = updatedGame; // Use updated state

      if (gameOver) {
        const drunkPlayer = game.players.find(p => p.role === 'drunk_man' && !p.isAlive);
        if (drunkPlayer) {
          handleDrunkManWin(transaction, gameRef, game, drunkPlayer);
          return;
        }
      }
      
      const { isGameOver, message, winnerCode, winners } = checkGameOver(game);
      if (isGameOver) {
        const gameOverEvent: GameEvent = {
          id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message, data: { winnerCode, winners }, createdAt: Timestamp.now(),
        };
        game.events.push(gameOverEvent);
        transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events, troublemakerUsed: true });
        return;
      }

      transaction.update(gameRef, {
        players: game.players,
        events: game.events,
        troublemakerUsed: true,
      });
    });

    return { success: true };
  } catch (error: any) {
    if ((error as any).code === 'permission-denied') {
      const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
      errorEmitter.emit('permission-error', permissionError);
      return { error: 'Permiso denegado para usar esta habilidad.' };
    }
    console.error("Error submitting troublemaker action:", error);
    return { error: error.message || "No se pudo realizar la acción." };
  }
}
