
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
    usedNightAbility: false,
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
      
  const werewolfCount = Math.max(1, Math.floor(maxPlayers / 4));

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

    const numWerewolves = Math.max(1, Math.floor(playerCount / 4));
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
const MINIMUM_PLAYERS = 3;

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
            if (totalPlayers < MINIMUM_PLAYERS) {
                throw new Error(`Se necesitan al menos ${MINIMUM_PLAYERS} jugadores para comenzar.`);
            }

            // Server-side validation of roles
            const wolfCount = (Object.keys(game.settings) as (keyof typeof game.settings)[]).reduce((acc, role) => {
                const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy'];
                if (game.settings[role] === true && wolfRoles.includes(role)) {
                    return acc + 1;
                }
                return acc;
            }, game.settings.werewolves);

            if (wolfCount >= Math.floor(totalPlayers / 2)) {
                throw new Error('Configuración de roles inválida: demasiados lobos para el número de jugadores.');
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
    let shouldProcessNight = false;
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        
        let game = gameSnap.data() as Game;
        if (game.phase !== 'night' || game.status === 'finished') return;

        const player = game.players.find(p => p.userId === playerId);
        if (!player || !player.isAlive) throw new Error("Jugador no válido o muerto.");
        if (game.exiledPlayerId === playerId) throw new Error("Has sido exiliado esta noche y no puedes usar tu habilidad.");
        if (player.usedNightAbility) throw new Error("Ya has usado tu habilidad esta noche.");
        
        let players = [...game.players];
        const playerIndex = players.findIndex(p => p.userId === action.playerId);
        
        players[playerIndex].usedNightAbility = true;
        const newAction: NightAction = { ...action, createdAt: Timestamp.now() };
        const updatedNightActions = [...(game.nightActions || []), newAction];
        transaction.update(gameRef, { nightActions: updatedNightActions, players });

        const activeNightPlayers = players.filter(p => {
            if (!p.isAlive) return false;
            const nightRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'seer', 'seer_apprentice', 'doctor', 'hechicera', 'guardian', 'priest', 'vampire', 'cult_leader', 'fisherman', 'shapeshifter', 'virginia_woolf', 'river_siren', 'silencer', 'elder_leader', 'witch', 'banshee', 'lookout', 'seeker_fairy', 'resurrector_angel', 'cupid'];
            if (!p.role || !nightRoles.includes(p.role)) return false;
            if (p.role === 'seer_apprentice' && !game.seerDied) return false;
            if ((p.role === 'cupid' || p.role === 'shapeshifter' || p.role === 'virginia_woolf' || p.role === 'river_siren') && game.currentRound > 1) return false;
            if (p.role === 'executioner' || p.role === 'drunk_man' || p.role === 'sleeping_fairy') return false;
            return true;
        });

        const actedPlayerIds = new Set(updatedNightActions.map(a => a.playerId));
        
        if (activeNightPlayers.every(p => actedPlayerIds.has(p.userId))) {
            shouldProcessNight = true;
        }
    });

    if (shouldProcessNight) {
        await processNight(db, gameId);
    }

    return { success: true };

  } catch (error: any) {
    if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update', requestResourceData: { nightActions: '...' }});
        errorEmitter.emit('permission-error', permissionError);
        return { error: "Permiso denegado al realizar la acción nocturna." };
    }
    console.error("Error submitting night action: ", error);
    return { success: false, error: error.message || "No se pudo registrar tu acción." };
  }
}

