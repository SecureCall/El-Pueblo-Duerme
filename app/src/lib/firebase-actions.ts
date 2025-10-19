
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
import type { Game, Player, NightAction, GameEvent, PlayerRole, NightActionType, ChatMessage, AIPlayerPerspective } from "@/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { roleDetails } from "@/lib/roles";

const PHASE_DURATION_SECONDS = 45;

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
    potions: { poison: null, save: null },
    priestSelfHealUsed: false,
    princeRevealed: false,
    guardianSelfProtects: 0,
    biteCount: 0,
    isCultMember: false,
    isLover: false,
    shapeshifterTargetId: null,
    virginiaWoolfTargetId: null,
    riverSirenTargetId: null,
    ghostMessageSent: false,
    resurrectorAngelUsed: false,
    lookoutUsed: false,
    bansheeScreams: {},
    executionerTargetId: null,
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
      loversChatMessages: [],
      maxPlayers: maxPlayers,
      createdAt: Timestamp.now(),
      currentRound: 0,
      settings: {
          ...settings,
          werewolves: werewolfCount,
      },
      phaseEndsAt: null,
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
  };
  
  try {
    await setDoc(gameRef, gameData);
    
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
    const specialRoles: Exclude<NonNullable<PlayerRole>, 'villager' | 'werewolf' | 'cupid'>[] = Object.keys(settings)
        .filter(key => 
            key !== 'werewolves' && 
            key !== 'fillWithAI' && 
            key !== 'isPublic' && 
            key !== 'cupid' &&
            settings[key as keyof typeof settings] === true
        ) as any;
    
    if (settings.cupid && roles.length < playerCount) {
        roles.push('cupid');
    }

    const numWerewolves = Math.max(1, Math.floor(playerCount / 5));
    for (let i = 0; i < numWerewolves; i++) {
        if(roles.length < playerCount) roles.push('werewolf');
    }

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
    const hasWolfRole = roles.some(r => r && wolfRoles.includes(r));
    
    if (!hasWolfRole && playerCount > 0) {
        const villagerIndex = roles.indexOf('villager');
        if (villagerIndex !== -1) {
            roles[villagerIndex] = 'werewolf';
        } else if (roles.length > 0) {
            roles[roles.length - 1] = 'werewolf';
        } else { 
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
            
            let assignedPlayers = finalPlayers.map((player, index) => {
                const p = { ...player, role: newRoles[index] };
                if (p.role === 'cult_leader') {
                    p.isCultMember = true;
                }
                return p;
            });

            const executioner = assignedPlayers.find(p => p.role === 'executioner');
            if (executioner) {
                const nonWolfPlayers = assignedPlayers.filter(p => {
                    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy'];
                    return p.role && !wolfRoles.includes(p.role) && p.userId !== executioner.userId;
                });
                if (nonWolfPlayers.length > 0) {
                    const target = nonWolfPlayers[Math.floor(Math.random() * nonWolfPlayers.length)];
                    const executionerIndex = assignedPlayers.findIndex(p => p.userId === executioner.userId);
                    if (executionerIndex > -1) {
                        assignedPlayers[executionerIndex].executionerTargetId = target.userId;
                    }
                }
            }

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

function killPlayer(
    gameData: Game,
    playerIdsToKill: string[],
    cause: GameEvent['type']
): { updatedGame: Game; triggeredHunterId: string | null; } {
    let triggeredHunterId: string | null = null;
    
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
        
        gameData.players[playerIndex].isAlive = false;
        
        gameData.events.push({
            id: `evt_${cause}_${Date.now()}_${playerIdToKill}`,
            gameId: gameData.id!,
            round: gameData.currentRound,
            type: cause,
            message: `${playerToKill.displayName} ha muerto.`,
            data: { killedPlayerIds: [playerIdToKill] },
            createdAt: Timestamp.now(),
        });
        
        if (playerToKill.role === 'seer') gameData.seerDied = true;
        
        if (playerToKill.role === 'hunter' && gameData.settings.hunter && !triggeredHunterId) {
            triggeredHunterId = playerToKill.userId;
            gameData.phase = 'hunter_shot'; // Set phase only when hunter dies
        }
        
        if (playerToKill.role === 'wolf_cub' && gameData.settings.wolf_cub) {
            gameData.wolfCubRevengeRound = gameData.currentRound + 1;
        }
        if (playerToKill.role === 'leprosa' && gameData.settings.leprosa) {
            gameData.leprosaBlockedRound = gameData.currentRound + 1;
        }

        const checkAndQueueChainDeath = (linkedIds: (string[] | null | undefined), deadPlayer: Player, messageTemplate: string, eventType: GameEvent['type']) => {
            if (!linkedIds || !linkedIds.includes(deadPlayer.userId)) return;

            const otherId = linkedIds.find(id => id !== deadPlayer.userId);
            const otherPlayer = otherId ? gameData.players.find(p => p.userId === otherId) : undefined;
            
            if (otherPlayer && otherPlayer.isAlive && !alreadyProcessed.has(otherId) && !killQueue.includes(otherId)) {
                killQueue.push(otherId);
                gameData.events.push({
                    id: `evt_chain_death_${Date.now()}_${otherId}`,
                    gameId: gameData.id!,
                    round: gameData.currentRound,
                    type: eventType,
                    message: messageTemplate.replace('{otherName}', otherPlayer.displayName).replace('{victimName}', deadPlayer.displayName),
                    data: { originalVictimId: deadPlayer.userId, killedPlayerIds: [otherId] },
                    createdAt: Timestamp.now(),
                });
            }
        };

        checkAndQueueChainDeath(gameData.twins, playerToKill, 'Tras la muerte de {victimName}, su gemelo/a {otherName} muere de pena.', 'special');
        
        if (playerToKill.isLover) {
            const otherLover = gameData.players.find(p => p.isLover && p.userId !== playerToKill.userId);
            if (otherLover) {
                 checkAndQueueChainDeath([playerToKill.userId, otherLover.userId], playerToKill, 'Por un amor eterno, {otherName} se quita la vida tras la muerte de {victimName}.', 'lover_death');
            }
        }
        
        const virginiaLinker = gameData.players.find(p => p.role === 'virginia_woolf' && p.userId === playerToKill.userId);
        if (virginiaLinker && virginiaLinker.virginiaWoolfTargetId) {
             const linkedPlayerId = virginiaLinker.virginiaWoolfTargetId;
             checkAndQueueChainDeath([virginiaLinker.userId, linkedPlayerId], playerToKill, 'Tras la muerte de {victimName}, {otherName} muere por un vínculo misterioso.', 'special');
        }
    }
    
    if (triggeredHunterId) {
        gameData.pendingHunterShot = triggeredHunterId;
    }

    return { updatedGame: gameData, triggeredHunterId: triggeredHunterId };
}


function checkGameOver(gameData: Game, lynchedPlayer?: Player): { isGameOver: boolean; message: string; winnerCode?: string; winners: string[] } {
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy']; 
    
    if (lynchedPlayer?.role === 'drunk_man' && gameData.settings.drunk_man) {
        const voters = gameData.players.filter(p => p.votedFor === lynchedPlayer.userId);
        const wolfVoter = voters.some(v => v.role && wolfRoles.includes(v.role));
        const villagerVoter = voters.some(v => v.role && !wolfRoles.includes(v.role));

        if (wolfVoter && villagerVoter) {
            return {
                isGameOver: true,
                winnerCode: 'drunk_man',
                message: '¡El Hombre Ebrio ha ganado! Ha conseguido que tanto lobos como aldeanos lo linchen, cumpliendo su caótico objetivo.',
                winners: [lynchedPlayer.userId],
            };
        }
    }
    
    if (lynchedPlayer && gameData.settings.executioner) {
        const executioner = gameData.players.find(p => p.role === 'executioner' && p.isAlive);
        if (executioner && executioner.executionerTargetId === lynchedPlayer.userId) {
             return {
                isGameOver: true,
                winnerCode: 'executioner',
                message: `¡El Verdugo ha ganado! Ha logrado su objetivo de que el pueblo linche a ${lynchedPlayer.displayName}.`,
                winners: [executioner.userId],
            };
        }
    }

    if (gameData.lovers) {
        const aliveLovers = alivePlayers.filter(p => p.isLover);
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length > 0) {
            return {
                isGameOver: true,
                winnerCode: 'lovers',
                message: '¡El amor ha triunfado! Los enamorados son los únicos supervivientes y ganan la partida.',
                winners: aliveLovers.map(l => l.userId),
            };
        }
    }

    const aliveWerewolves = alivePlayers.filter(p => p.role && wolfRoles.includes(p.role));
    const aliveCultMembers = alivePlayers.filter(p => p.isCultMember);

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
        const aliveVillagers = alivePlayers.filter(p => p.role && !wolfRoles.includes(p.role) && p.role !== 'vampire');
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

    const nonWolves = alivePlayers.filter(p => p.role && !wolfRoles.includes(p.role));
    if (aliveWerewolves.length > 0 && aliveWerewolves.length >= nonWolves.length) {
        return {
            isGameOver: true,
            winnerCode: 'wolves',
            message: "¡Los hombres lobo han ganado! Superan en número a los aldeanos y la oscuridad consume el pueblo.",
            winners: aliveWerewolves.map(p => p.userId)
        };
    }
    
    const threats = alivePlayers.filter(p => (p.role && wolfRoles.includes(p.role)) || p.role === 'vampire' || (p.role === 'sleeping_fairy' && gameData.fairiesFound));
    if (threats.length === 0 && alivePlayers.length > 0) {
        const villageWinners = alivePlayers.filter(p => !p.isCultMember && p.role !== 'sleeping_fairy' && p.role !== 'executioner'); 
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
                console.log(`Skipping night process, phase is '${game.phase}'.`);
                return;
            }

            // First round special actions (Cupid)
            if (game.currentRound === 1 && game.settings.cupid) {
                const cupidAction = game.nightActions?.find(a => a.round === 1 && a.actionType === 'cupid_love');
                if (cupidAction) {
                    const loverIds = cupidAction.targetId.split('|') as [string, string];
                    if (loverIds.length === 2) {
                        game.players.forEach(p => {
                            if (loverIds.includes(p.userId)) {
                                p.isLover = true;
                            }
                        });
                        game.lovers = loverIds;
                    }
                }
            }
            
            game.nightActions = game.nightActions || [];
            game.events = game.events || [];
            game.players.forEach(p => {
                p.bansheeScreams = p.bansheeScreams || {};
                p.potions = p.potions || { poison: null, save: null };
                p.biteCount = p.biteCount || 0;
            });

            const resurrectAction = game.nightActions?.find(a => a.round === game.currentRound && a.actionType === 'resurrect');
            let resurrectedPlayerName: string | null = null;
            if (resurrectAction) {
                const targetIndex = game.players.findIndex(p => p.userId === resurrectAction.targetId);
                if (targetIndex > -1 && !game.players[targetIndex].isAlive) {
                    game.players[targetIndex].isAlive = true;
                    resurrectedPlayerName = game.players[targetIndex].displayName;
                }
            }

            const initialPlayerState = JSON.parse(JSON.stringify(game.players));
            const actions = game.nightActions.filter(a => a.round === game.currentRound);
            
            const savedByDoctorId = actions.find(a => a.actionType === 'doctor_heal')?.targetId || null;
            const savedByHechiceraId = actions.find(a => a.actionType === 'hechicera_save')?.targetId || null;
            const savedByGuardianId = actions.find(a => a.actionType === 'guardian_protect')?.targetId || null;
            const savedByPriestId = actions.find(a => a.actionType === 'priest_bless')?.targetId || null;
            const allProtectedIds = new Set([savedByDoctorId, savedByHechiceraId, savedByGuardianId, savedByPriestId].filter(Boolean) as string[]);
            
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
            
            let allKilledPlayerIds: string[] = [];
            let deathCauses: { [key: string]: GameEvent['type'] } = {};
            let fishermanDied = false;

            const lookoutAction = actions.find(a => a.actionType === 'lookout_spy');
            if (lookoutAction) {
                if (Math.random() >= 0.4) {
                    allKilledPlayerIds.push(lookoutAction.playerId);
                    deathCauses[lookoutAction.playerId] = 'werewolf_kill'; 
                }
            }

            const vampireAction = actions.find(a => a.actionType === 'vampire_bite');
            if (vampireAction?.targetId) {
                const targetIndex = game.players.findIndex(p => p.userId === vampireAction.targetId);
                if (targetIndex > -1) {
                    game.players[targetIndex].biteCount = (game.players[targetIndex].biteCount || 0) + 1;
                    if (game.players[targetIndex].biteCount >= 3) {
                        allKilledPlayerIds.push(vampireAction.targetId);
                        deathCauses[vampireAction.targetId] = 'vampire_kill';
                        game.vampireKills = (game.vampireKills || 0) + 1;
                    }
                }
            }

            const fishermanAction = actions.find(a => a.actionType === 'fisherman_catch');
            if (fishermanAction?.targetId) {
                const targetPlayer = game.players.find(p => p.userId === fishermanAction.targetId);
                const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
                if (targetPlayer && targetPlayer.role && wolfRoles.includes(targetPlayer.role)) {
                    allKilledPlayerIds.push(fishermanAction.playerId);
                    deathCauses[fishermanAction.playerId] = 'special';
                    fishermanDied = true;
                } else if (targetPlayer && !game.boat?.includes(targetPlayer.userId)) {
                    game.boat.push(targetPlayer.userId);
                }
            }

            const poisonAction = actions.find(a => a.actionType === 'hechicera_poison');
            if (poisonAction?.targetId) {
                allKilledPlayerIds.push(poisonAction.targetId);
                deathCauses[poisonAction.targetId] = 'special';
            }

            if (game.leprosaBlockedRound !== game.currentRound) {
                const wolfKillActions = actions.filter(a => a.actionType === 'werewolf_kill');
                if (wolfKillActions.length > 0) {
                     const killCount = (game.wolfCubRevengeRound === game.currentRound) ? 2 : 1;
                     const targets = new Set<string>();
                     wolfKillActions.forEach(action => action.targetId.split('|').forEach(id => { if (id) targets.add(id); }));

                     const targetsToKill = Array.from(targets).slice(0, killCount);
                     targetsToKill.forEach(id => {
                        allKilledPlayerIds.push(id);
                        deathCauses[id] = 'werewolf_kill';
                     });
                }
                const fairyKillAction = actions.find(a => a.actionType === 'fairy_kill');
                if (fairyKillAction) {
                    const targetId = fairyKillAction.targetId;
                     allKilledPlayerIds.push(targetId);
                     deathCauses[targetId] = 'special';
                     game.fairyKillUsed = true;
                }
            }
            
            for (const killedId of allKilledPlayerIds) {
                 if (!allProtectedIds.has(killedId)) {
                    const { updatedGame, triggeredHunterId } = killPlayer(game, [killedId], deathCauses[killedId] || 'special');
                    game = updatedGame;
                    if (triggeredHunterId) game.pendingHunterShot = triggeredHunterId;
                 }
            }
            
            let gameOverInfo = checkGameOver(game);
            if (gameOverInfo.isGameOver) {
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
                transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
                return;
            }

            const newlyKilledPlayers = game.players.filter(p => !p.isAlive && initialPlayerState.find(ip => ip.userId === p.userId)?.isAlive);
            const killedPlayerDetails = newlyKilledPlayers.map(p => `${p.displayName} (que era ${roleDetails[p.role!]?.name || 'un rol desconocido'})`);

            let nightMessage = "";
            if (newlyKilledPlayers.length > 0) {
                nightMessage = `Anoche, el pueblo perdió a ${killedPlayerDetails.join(' y a ')}.`;
                if (fishermanDied) nightMessage += ` El Pescador eligió a un lobo y murió.`;
            } else if (game.leprosaBlockedRound === game.currentRound + 1) {
                nightMessage = "Gracias a la Leprosa, los lobos no pudieron atacar esta noche. Nadie murió.";
            } else if (allKilledPlayerIds.length > 0) {
                nightMessage = "Se escuchó un grito en la noche, ¡pero alguien fue salvado en el último momento!";
            } else {
                nightMessage = "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
            }
             if (resurrectedPlayerName) {
                 const resurrectedPlayer = game.players.find(p => p.displayName === resurrectedPlayerName);
                 if(resurrectedPlayer && resurrectedPlayer.isAlive) {
                    nightMessage += ` Pero un milagro ha ocurrido: ¡${resurrectedPlayerName} ha vuelto a la vida!`;
                 }
            }

            game.events.push({
                id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result',
                message: nightMessage, 
                data: { killedPlayerIds: newlyKilledPlayers.map(p => p.userId), savedPlayerIds: Array.from(allProtectedIds) }, 
                createdAt: Timestamp.now(),
            });

            if (game.phase === 'hunter_shot') { 
                transaction.update(gameRef, {
                    players: game.players,
                    events: game.events,
                    phase: 'hunter_shot',
                    pendingHunterShot: game.pendingHunterShot,
                    wolfCubRevengeRound: game.wolfCubRevengeRound || 0,
                });
                return;
            }

            game.players.forEach(p => p.votedFor = null);
            const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
            
            transaction.update(gameRef, {
                players: game.players,
                events: game.events,
                phase: 'day',
                phaseEndsAt,
                chatMessages: game.chatMessages || [],
                wolfChatMessages: game.wolfChatMessages || [],
                fairyChatMessages: game.fairyChatMessages || [],
                twinChatMessages: game.twinChatMessages || [],
                loversChatMessages: game.loversChatMessages || [],
                pendingHunterShot: null,
                fairiesFound: game.fairiesFound,
                fairyKillUsed: game.fairyKillUsed,
                witchFoundSeer: game.witchFoundSeer,
                vampireKills: game.vampireKills || 0,
                seerDied: game.seerDied,
                boat: game.boat || [],
                leprosaBlockedRound: game.leprosaBlockedRound || 0,
                wolfCubRevengeRound: game.wolfCubRevengeRound || 0,
                nightActions: game.nightActions,
                silencedPlayerId: null,
                exiledPlayerId: null
            });
        });
        
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
        return;
      }
      
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
      let lynchedPlayerObject: Player | undefined;

      if (mostVotedPlayerIds.length === 1 && maxVotes > 0) {
        const potentialLynchedId = mostVotedPlayerIds[0];
        lynchedPlayerObject = game.players.find(p => p.userId === potentialLynchedId);
        
        if (lynchedPlayerObject?.role === 'prince' && game.settings.prince && !lynchedPlayerObject.princeRevealed) {
            const playerIndex = game.players.findIndex(p => p.userId === potentialLynchedId);
            if (playerIndex > -1) game.players[playerIndex].princeRevealed = true;
            game.events.push({
              id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result',
              message: `${lynchedPlayerObject.displayName} ha sido sentenciado, ¡pero revela su identidad como Príncipe y sobrevive!`,
              createdAt: Timestamp.now(), data: { lynchedPlayerId: null },
            });
        } else {
            lynchedPlayerId = potentialLynchedId;
        }
      }
      
      if (lynchedPlayerId) {
          const { updatedGame } = killPlayer(game, [lynchedPlayerId], 'vote_result');
          game = updatedGame; 
          
          const killedPlayer = game.players.find(p => !p.isAlive && p.userId === lynchedPlayerId);
          if (killedPlayer && !game.events.some(e => e.round === game.currentRound && e.type === 'vote_result' && e.data?.killedPlayerIds?.includes(lynchedPlayerId))) {
             game.events.push({
                id: `evt_vote_result_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result',
                message: `${killedPlayer.displayName} fue linchado por el pueblo. Su rol era: ${roleDetails[killedPlayer.role!]?.name || 'desconocido'}.`,
                data: { killedPlayerIds: [lynchedPlayerId], lynchedPlayerId: lynchedPlayerId }, createdAt: Timestamp.now(),
            });
          }
      } else if (!game.events.some(e => e.round === game.currentRound && e.type === 'vote_result')) {
        const eventMessage = mostVotedPlayerIds.length > 1 ? "La votación resultó en un empate. Nadie fue linchado hoy." : "El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.";
        game.events.push({ id: `evt_vote_result_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message: eventMessage, data: { lynchedPlayerId: null }, createdAt: Timestamp.now() });
      }
      
      const gameOverInfo = checkGameOver(game, lynchedPlayerObject);
      if (gameOverInfo.isGameOver) {
          game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
          transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
          return;
      }

      if (game.phase === 'hunter_shot') {
        transaction.update(gameRef, {
          players: game.players, 
          events: game.events, 
          phase: 'hunter_shot', 
          pendingHunterShot: game.pendingHunterShot, 
          wolfCubRevengeRound: game.wolfCubRevengeRound || 0,
        });
        return;
      }

      game.players.forEach(p => { p.votedFor = null; });
      const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
      
      transaction.update(gameRef, {
        players: game.players,
        events: game.events,
        phase: 'night',
        phaseEndsAt,
        currentRound: increment(1),
        pendingHunterShot: null,
        silencedPlayerId: null,
        exiledPlayerId: null,
        wolfCubRevengeRound: game.wolfCubRevengeRound || 0,
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
    const isWerewolf = (targetPlayer.role && wolfRoles.includes(targetPlayer.role)) || (targetPlayer.role === 'lycanthrope' && game.settings.lycanthrope);

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
            
            const { updatedGame } = killPlayer(game, [targetId], 'hunter_shot');
            game = updatedGame;
            
            game.events.push({
                id: `evt_huntershot_${Date.now()}`,
                gameId,
                round: game.currentRound,
                type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
                createdAt: Timestamp.now(),
                data: {killedPlayerIds: [targetId]},
            });
            
            if (game.phase === 'hunter_shot' && game.pendingHunterShot !== hunterId) {
                transaction.update(gameRef, { 
                    players: game.players,
                    events: game.events,
                    phase: 'hunter_shot',
                    pendingHunterShot: game.pendingHunterShot,
                    wolfCubRevengeRound: game.wolfCubRevengeRound || 0,
                });
                return;
            }

            const gameOverInfo = checkGameOver(game);
            if (gameOverInfo.isGameOver) {
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
                transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events, wolfCubRevengeRound: game.wolfCubRevengeRound || 0 });
                return;
            }
            
            const hunterDeathEvent = [...game.events]
                .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
                .find(e => {
                    const eventData = e.data || {};
                    const killedIds = eventData.killedPlayerIds || [];
                    if (killedIds.includes(hunterId)) return true;
                    if(eventData.lynchedPlayerId === hunterId) return true;
                    return false;
                });
            
            const nextPhase = hunterDeathEvent?.type === 'vote_result' ? 'night' : 'day';
            const nextRound = nextPhase === 'night' ? game.currentRound + 1 : game.currentRound;

            game.players.forEach(p => { p.votedFor = null; });
            const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
            
            transaction.update(gameRef, {
                players: game.players,
                events: game.events,
                phase: nextPhase,
                phaseEndsAt,
                currentRound: nextRound,
                pendingHunterShot: null,
                wolfCubRevengeRound: game.wolfCubRevengeRound || 0,
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

export async function submitVote(db: Firestore, gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId);
    let voterName: string | undefined;
    let targetName: string | undefined;
    let isFromAI = false;
    
    try {
       await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            
            let game = gameSnap.data() as Game;
            if (game.phase !== 'day') return;
            
            const playerIndex = game.players.findIndex(p => p.userId === voterId && p.isAlive);
            if (playerIndex === -1) throw new Error("Player not found or is not alive");
            
            if (game.players[playerIndex].votedFor) return;

            const voter = game.players[playerIndex];
            voterName = voter.displayName;
            isFromAI = voter.isAI;

            const targetPlayer = game.players.find(p => p.userId === targetId);
            if (!targetPlayer) throw new Error("Target player not found");
            targetName = targetPlayer.displayName;
            
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
            
            transaction.update(gameRef, { players: game.players });
        });
        
        const finalGameSnap = await getDoc(gameRef);
        if (finalGameSnap.exists()) {
             const game = finalGameSnap.data() as Game;
            const alivePlayers = game.players.filter(p => p.isAlive);
            if (alivePlayers.every(p => p.votedFor)) {
                await processVotes(db, gameId);
            }
        }

        if (voterName && targetName && !isFromAI) {
            await triggerAIChat(db, gameId, `${voterName} ha votado por ${targetName}.`);
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
            triggerAIChat(db, gameId, triggerMessage);
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

async function sendSpecialChatMessage(
    db: Firestore,
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    chatType: 'wolf' | 'fairy' | 'lovers' | 'twin'
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
            const fairyRoles: PlayerRole[] = ['seeker_fairy', 'sleeping_fairy'];

            let canSend = false;
            let chatField: keyof Game = 'chatMessages';

            switch (chatType) {
                case 'wolf':
                    if (sender && sender.role && wolfRoles.includes(sender.role)) {
                        canSend = true;
                        chatField = 'wolfChatMessages';
                    }
                    break;
                case 'fairy':
                    if (sender && sender.role && fairyRoles.includes(sender.role) && game.fairiesFound) {
                        canSend = true;
                        chatField = 'fairyChatMessages';
                    }
                    break;
                case 'lovers':
                    if (sender && sender.isLover) {
                        canSend = true;
                        chatField = 'loversChatMessages';
                    }
                    break;
                 case 'twin':
                    if (sender && sender.role === 'twin') {
                        canSend = true;
                        chatField = 'twinChatMessages';
                    }
                    break;
            }

            if (!canSend) {
                throw new Error("No tienes permiso para enviar mensajes en este chat.");
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
                [chatField]: arrayUnion(messageData)
            });
        });

        return { success: true };

    } catch (error: any) {
        console.error(`Error sending ${chatType} chat message: `, error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
            return { error: 'Permiso denegado para enviar mensaje.' };
        }
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export const sendWolfChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'wolf');
export const sendFairyChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'fairy');
export const sendLoversChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'lovers');
export const sendTwinChatMessage = (db: Firestore, gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(db, gameId, senderId, senderName, text, 'twin');


export async function resetGame(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada.");
            const game = gameSnap.data() as Game;

            const humanPlayers = game.players.filter(p => !p.isAI);

            const resetHumanPlayers = humanPlayers.map(player => {
                const newPlayer = createPlayerObject(player.userId, game.id, player.displayName, player.isAI);
                newPlayer.joinedAt = player.joinedAt; // Preserve join order
                return newPlayer;
            });

            transaction.update(gameRef, {
                status: 'waiting',
                phase: 'waiting',
                currentRound: 0,
                events: [],
                chatMessages: [],
                wolfChatMessages: [],
                fairyChatMessages: [],
                twinChatMessages: [],
                loversChatMessages: [],
                nightActions: [],
                twins: null,
                lovers: null,
                phaseEndsAt: null,
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

export async function setPhaseToNight(db: Firestore, gameId: string) {
  const gameRef = doc(db, "games", gameId);
  try {
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) throw new Error("Game not found");
    const game = gameSnap.data() as Game;

    if (game.phase === 'role_reveal') {
        const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
        let updateData: Partial<Game> = { phase: 'night', phaseEndsAt };
        
        if (game.settings.cupid && game.currentRound === 1) {
            const cupidAction = game.nightActions?.find(a => a.round === 1 && a.actionType === 'cupid_love');
            if (cupidAction) {
                const loverIds = cupidAction.targetId.split('|') as [string, string];
                if (loverIds.length === 2) {
                    const playerUpdates = game.players.map(p => {
                        if (loverIds.includes(p.userId)) {
                            return { ...p, isLover: true };
                        }
                        return p;
                    });
                    updateData.players = playerUpdates;
                    updateData.lovers = loverIds;
                }
            }
        }
        await updateDoc(gameRef, updateData);
    }
    return { success: true };
  } catch (error) {
    console.error("Error setting phase to night:", error);
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
      
      const { updatedGame } = killPlayer(game, [target1Id, target2Id], 'troublemaker_duel');
      game = updatedGame;

      game.events.push({
        id: `evt_trouble_${Date.now()}`,
        gameId,
        round: game.currentRound,
        type: 'special',
        message: `${player.displayName} ha provocado una pelea mortal. ${target1.displayName} y ${target2.displayName} han sido eliminados.`,
        createdAt: Timestamp.now(),
        data: { killedPlayerIds: [target1Id, target2Id] }
      });

      const gameOverInfo = checkGameOver(game);
      if (gameOverInfo.isGameOver) {
        game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
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

async function triggerAIChat(db: Firestore, gameId: string, triggerMessage: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        const aiPlayersToTrigger = game.players.filter(p => p.isAI && p.isAlive);

        for (const aiPlayer of aiPlayersToTrigger) {
             if (Math.random() < 0.35) { // % chance to speak
                const perspective: AIPlayerPerspective = {
                    game: sanitizeValue(game),
                    aiPlayer: sanitizeValue(aiPlayer),
                    trigger: triggerMessage,
                    players: sanitizeValue(game.players),
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


export async function triggerAIVote(db: Firestore, gameId: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        const aiPlayersToVote = game.players.filter(p => p.isAI && p.isAlive && !p.votedFor);
        const alivePlayers = game.players.filter(p => p.isAlive);
        const deadPlayers = game.players.filter(p => !p.isAlive);

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
