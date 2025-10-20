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
      if (playerExists) {
        const currentPlayers = game.players;
        const playerIndex = currentPlayers.findIndex(p => p.userId === userId);
        if (playerIndex !== -1 && currentPlayers[playerIndex].displayName !== displayName.trim()) {
            currentPlayers[playerIndex].displayName = displayName.trim();
            transaction.update(gameRef, { players: currentPlayers });
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
      
      const newPlayer = createPlayerObject(userId, gameId, displayName, false);
      transaction.update(gameRef, {
        players: arrayUnion(newPlayer),
      });
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
    let baseRoles: PlayerRole[] = [];
    const numWerewolves = Math.max(1, Math.floor(playerCount / 4));
    
    for (let i = 0; i < numWerewolves; i++) {
        baseRoles.push('werewolf');
    }
    
    while (baseRoles.length < playerCount) {
        baseRoles.push('villager');
    }

    const availableSpecialRoles: PlayerRole[] = (Object.keys(settings) as Array<keyof typeof settings>)
        .filter(key => {
            const roleKey = key as PlayerRole;
            return settings[key] === true && roleKey !== 'werewolves' && roleKey !== 'fillWithAI' && roleKey !== 'isPublic';
        })
        .sort(() => Math.random() - 0.5) as PlayerRole[];

    let finalRoles = [...baseRoles];
    let villagerIndices = finalRoles.map((role, index) => role === 'villager' ? index : -1).filter(index => index !== -1);

    for (const specialRole of availableSpecialRoles) {
        if (!specialRole) continue;

        if (specialRole === 'twin') {
            if (villagerIndices.length >= 2) {
                const idx1 = villagerIndices.pop()!;
                const idx2 = villagerIndices.pop()!;
                finalRoles[idx1] = 'twin';
                finalRoles[idx2] = 'twin';
            }
        } else {
            if (villagerIndices.length > 0) {
                const idx = villagerIndices.pop()!;
                finalRoles[idx] = specialRole;
            }
        }
    }
    
    return finalRoles.sort(() => Math.random() - 0.5);
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
                const wolfTeamRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy'];
                const nonWolfPlayers = assignedPlayers.filter(p => {
                    return p.role && !wolfTeamRoles.includes(p.role) && p.userId !== executioner.userId;
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
  const { gameId, playerId, actionType, targetId } = action;
  const gameRef = doc(db, 'games', gameId);
  try {
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        
        let game = gameSnap.data() as Game;
        if (game.phase !== 'night' || game.status === 'finished') return;

        const player = game.players.find(p => p.userId === playerId);
        if (!player || !player.isAlive) throw new Error("Jugador no válido o muerto.");
        if (game.exiledPlayerId === playerId) throw new Error("Has sido exiliado esta noche y no puedes usar tu habilidad.");
        if (player.usedNightAbility) return;
        
        let players = [...game.players];
        const playerIndex = players.findIndex(p => p.userId === action.playerId);
        
        switch (actionType) {
            case 'doctor_heal':
                const targetPlayer = players.find(p => p.userId === targetId);
                if (targetPlayer?.lastHealedRound === game.currentRound - 1) throw new Error("No puedes proteger a la misma persona dos noches seguidas.");
                if (targetPlayer) players[players.findIndex(p => p.userId === targetId)].lastHealedRound = game.currentRound;
                break;
            case 'hechicera_poison':
                if (player.potions?.poison) throw new Error("Ya has usado tu poción de veneno.");
                if(players[playerIndex].potions) players[playerIndex].potions!.poison = game.currentRound;
                break;
            case 'hechicera_save':
                if (player.potions?.save) throw new Error("Ya has usado tu poción de salvación.");
                if(players[playerIndex].potions) players[playerIndex].potions!.save = game.currentRound;
                break;
             case 'guardian_protect':
                if (targetId === playerId && (player.guardianSelfProtects || 0) >= 1) throw new Error("Solo puedes protegerte a ti mismo una vez.");
                if (targetId === playerId) players[playerIndex].guardianSelfProtects = (players[playerIndex].guardianSelfProtects || 0) + 1;
                break;
             case 'priest_bless':
                if (targetId === playerId && player.priestSelfHealUsed) throw new Error("Ya te has bendecido a ti mismo una vez.");
                 if (targetId === playerId) players[playerIndex].priestSelfHealUsed = true;
                break;
            case 'lookout_spy':
                if(player.lookoutUsed) throw new Error("Ya has usado tu habilidad de Vigía.");
                players[playerIndex].lookoutUsed = true;
                break;
            case 'resurrect':
                if(player.resurrectorAngelUsed) throw new Error("Ya has usado tu poder de resurrección.");
                players[playerIndex].resurrectorAngelUsed = true;
                break;
            case 'shapeshifter_select':
                 if(game.currentRound !== 1) throw new Error("Esta acción solo puede realizarse en la primera noche.");
                 players[playerIndex].shapeshifterTargetId = targetId;
                 break;
            case 'virginia_woolf_link':
            case 'river_siren_charm':
            case 'cupid_love':
                 if(game.currentRound !== 1) throw new Error("Esta acción solo puede realizarse en la primera noche.");
                 break;
        }

        players[playerIndex].usedNightAbility = true;
        
        const newAction: NightAction = { ...action, createdAt: Timestamp.now() };
        const updatedNightActions = [...(game.nightActions || []), newAction];
        transaction.update(gameRef, { nightActions: updatedNightActions, players });

    });

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

async function killPlayer(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string, cause: GameEvent['type']): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
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

        if (newGameData.twins) {
            checkAndQueueChainDeath(newGameData.twins, playerToKill, 'Tras la muerte de {victimName}, su gemelo/a {otherName} muere de pena.', 'special');
        }
        
        if (playerToKill.isLover && newGameData.lovers) {
            const otherLoverId = newGameData.lovers.find(id => id !== playerToKill.userId);
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


function checkGameOver(gameData: Game, lynchedPlayer?: Player): { isGameOver: boolean; message: string; winnerCode?: string; winners: string[] } {
    if (gameData.status === 'finished') {
        return { isGameOver: true, message: "La partida ya ha terminado.", winners: [] };
    }
    
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy']; 
    
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
    if (gameData.settings.fisherman && fisherman && fisherman.isAlive && gameData.boat) {
        const aliveVillagers = alivePlayers.filter(p => p.role && !wolfRoles.includes(p.role) && p.role !== 'vampire');
        const aliveVillagersOnBoat = aliveVillagers.every(v => gameData.boat.includes(v.userId));
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


export async function processNight(db: Firestore, gameId: string, externalTransaction?: Transaction) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    
    const process = async (transaction: Transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found!");
        
        let game = gameSnap.data();
        if (game.phase !== 'night' || game.status === 'finished') {
            return;
        }

        const initialPlayerState = JSON.parse(JSON.stringify(game.players));
        const actions = game.nightActions?.filter(a => a.round === game.currentRound) || [];
        
        if (game.currentRound === 1 && game.settings.cupid) {
            const cupidAction = actions.find(a => a.actionType === 'cupid_love');
            if (cupidAction) {
                const loverIds = cupidAction.targetId.split('|') as [string, string];
                if (loverIds.length === 2) {
                    game.players.forEach(p => { if (loverIds.includes(p.userId)) p.isLover = true; });
                    game.lovers = loverIds;
                }
            }
        }
        
        actions.forEach(action => {
             const playerIndex = game.players.findIndex(p => p.userId === action.playerId);
            const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
            if (playerIndex > -1) {
                if(action.actionType === 'cult_recruit' && targetIndex > -1) game.players[targetIndex].isCultMember = true;
                if(action.actionType === 'virginia_woolf_link') game.players[playerIndex].virginiaWoolfTargetId = action.targetId;
                if(action.actionType === 'river_siren_charm') game.players[playerIndex].riverSirenTargetId = action.targetId;
                if(action.actionType === 'silencer_silence') game.silencedPlayerId = action.targetId;
                if(action.actionType === 'elder_leader_exile') game.exiledPlayerId = action.targetId;
                if(action.actionType === 'witch_hunt' && targetIndex > -1 && game.players[targetIndex].role === 'seer') game.witchFoundSeer = true;
                if(action.actionType === 'fairy_find' && targetIndex > -1 && game.players[targetIndex].role === 'sleeping_fairy') {
                     game.fairiesFound = true;
                     game.events.push({ id: `evt_fairy_found_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `¡Las hadas se han encontrado! Un nuevo poder ha despertado.`, data: {}, createdAt: Timestamp.now() });
                }
                 if (action.actionType === 'banshee_scream' && game.players[playerIndex].bansheeScreams) {
                    game.players[playerIndex].bansheeScreams![game.currentRound] = action.targetId;
                }
            }
        });

        const allProtectedIds = new Set<string>();
        actions.filter(a => ['doctor_heal', 'guardian_protect', 'priest_bless'].includes(a.actionType))
               .forEach(a => allProtectedIds.add(a.targetId));

        let pendingDeaths: { targetId: string, cause: GameEvent['type'] }[] = [];
        
        if (game.leprosaBlockedRound !== game.currentRound) {
            const wolfVotes = actions.filter(a => a.actionType === 'werewolf_kill').map(a => a.targetId);

            const getConsensusTarget = (votes: string[]) => {
                if (votes.length === 0) return null;
                const voteCounts: Record<string, number> = {};
                votes.forEach(vote => {
                    vote.split('|').forEach(target => {
                        if(target) voteCounts[target] = (voteCounts[target] || 0) + 1;
                    });
                });
                const maxVotes = Math.max(...Object.values(voteCounts), 0);
                 if (maxVotes === 0) return null;
                const mostVotedTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
                return mostVotedTargets.length === 1 ? mostVotedTargets[0] : null;
            };

            const wolfTarget = getConsensusTarget(wolfVotes);

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
         const lookoutAction = actions.find(a => a.actionType === 'lookout_spy');
        if (lookoutAction && Math.random() >= 0.4) {
             pendingDeaths.push({ targetId: lookoutAction.playerId, cause: 'werewolf_kill' });
        }

        for (const death of pendingDeaths) {
            if (!allProtectedIds.has(death.targetId)) {
                const { updatedGame } = await killPlayer(transaction, gameRef, game, death.targetId, death.cause);
                game = updatedGame;
            }
        }
        
        let gameOverInfo = checkGameOver(game);
        if (gameOverInfo.isGameOver) {
            game.status = "finished";
            game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
            transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
            return;
        }

        if (game.pendingHunterShot) {
            transaction.update(gameRef, { players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot });
            return;
        }
        
        const newlyKilledPlayers = game.players.filter(p => !p.isAlive && initialPlayerState.find(ip => ip.userId === p.userId)?.isAlive);
        const killedPlayerDetails = newlyKilledPlayers.map(p => `${p.displayName} (que era ${roleDetails[p.role!]?.name || 'un rol desconocido'})`);

        let nightMessage = newlyKilledPlayers.length > 0 
            ? `Anoche, el pueblo perdió a ${killedPlayerDetails.join(' y a ')}.`
            : "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
        
        game.events.push({ id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: newlyKilledPlayers.map(p => p.userId), savedPlayerIds: Array.from(allProtectedIds) }, createdAt: Timestamp.now() });

        game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; });
        const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
        
        transaction.update(gameRef, {
            players: game.players, events: game.events, phase: 'day', phaseEndsAt,
            pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null,
        });
    };

    try {
        if (externalTransaction) {
            await process(externalTransaction);
        } else {
            await runTransaction(db, process);
        }
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
  const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;

  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists()) throw new Error("Partida no encontrada");

      let game = gameSnap.data();

      if (game.phase !== 'day' || game.status === 'finished') return;
      
      const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === game.currentRound);
      const isTiebreaker = lastVoteEvent?.data?.tiedPlayerIds;

      const alivePlayers = game.players.filter(p => p.isAlive);

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
        
        const shapeshifterIndex = game.players.findIndex(p => p.isAlive && p.role === 'shapeshifter' && p.shapeshifterTargetId === lynchedPlayerId);
        if (shapeshifterIndex > -1 && lynchedPlayerObject?.role) {
           game.players[shapeshifterIndex].role = lynchedPlayerObject.role;
           game.players[shapeshifterIndex].shapeshifterTargetId = null; 
           game.events.push({ id: `evt_transform_${Date.now()}`, gameId: game.id, round: game.currentRound, type: 'player_transformed', message: `¡Te has transformado! Ahora eres ${roleDetails[lynchedPlayerObject.role]?.name || 'un rol desconocido'}.`, data: { targetId: game.players[shapeshifterIndex].userId, newRole: lynchedPlayerObject.role }, createdAt: Timestamp.now() });
        }
        
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
      
      const gameOverInfo = checkGameOver(game, lynchedPlayerObject);
      if (gameOverInfo.isGameOver) {
          game.status = "finished";
          game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
          transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
          return;
      }

      if (game.pendingHunterShot) {
        transaction.update(gameRef, {
          players: game.players, events: game.events, phase: 'hunter_shot', 
          pendingHunterShot: game.pendingHunterShot
        });
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
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data();

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId || game.status === 'finished') {
                return;
            }
            
            const hunterPlayer = game.players.find(p => p.userId === hunterId)!;
            const targetPlayer = game.players.find(p => p.userId === targetId)!;
            
            const { updatedGame, triggeredHunterId } = await killPlayer(transaction, gameRef, game, targetId, 'hunter_shot');
            game = updatedGame;
            
            game.events.push({
                id: `evt_huntershot_${Date.now()}`, gameId, round: game.currentRound, type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
                createdAt: Timestamp.now(), data: {killedPlayerIds: [targetId]},
            });
            
            if (triggeredHunterId) {
                // Another hunter was triggered by the shot, wait for them.
                transaction.update(gameRef, { players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: triggeredHunterId });
                return;
            }

            const gameOverInfo = checkGameOver(game);
            if (gameOverInfo.isGameOver) {
                game.status = "finished";
                transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events });
                return;
            }
            
            const hunterDeathEvent = [...game.events].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).find(e => (e.data?.killedPlayerIds?.includes(hunterId) || e.data?.lynchedPlayerId === hunterId));
            
            const nextPhase = hunterDeathEvent?.type === 'vote_result' ? 'night' : 'day';
            const nextRound = nextPhase === 'night' ? game.currentRound + 1 : game.currentRound;

            game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; });
            const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
            
            transaction.update(gameRef, {
                players: game.players, events: game.events, phase: nextPhase, phaseEndsAt,
                currentRound: nextRound, pendingHunterShot: null
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
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef); // READ FIRST
            if (!gameSnap.exists()) throw new Error("Game not found");
            
            let game = gameSnap.data();
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
            
            transaction.update(gameRef, { players: game.players });
        });
        
        const gameDoc = await getDoc(gameRef); // READ AFTER
        if(gameDoc.exists()){
            const gameData = gameDoc.data();
            const voter = gameData.players.find(p => p.userId === voterId);
            const target = gameData.players.find(p => p.userId === targetId);
            if (!voter?.isAI && voter?.displayName && target?.displayName) {
                await triggerAIChat(db, gameId, `${voter.displayName} ha votado por ${target.displayName}.`);
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

            transaction.update(gameRef, { chatMessages: arrayUnion(messageData) });
        });

        if (!isFromAI && latestGame) {
            const triggerMessage = `${senderName} dijo: "${text.trim()}"`;
            await triggerAIChat(db, gameId, triggerMessage);
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
                    if (sender?.role && wolfRoles.includes(sender.role)) {
                        canSend = true;
                        chatField = 'wolfChatMessages';
                    }
                    break;
                case 'fairy':
                    if (sender?.role && fairyRoles.includes(sender.role) && game.fairiesFound) {
                        canSend = true;
                        chatField = 'fairyChatMessages';
                    }
                    break;
                case 'lovers':
                    if (sender?.isLover) {
                        canSend = true;
                        chatField = 'loversChatMessages';
                    }
                    break;
                 case 'twin':
                    if (sender?.role === 'twin') {
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
                senderId, senderName, text: text.trim(),
                round: game.currentRound, createdAt: Timestamp.now(),
            };

            transaction.update(gameRef, { [chatField]: arrayUnion(messageData) });
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
                newPlayer.joinedAt = player.joinedAt; 
                return newPlayer;
            });

            transaction.update(gameRef, {
                status: 'waiting', phase: 'waiting', currentRound: 0,
                events: [], chatMessages: [], wolfChatMessages: [], fairyChatMessages: [],
                twinChatMessages: [], loversChatMessages: [], nightActions: [],
                twins: null, lovers: null, phaseEndsAt: Timestamp.now(), pendingHunterShot: null,
                wolfCubRevengeRound: 0, players: resetHumanPlayers, vampireKills: 0, boat: [],
                leprosaBlockedRound: 0, witchFoundSeer: false, seerDied: false,
                silencedPlayerId: null, exiledPlayerId: null, troublemakerUsed: false,
                fairiesFound: false, fairyKillUsed: false,
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
  const gameRef = doc(db, "games", gameId) as DocumentReference<Game>;
  try {
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        const game = gameSnap.data();

        if (game.phase === 'role_reveal' && game.status === 'in_progress') {
            const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
            let updateData: Partial<Game> = { phase: 'night', phaseEndsAt };
            
            const cupidAction = game.nightActions?.find(a => a.round === 1 && a.actionType === 'cupid_love');
            if (game.settings.cupid && game.currentRound === 1 && cupidAction) {
                const loverIds = cupidAction.targetId.split('|') as [string, string];
                if (loverIds.length === 2) {
                    const playerUpdates = game.players.map(p => {
                        if (loverIds.includes(p.userId)) return { ...p, isLover: true };
                        return p;
                    });
                    updateData.players = playerUpdates;
                    updateData.lovers = loverIds;
                }
            }
             transaction.update(gameRef, updateData);
        }
    });
    return { success: true };
  } catch (error) {
    console.error("Error setting phase to night:", error);
    return { success: false, error: (error as Error).message };
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

            transaction.update(gameRef, { players: game.players, events: game.events });
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

export async function submitTroublemakerAction(db: Firestore, gameId: string, troublemakerId: string, target1Id: string, target2Id: string) {
  const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;

  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists()) throw new Error("Partida no encontrada");
      let game = gameSnap.data();

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
      
      let { updatedGame } = await killPlayer(transaction, gameRef, game, target1Id, 'troublemaker_duel');
      game = updatedGame;
      let finalResult = await killPlayer(transaction, gameRef, game, target2Id, 'troublemaker_duel');
      game = finalResult.updatedGame;

      game.events.push({
        id: `evt_trouble_${Date.now()}`, gameId, round: game.currentRound, type: 'special',
        message: `${player.displayName} ha provocado una pelea mortal. ${target1.displayName} y ${target2.displayName} han sido eliminados.`,
        createdAt: Timestamp.now(), data: { killedPlayerIds: [target1Id, target2Id] }
      });

      const gameOverInfo = checkGameOver(game);
      if (gameOverInfo.isGameOver) {
        game.status = "finished";
        transaction.update(gameRef, { status: 'finished', phase: 'finished', players: game.players, events: game.events, troublemakerUsed: true });
        return;
      }

      transaction.update(gameRef, { players: game.players, events: game.events, troublemakerUsed: true });
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

// ===============================================================================================
// AI LOGIC
// ===============================================================================================

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

async function triggerAIChat(db: Firestore, gameId: string, triggerMessage: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        if (game.status === 'finished') return;

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
        if (game.status === 'finished' || game.phase !== 'day') return;

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


export const getDeterministicAIAction = (
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

    if (game.phase !== 'night' || game.exiledPlayerId === userId) {
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
                if (p.role && wolfRoles.includes(p.role)) return false;
                if (game.witchFoundSeer && p.role === 'witch') return false; 
                return true;
            });
            const killCount = wolfCubRevengeActive ? 2 : 1;
            return { actionType: 'werewolf_kill', targetId: randomTarget(nonWolves, killCount) };
        }
        case 'seer':
        case 'seer_apprentice':
            if (role === 'seer' || apprenticeIsActive) {
                return { actionType: 'seer_check', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'doctor': {
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            return { actionType: 'doctor_heal', targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
        }
        case 'guardian':
             if ((aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) return { actionType: 'guardian_protect', targetId: userId };
            return { actionType: 'guardian_protect', targetId: randomTarget(potentialTargets) };
        case 'priest':
            if (!aiPlayer.priestSelfHealUsed && Math.random() < 0.2) return { actionType: 'priest_bless', targetId: userId };
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
             const hasSave = !aiPlayer.potions?.save;
             if (hasPoison && (!hasSave || Math.random() < 0.7)) {
                 return { actionType: 'hechicera_poison', targetId: randomTarget(potentialTargets) };
             } else if (hasSave) {
                 return { actionType: 'hechicera_save', targetId: randomTarget(potentialTargets.filter(p => p.userId !== aiPlayer.userId)) };
             }
             return { actionType: 'NONE', targetId: '' };
        case 'executioner':
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