async function killPlayer(transaction: Transaction, gameRef: DocumentReference, gameData: Game, playerIdToKill: string, cause: GameEvent['type']): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
    let newGameData = { ...gameData };
    let triggeredHunterId: string | null = null;
    
    const killQueue = [playerIdToKill];
    const alreadyProcessed = new Set<string>();

    while (killQueue.length > 0) {
        const currentIdToKill = killQueue.shift();
        if (!currentIdToKill || alreadyProcessed.has(currentIdToKill)) {
            continue;
        }

        const playerIndex = newGameData.players.findIndex(p => p.userId === currentIdToKill);
        if (playerIndex === -1 || !newGameData.players[playerIndex].isAlive) {
            continue;
        }
        
        alreadyProcessed.add(currentIdToKill);
        const playerToKill = { ...newGameData.players[playerIndex] };
        
        newGameData.players[playerIndex].isAlive = false;
        
        newGameData.events.push({
            id: `evt_${cause}_${Date.now()}_${currentIdToKill}`,
            gameId: newGameData.id!, round: newGameData.currentRound, type: cause,
            message: `${playerToKill.displayName} ha muerto. Su rol era: ${roleDetails[playerToKill.role!]?.name || 'Desconocido'}`,
            data: { killedPlayerIds: [currentIdToKill], revealedRole: playerToKill.role }, createdAt: Timestamp.now(),
        });
        
        if (playerToKill.role === 'seer') newGameData.seerDied = true;
        
        if (playerToKill.role === 'hunter' && newGameData.settings.hunter && !triggeredHunterId) {
            triggeredHunterId = playerToKill.userId;
        }
        
        if (playerToKill.role === 'wolf_cub' && newGameData.settings.wolf_cub) {
            newGameData.wolfCubRevengeRound = newGameData.currentRound + 1;
        }

        if (playerToKill.role === 'leprosa' && newGameData.settings.leprosa) {
            newGameData.leprosaBlockedRound = newGameData.currentRound + 1;
        }
        
        const shapeshifterIndex = newGameData.players.findIndex(p => p.isAlive && p.role === 'shapeshifter' && p.shapeshifterTargetId === playerToKill.userId);
        if (shapeshifterIndex !== -1 && playerToKill.role) {
            const shifter = newGameData.players[shapeshifterIndex];
            const newRole = playerToKill.role;
            newGameData.players[shapeshifterIndex].role = newRole;
            newGameData.players[shapeshifterIndex].shapeshifterTargetId = null; 
            newGameData.events.push({ id: `evt_transform_${Date.now()}_${shifter.userId}`, gameId: newGameData.id!, round: newGameData.currentRound, type: 'player_transformed', message: `¡Has cambiado de forma! Ahora eres: ${roleDetails[newRole]?.name || 'un rol desconocido'}.`, data: { targetId: shifter.userId, newRole }, createdAt: Timestamp.now() });
        }


        const checkAndQueueChainDeath = (linkedIds: (string[] | null | undefined), deadPlayer: Player, messageTemplate: string, eventType: GameEvent['type']) => {
            if (!linkedIds || !linkedIds.includes(deadPlayer.userId)) return;

            const otherId = linkedIds.find(id => id !== deadPlayer.userId);
            const otherPlayer = otherId ? newGameData.players.find(p => p.userId === otherId) : undefined;
            
            if (otherPlayer && otherPlayer.isAlive && !alreadyProcessed.has(otherId) && !killQueue.includes(otherId)) {
                killQueue.push(otherId);
                 newGameData.events.push({
                    id: `evt_chain_death_${Date.now()}_${otherId}`,
                    gameId: newGameData.id!, round: newGameData.currentRound, type: eventType,
                    message: messageTemplate.replace('{otherName}', otherPlayer.displayName).replace('{victimName}', deadPlayer.displayName),
                    data: { originalVictimId: deadPlayer.userId, killedPlayerIds: [otherId], revealedRole: otherPlayer.role }, createdAt: Timestamp.now(),
                });
            }
        };

        checkAndQueueChainDeath(newGameData.twins, playerToKill, 'Tras la muerte de {victimName}, su gemelo/a {otherName} muere de pena.', 'special');
        
        if (playerToKill.isLover) {
            const otherLoverId = newGameData.lovers?.find(id => id !== playerToKill.userId);
            if(otherLoverId) {
                 checkAndQueueChainDeath([playerToKill.userId, otherLoverId], playerToKill, 'Por un amor eterno, {otherName} se quita la vida tras la muerte de {victimName}.', 'lover_death');
            }
        }
        
        const virginiaLinker = newGameData.players.find(p => p.role === 'virginia_woolf' && p.userId === playerToKill.userId);
        if (virginiaLinker && virginiaLinker.virginiaWoolfTargetId) {
             const linkedPlayerId = virginiaLinker.virginiaWoolfTargetId;
             checkAndQueueChainDeath([virginiaLinker.userId, linkedPlayerId], playerToKill, 'Tras la muerte de {victimName}, {otherName} muere por un vínculo misterioso.', 'special');
        }
    }
    
    return { updatedGame: newGameData, triggeredHunterId };
}


function checkWinConditions(gameData: Game, lynchedPlayer?: Player): { isGameOver: boolean; message: string; winnerCode?: string; winners: string[] } {
    if (gameData.status === 'finished') {
        return { isGameOver: true, message: "La partida ya ha terminado.", winners: [] };
    }
    
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy']; 
    
    // PRIORIDAD 1: ¿Ganan los Amantes?
    if (gameData.lovers) {
        const aliveLovers = alivePlayers.filter(p => p.isLover);
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length >= 2) {
            return {
                isGameOver: true,
                winnerCode: 'lovers',
                message: '¡El amor ha triunfado! Los enamorados son los únicos supervivientes y ganan la partida.',
                winners: aliveLovers.map(l => l.userId),
            };
        }
    }

    // PRIORIDAD 2: ¿Gana un rol solitario?
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
     const aliveCultMembers = alivePlayers.filter(p => p.isCultMember);
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

    // PRIORIDAD 3: Lobos vs. Pueblo
    const aliveWerewolves = alivePlayers.filter(p => p.role && wolfRoles.includes(p.role));
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
            if (game.phase !== 'night' || game.status === 'finished') return;

            // --- SETUP & PRE-PROCESSING ---
            const initialPlayerState = JSON.parse(JSON.stringify(game.players));
            const actions = game.nightActions?.filter(a => a.round === game.currentRound) || [];
            
            // --- FASE 1: MANIPULACIÓN Y PROTECCIÓN ---
            const allProtectedIds = new Set<string>();
            actions.filter(a => ['doctor_heal', 'guardian_protect', 'priest_bless'].includes(a.actionType))
                   .forEach(a => allProtectedIds.add(a.targetId));

            // --- FASE 2: ASESINATOS Y ACCIONES OFENSIVAS ---
            let pendingDeaths: { targetId: string, cause: GameEvent['type'] }[] = [];
            let wolfTarget: string | null = null;
            
            if (game.leprosaBlockedRound !== game.currentRound) {
                const aliveWolves = game.players.filter(p => p.isAlive && (p.role === 'werewolf' || p.role === 'wolf_cub'));
                const wolfVotes = actions.filter(a => a.actionType === 'werewolf_kill').map(a => a.targetId);

                if (aliveWolves.length > 0 && wolfVotes.length >= aliveWolves.length) {
                    const voteCounts = wolfVotes.reduce((acc, vote) => {
                        vote.split('|').forEach(target => { if(target) acc[target] = (acc[target] || 0) + 1; });
                        return acc;
                    }, {} as Record<string, number>);
                    const maxVotes = Math.max(...Object.values(voteCounts), 0);
                    const mostVotedTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
                    if (mostVotedTargets.length === 1) wolfTarget = mostVotedTargets[0];
                }
                
                if (wolfTarget && !allProtectedIds.has(wolfTarget)) {
                    pendingDeaths.push({ targetId: wolfTarget, cause: 'werewolf_kill' });
                }
            }
            
            const hechiceraSaveAction = actions.find(a => a.actionType === 'hechicera_save');
            if (hechiceraSaveAction) {
                const index = pendingDeaths.findIndex(d => d.targetId === hechiceraSaveAction.targetId);
                if (index > -1) {
                    allProtectedIds.add(hechiceraSaveAction.targetId); 
                    pendingDeaths.splice(index, 1);
                }
            }

            const hechiceraPoisonAction = actions.find(a => a.actionType === 'hechicera_poison');
            if (hechiceraPoisonAction && !allProtectedIds.has(hechiceraPoisonAction.targetId)) {
                pendingDeaths.push({ targetId: hechiceraPoisonAction.targetId, cause: 'special' });
            }

            // --- FASE 3: RESOLUCIÓN FINAL ---
            for (const death of pendingDeaths) {
                const { updatedGame } = await killPlayer(transaction, gameRef, game, death.targetId, death.cause);
                game = updatedGame;
            }
            
            let gameOverInfo = checkGameOver(game);
            if (gameOverInfo.isGameOver) {
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
                transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
                return;
            }

            if (game.pendingHunterShot) {
                transaction.update(gameRef, { players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot });
                return;
            }
            
            const newlyKilledPlayers = game.players.filter(p => !p.isAlive && initialPlayerState.find(ip => ip.userId === p.userId)?.isAlive);
            let nightMessage;
            if (newlyKilledPlayers.length > 0) {
                const killedPlayerDetails = newlyKilledPlayers.map(p => `${p.displayName} (que era ${roleDetails[p.role!]?.name || 'un rol desconocido'})`);
                nightMessage = `Anoche, el pueblo perdió a ${killedPlayerDetails.join(' y a ')}.`;
            } else {
                 nightMessage = game.leprosaBlockedRound === game.currentRound + 1 ? "Gracias a la Leprosa, los lobos no pudieron atacar esta noche. Nadie murió." : "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
            }
            game.events.push({ id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: newlyKilledPlayers.map(p => p.userId), savedPlayerIds: Array.from(allProtectedIds) }, createdAt: Timestamp.now() });

            game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; });
            const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
            
            transaction.update(gameRef, {
                players: game.players, events: game.events, phase: 'day', phaseEndsAt,
                pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null,
            });
        });
        
        return { success: true };
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al procesar la noche." };
        }
        console.error("Error processing night:", error);
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

      if (game.phase !== 'day' || game.status === 'finished') return;
      
      const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === game.currentRound);
      const isTiebreaker = lastVoteEvent?.data?.tiedPlayerIds;

      const alivePlayers = game.players.filter(p => p.isAlive);
      const votablePlayers = isTiebreaker 
          ? alivePlayers.filter(p => isTiebreaker.includes(p.userId))
          : alivePlayers;

      const voteCounts: Record<string, number> = {};
      alivePlayers.forEach(player => {
        if (player.votedFor && (!isTiebreaker || isTiebreaker.includes(player.votedFor))) {
          voteCounts[player.votedFor] = (voteCounts[player.votedFor] || 0) + 1;
        }
      });
      
      let maxVotes = 0;
      let mostVotedPlayerIds: string[] = [];
      for (const playerId in voteCounts) {
        if (voteCounts[playerId] > maxVotes) {
          maxVotes = voteCounts[playerId];
          mostVotedPlayerIds = [playerId];
        } else if (voteCounts[playerId] === maxVotes && maxVotes > 0) {
          mostVotedPlayerIds.push(playerId);
        }
      }

      if (mostVotedPlayerIds.length > 1 && !isTiebreaker) {
          game.events.push({ id: `evt_vote_tie_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message: "¡La votación resultó en un empate! Se requiere una segunda votación solo entre los empatados.", data: { tiedPlayerIds: mostVotedPlayerIds, final: false }, createdAt: Timestamp.now() });
          game.players.forEach(p => { p.votedFor = null; });
          const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
          transaction.update(gameRef, { players: game.players, events: game.events, phaseEndsAt });
          return;
      }

      let lynchedPlayerId: string | null = mostVotedPlayerIds[0] || null;
      let lynchedPlayerObject: Player | undefined;

      if (lynchedPlayerId) {
        lynchedPlayerObject = game.players.find(p => p.userId === lynchedPlayerId);
        
        if (lynchedPlayerObject?.role === 'prince' && game.settings.prince && !lynchedPlayerObject.princeRevealed) {
            const playerIndex = game.players.findIndex(p => p.userId === lynchedPlayerId);
            if (playerIndex > -1) game.players[playerIndex].princeRevealed = true;
            game.events.push({
              id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result',
              message: `${lynchedPlayerObject.displayName} ha sido sentenciado, ¡pero revela su identidad como Príncipe y sobrevive!`,
              createdAt: Timestamp.now(), data: { lynchedPlayerId: null, final: true },
            });
            lynchedPlayerId = null; 
        } else {
            const { updatedGame } = await killPlayer(transaction, gameRef, game, lynchedPlayerId, 'vote_result');
            game = updatedGame;
        }
      } else {
        const message = isTiebreaker ? 'Tras un segundo empate, el pueblo decide perdonar una vida hoy.' : 'El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.';
        game.events.push({ id: `evt_vote_result_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message, data: { lynchedPlayerId: null, final: true }, createdAt: Timestamp.now() });
      }
      
      const gameOverInfo = checkWinConditions(game, lynchedPlayerObject);
      if (gameOverInfo.isGameOver) {
          game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
          transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
          return;
      }

      if (game.pendingHunterShot) {
        transaction.update(gameRef, { players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot });
        return;
      }

      game.players.forEach(p => { p.votedFor = null; });
      const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
      
      transaction.update(gameRef, {
        players: game.players, events: game.events, phase: 'night', phaseEndsAt,
        currentRound: increment(1), pendingHunterShot: null, silencedPlayerId: null,
        exiledPlayerId: null,
      });
    });

    return { success: true };
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
      errorEmitter.emit('permission-error', permissionError);
      return { error: "Permiso denegado al procesar la votación." };
    }
    console.error("Error processing votes:", error);
    return { error: `Hubo un problema al procesar la votación: ${error.message}` };
  }
}

// Omitted for brevity: getSeerResult, submitHunterShot, submitVote, sendChatMessage, sendSpecialChatMessages...

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
                newPlayer.joinedAt = player.joinedAt; 
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
                phaseEndsAt: Timestamp.now(),
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

    if (game.phase === 'role_reveal' && game.status === 'in_progress') {
        const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
        let updateData: Partial<Game> = { phase: 'night', phaseEndsAt };
        
        await runTransaction(db, async (transaction) => {
            const freshGameSnap = await transaction.get(gameRef);
            const freshGame = freshGameSnap.data() as Game;
            if (freshGame.status !== 'in_progress') return;

            const cupidAction = freshGame.nightActions?.find(a => a.round === 1 && a.actionType === 'cupid_love');
            if (freshGame.settings.cupid && freshGame.currentRound === 1 && cupidAction) {
                const loverIds = cupidAction.targetId.split('|') as [string, string];
                if (loverIds.length === 2) {
                    const playerUpdates = freshGame.players.map(p => {
                        if (loverIds.includes(p.userId)) return { ...p, isLover: true };
                        return p;
                    });
                    updateData.players = playerUpdates;
                    updateData.lovers = loverIds;
                }
            }
             transaction.update(gameRef, updateData);
        });
    }
    return { success: true };
  } catch (error) {
    console.error("Error setting phase to night:", error);
    return { success: false, error: (error as Error).message };
  }
}

// The rest of the functions (sendGhostMessage, submitTroublemakerAction, AI Logic) remain the same.
// ... (rest of the file is omitted for brevity but is unchanged)
// Omitted: sendGhostMessage, submitTroublemakerAction, all AI logic functions

