
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
import type { Game, Player, NightAction, GameEvent, PlayerRole, NightActionType, ChatMessage } from "@/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { roleDetails } from "@/lib/roles";
import { toPlainObject, getMillis } from "@/lib/utils";
import { triggerAIChat, runAIActions, triggerAIVote } from "@/lib/ai-actions";
import { secretObjectives } from "./objectives";
import { masterActions, type MasterActionId } from "./master-actions";

const PHASE_DURATION_SECONDS = 45;

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
    isWolf: false,
    votedFor: null,
    joinedAt: Timestamp.now(),
    lastActiveAt: Timestamp.now(),
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
    bansheeScreams: {},
    lookoutUsed: false,
    executionerTargetId: null,
    victories: 0,
    defeats: 0,
    roleStats: {},
    achievements: [],
    secretObjectiveId: null,
});


export async function createGame(
  db: Firestore,
  userId: string,
  displayName: string,
  avatarUrl: string,
  gameName: string,
  maxPlayers: number,
  settings: Game['settings']
) {
  if (typeof displayName !== 'string' || typeof gameName !== 'string') {
      return { error: "El nombre del jugador y de la partida deben ser texto." };
  }
  if (!userId || !displayName.trim() || !gameName.trim()) {
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
      ghostChatMessages: [],
      maxPlayers: maxPlayers,
      createdAt: Timestamp.now(),
      lastActiveAt: Timestamp.now(),
      currentRound: 0,
      settings: {
          ...settings,
          werewolves: werewolfCount,
      },
      phaseEndsAt: Timestamp.now(),
      twins: null,
      lovers: null,
      pendingHunterShot: null,
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
    
    const joinResult = await joinGame(db, gameId, userId, displayName, avatarUrl);
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

      if (game.status !== "waiting") {
        throw new Error("Esta partida ya ha comenzado.");
      }
      
      const playerExists = game.players.some(p => p.userId === userId);
      if (playerExists) {
        const currentPlayers = game.players;
        const playerIndex = currentPlayers.findIndex(p => p.userId === userId);
        if (playerIndex !== -1) {
            let changed = false;
            if(currentPlayers[playerIndex].displayName !== displayName.trim()) {
                currentPlayers[playerIndex].displayName = displayName.trim();
                changed = true;
            }
             if(currentPlayers[playerIndex].avatarUrl !== avatarUrl) {
                currentPlayers[playerIndex].avatarUrl = avatarUrl;
                changed = true;
            }
            if(changed) {
                transaction.update(gameRef, { players: toPlainObject(currentPlayers), lastActiveAt: Timestamp.now() });
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

            transaction.update(gameRef, { players: toPlainObject(updatedPlayers) });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating player avatar:", error);
        return { success: false, error: error.message };
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
            return settings[key] === true && roleKey !== 'werewolves' && roleKey !== 'fillWithAI' && roleKey !== 'isPublic' && roleKey !== 'juryVoting';
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
                    const aiAvatar = `/logo.png`;
                    const aiPlayerData = createPlayerObject(aiUserId, gameId, aiName, aiAvatar, true);
                    finalPlayers.push(aiPlayerData);
                }
            }
            
            const totalPlayers = finalPlayers.length;
            if (totalPlayers < MINIMUM_PLAYERS) {
                throw new Error(`Se necesitan al menos ${MINIMUM_PLAYERS} jugadores para comenzar.`);
            }
            
            const newRoles = generateRoles(finalPlayers.length, game.settings);
            
            let assignedPlayers = finalPlayers.map((player, index) => {
                const p = { ...player, role: newRoles[index], isAlive: true };
                p.isWolf = p.role === 'werewolf' || p.role === 'wolf_cub';

                if (p.role === 'cult_leader') {
                    p.isCultMember = true;
                }

                const applicableObjectives = secretObjectives.filter(obj => obj.appliesTo.includes(p.role!) || obj.appliesTo.includes('any'));
                if (applicableObjectives.length > 0) {
                    const chosenObjective = applicableObjectives[Math.floor(Math.random() * applicableObjectives.length)];
                    p.secretObjectiveId = chosenObjective.id;
                }
                return p;
            });

            const executioner = assignedPlayers.find(p => p.role === 'executioner');
            if (executioner) {
                const wolfTeamRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch'];
                const nonTargetableRoles: PlayerRole[] = ['drunk_man', 'executioner', ...wolfTeamRoles];
                const potentialTargets = assignedPlayers.filter(p => p.role && !nonTargetableRoles.includes(p.role) && p.userId !== executioner.userId);
                
                if (potentialTargets.length > 0) {
                    const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                    const executionerIndex = assignedPlayers.findIndex(p => p.userId === executioner.userId);
                    if (executionerIndex > -1) {
                        assignedPlayers[executionerIndex].executionerTargetId = target.userId;
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
                lastActiveAt: Timestamp.now(),
            }));
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
        
        if (playerIndex === -1) {
            console.error(`Critical error: Player ${action.playerId} not found in game ${gameId} during night action.`);
            return;
        }
        
        switch (actionType) {
            case 'doctor_heal':
            case 'guardian_protect':
                const targetPlayer = players.find(p => p.userId === targetId);
                if (!targetPlayer) break;
                if (targetPlayer.lastHealedRound === game.currentRound - 1 && game.currentRound > 1) throw new Error("No puedes proteger a la misma persona dos noches seguidas.");
                
                const targetPlayerIndex = players.findIndex(p => p.userId === targetId);
                if (targetPlayerIndex !== -1) {
                    players[targetPlayerIndex].lastHealedRound = game.currentRound;
                }

                if(actionType === 'guardian_protect' && targetId === playerId) {
                    if ((player.guardianSelfProtects || 0) >= 1) throw new Error("Solo puedes protegerte a ti mismo una vez.");
                    players[playerIndex].guardianSelfProtects = (players[playerIndex].guardianSelfProtects || 0) + 1;
                }
                break;
            case 'hechicera_poison':
                if (player.potions?.poison) throw new Error("Ya has usado tu poción de veneno.");
                if(players[playerIndex].potions) players[playerIndex].potions!.poison = game.currentRound;
                break;
            case 'hechicera_save':
                if (player.potions?.save) throw new Error("Ya has usado tu poción de salvación.");
                if(players[playerIndex].potions) players[playerIndex].potions!.save = game.currentRound;
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
        transaction.update(gameRef, { nightActions: updatedNightActions, players: toPlainObject(players) });

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

async function killPlayer(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string | null, cause: GameEvent['type']): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
    let newGameData = { ...gameData };
    let triggeredHunterId: string | null = null;
    
    if (!playerIdToKill) return { updatedGame: newGameData, triggeredHunterId };

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
            gameId: newGameData.id, round: newGameData.currentRound, type: cause,
            message: `${playerToKill.displayName} ha muerto. Su rol era: ${roleDetails[playerToKill.role!]?.name || 'Desconocido'}`,
            data: { killedPlayerIds: [currentIdToKill], revealedRole: playerToKill.role }, createdAt: Timestamp.now(),
        });
        
        if (playerToKill.role === 'seer' && newGameData.settings.seer_apprentice) {
            newGameData.seerDied = true;
            const apprenticeIndex = newGameData.players.findIndex(p => p.role === 'seer_apprentice' && p.isAlive);
            if (apprenticeIndex !== -1) {
                newGameData.players[apprenticeIndex].role = 'seer';
                newGameData.events.push({ id: `evt_transform_apprentice_${Date.now()}`, gameId: newGameData.id, round: newGameData.currentRound, type: 'player_transformed', message: `¡La Vidente ha muerto! ${newGameData.players[apprenticeIndex].displayName} hereda su don y se convierte en la nueva Vidente.`, data: { targetId: newGameData.players[apprenticeIndex].userId, newRole: 'seer' }, createdAt: Timestamp.now() });
            }
        }
        
        if (playerToKill.role === 'hunter' && newGameData.settings.hunter && !triggeredHunterId) {
            triggeredHunterId = playerToKill.userId;
        }
        
        if (playerToKill.role === 'wolf_cub' && newGameData.settings.wolf_cub) {
            newGameData.wolfCubRevengeRound = newGameData.currentRound;
        }

        if (playerToKill.role === 'leprosa' && newGameData.settings.leprosa) {
            newGameData.leprosaBlockedRound = newGameData.currentRound + 1;
        }
        
        const shapeshifterIndex = newGameData.players.findIndex(p => p.isAlive && p.role === 'shapeshifter' && p.shapeshifterTargetId === playerToKill.userId);
        if (shapeshifterIndex !== -1 && playerToKill.role) {
            const shifter = newGameData.players[shapeshifterIndex];
            if(shifter) {
                const newRole = playerToKill.role;
                newGameData.players[shapeshifterIndex].role = newRole;
                newGameData.players[shapeshifterIndex].isWolf = ['werewolf', 'wolf_cub'].includes(newRole);
                newGameData.players[shapeshifterIndex].shapeshifterTargetId = null; 
                newGameData.events.push({ id: `evt_transform_${Date.now()}_${shifter.userId}`, gameId: newGameData.id, round: newGameData.currentRound, type: 'player_transformed', message: `¡Has cambiado de forma! Ahora eres: ${roleDetails[newRole]?.name || 'un rol desconocido'}.`, data: { targetId: shifter.userId, newRole }, createdAt: Timestamp.now() });
            }
        }


        const checkAndQueueChainDeath = (linkedIds: (string[] | null | undefined), deadPlayer: Player, messageTemplate: string, eventType: GameEvent['type']) => {
            if (!linkedIds || !linkedIds.includes(deadPlayer.userId)) return;

            const otherId = linkedIds.find(id => id !== deadPlayer.userId);
            const otherPlayer = otherId ? newGameData.players.find(p => p.userId === otherId) : undefined;
            
            if (otherPlayer && otherPlayer.isAlive && !alreadyProcessed.has(otherId) && !killQueue.includes(otherId)) {
                killQueue.push(otherId);
                 newGameData.events.push({
                    id: `evt_chain_death_${Date.now()}_${otherId}`,
                    gameId: newGameData.id, round: newGameData.currentRound, type: eventType,
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
             if (otherLoverId) {
                checkAndQueueChainDeath([playerToKill.userId, otherLoverId], playerToKill, 'Por un amor eterno, {otherName} se quita la vida tras la muerte de {victimName}.', 'lover_death');
             }
        }
        
        const virginiaLinker = newGameData.players.find(p => p.role === 'virginia_woolf' && p.userId === playerToKill.userId);
        if (virginiaLinker && virginiaLinker.virginiaWoolfTargetId) {
             const linkedPlayerId = virginiaLinker.virginiaWoolfTargetId;
             if (linkedPlayerId) {
                checkAndQueueChainDeath([virginiaLinker.userId, linkedPlayerId], playerToKill, 'Tras la muerte de {victimName}, {otherName} muere por un vínculo misterioso.', 'special');
             }
        }
    }
    
    return { updatedGame: newGameData, triggeredHunterId };
}


function checkGameOver(gameData: Game, lynchedPlayer?: Player | null): { isGameOver: boolean; message: string; winnerCode?: string; winners: Player[], losers: Player[] } {
    if (gameData.status === 'finished') {
        const lastEvent = gameData.events.find(e => e.type === 'game_over');
        return { 
            isGameOver: true, 
            message: lastEvent?.message || "La partida ha terminado.", 
            winnerCode: lastEvent?.data?.winnerCode, 
            winners: lastEvent?.data?.winners || [],
            losers: lastEvent?.data?.losers || []
        };
    }
    
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch']; 
    
    let soloWinners: Player[] = [];
    if (lynchedPlayer) {
        if (lynchedPlayer.role === 'drunk_man' && gameData.settings.drunk_man) {
            soloWinners.push(lynchedPlayer);
        }
        
        if (gameData.settings.executioner) {
            const executioner = gameData.players.find(p => p.role === 'executioner' && p.isAlive);
            if (executioner && executioner.executionerTargetId === lynchedPlayer.userId) {
                soloWinners.push(executioner);
                return {
                    isGameOver: true,
                    winnerCode: 'executioner',
                    message: `¡El Verdugo ha ganado! Ha logrado su objetivo de que el pueblo linche a ${lynchedPlayer.displayName}.`,
                    winners: soloWinners,
                    losers: gameData.players.filter(p => !soloWinners.some(w => w.userId === p.userId))
                };
            }
        }
    }

    if (gameData.lovers) {
        const aliveLovers = alivePlayers.filter(p => gameData.lovers!.includes(p.userId));
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length >= 2) {
            return {
                isGameOver: true,
                winnerCode: 'lovers',
                message: '¡El amor ha triunfado! Los enamorados son los únicos supervivientes y ganan la partida.',
                winners: aliveLovers,
                losers: gameData.players.filter(p => !aliveLovers.some(w => w.userId === p.userId))
            };
        }
    }

     const aliveCultMembers = alivePlayers.filter(p => p.isCultMember);
    if (gameData.settings.cult_leader && aliveCultMembers.length > 0 && aliveCultMembers.length === alivePlayers.length) {
         const cultLeader = gameData.players.find(p => p.role === 'cult_leader');
         const winners = cultLeader ? [cultLeader, ...soloWinners] : [...aliveCultMembers, ...soloWinners];
         return {
            isGameOver: true,
            winnerCode: 'cult',
            message: '¡El Culto ha ganado! Todos los supervivientes se han unido a la sombra del Líder.',
            winners: winners,
            losers: gameData.players.filter(p => !winners.some(w => w.userId === p.userId))
        };
    }
    
    if (gameData.settings.vampire && gameData.players.some(p => p.role === 'vampire' && p.isAlive) && (gameData.vampireKills || 0) >= 3) {
        const winners = [...gameData.players.filter(p => p.role === 'vampire'), ...soloWinners];
        return {
            isGameOver: true,
            winnerCode: 'vampire',
            message: '¡El Vampiro ha ganado! Ha reclamado sus tres víctimas y ahora reina en la oscuridad.',
            winners: winners,
            losers: gameData.players.filter(p => !winners.some(w => w.userId === p.userId))
        };
    }

    const fisherman = gameData.players.find(p => p.role === 'fisherman' && p.isAlive);
    if (gameData.settings.fisherman && fisherman && gameData.boat) {
        const aliveVillagers = alivePlayers.filter(p => p.role && !wolfRoles.includes(p.role) && p.role !== 'vampire' && p.role !== 'cult_leader' && p.role !== 'drunk_man' && p.role !== 'executioner');
        if (aliveVillagers.length > 0 && aliveVillagers.every(v => gameData.boat.includes(v.userId))) {
            const winners = [fisherman, ...soloWinners];
            return {
                isGameOver: true,
                winnerCode: 'fisherman',
                message: `¡El Pescador ha ganado! Ha conseguido salvar a todos los aldeanos en su barco.`,
                winners: winners,
                losers: gameData.players.filter(p => !winners.some(w => w.userId === p.userId))
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
                const winners = [banshee, ...soloWinners];
                return {
                    isGameOver: true,
                    winnerCode: 'banshee',
                    message: `¡La Banshee ha ganado! Sus dos gritos han sentenciado a muerte y ha cumplido su objetivo.`,
                    winners: winners,
                    losers: gameData.players.filter(p => !winners.some(w => w.userId === p.userId))
                };
             }
        }
    }
    
    if (gameData.fairyKillUsed) {
        const fairies = gameData.players.filter(p => p.role === 'seeker_fairy' || p.role === 'sleeping_fairy');
        const fairiesAreAlive = fairies.every(f => f.isAlive);
        if (fairiesAreAlive) {
            const winners = [...fairies, ...soloWinners];
            return {
                isGameOver: true,
                winnerCode: 'fairies',
                message: '¡Las Hadas han ganado! Han lanzado su maldición y cumplido su misterioso objetivo.',
                winners: winners,
                losers: gameData.players.filter(p => !winners.some(w => w.userId === p.userId))
            };
        }
    }

    const aliveWerewolves = alivePlayers.filter(p => p.isWolf);
    const nonWolves = alivePlayers.filter(p => !p.isWolf);
    if (aliveWerewolves.length > 0 && aliveWerewolves.length >= nonWolves.length) {
        const winners = [...aliveWerewolves, ...soloWinners];
        return {
            isGameOver: true,
            winnerCode: 'wolves',
            message: "¡Los hombres lobo han ganado! Superan en número a los aldeanos y la oscuridad consume el pueblo.",
            winners: winners,
            losers: gameData.players.filter(p => !winners.some(w => w.userId === p.userId))
        };
    }
    
    const threats = alivePlayers.filter(p => p.isWolf || p.role === 'vampire' || (p.role === 'sleeping_fairy' && gameData.fairiesFound));
    if (threats.length === 0 && alivePlayers.length > 0) {
        const villageWinners = alivePlayers.filter(p => !p.isCultMember && p.role !== 'sleeping_fairy' && p.role !== 'executioner'); 
        const winners = [...villageWinners, ...soloWinners];
        return {
            isGameOver: true,
            winnerCode: 'villagers',
            message: "¡El pueblo ha ganado! Todas las amenazas han sido eliminadas.",
            winners: winners,
            losers: gameData.players.filter(p => !winners.some(w => w.userId === p.userId))
        };
    }
    
    if (alivePlayers.length === 0) {
        const losers = gameData.players.filter(p => !soloWinners.some(w => w.userId === p.userId));
        return {
            isGameOver: true,
            winnerCode: 'draw',
            message: "¡Nadie ha sobrevivido a la masacre!",
            winners: soloWinners,
            losers: losers
        };
    }

    if (soloWinners.length > 0) {
        return { isGameOver: true, message: "La partida ha terminado, pero alguien tenía sus propios planes...", winners: soloWinners, losers: [], winnerCode: 'special' }
    }


    return { isGameOver: false, message: "", winners: [], losers: [] };
}


export async function processNight(db: Firestore, gameId: string) {
  const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    
  try {
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found!");
        
        let game = gameSnap.data();
        if (game.phase !== 'night' || game.status === 'finished') {
            return;
        }

        const initialPlayerState = JSON.parse(JSON.stringify(game.players));
        const actions = game.nightActions?.filter(a => a.round === game.currentRound) || [];
        
        // --- PHASE 1: PRE-ATTACK ACTIONS ---
        actions.forEach(action => {
             const playerIndex = game.players.findIndex(p => p.userId === action.playerId);
             const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
             if (playerIndex === -1) return;

             if (action.actionType === 'cult_recruit' && targetIndex !== -1) game.players[targetIndex].isCultMember = true;
             if (action.actionType === 'virginia_woolf_link' && game.currentRound === 1) game.players[playerIndex].virginiaWoolfTargetId = action.targetId;
             if (action.actionType === 'river_siren_charm' && game.currentRound === 1) game.players[playerIndex].riverSirenTargetId = action.targetId;
             if (action.actionType === 'silencer_silence') game.silencedPlayerId = action.targetId;
             if (action.actionType === 'elder_leader_exile') game.exiledPlayerId = action.targetId;
             if (action.actionType === 'fisherman_catch' && targetIndex !== -1) game.boat.push(action.targetId);
             if (action.actionType === 'witch_hunt' && targetIndex !== -1 && game.players[targetIndex].role === 'seer') game.witchFoundSeer = true;
             if (action.actionType === 'fairy_find' && targetIndex !== -1 && game.players[targetIndex].role === 'sleeping_fairy') {
                 game.fairiesFound = true;
                 game.events.push({ id: `evt_fairy_found_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `¡Las hadas se han encontrado! Un nuevo poder ha despertado.`, data: {}, createdAt: Timestamp.now() });
             }
             if (action.actionType === 'banshee_scream' && game.players[playerIndex].bansheeScreams) {
                game.players[playerIndex].bansheeScreams![game.currentRound] = action.targetId;
             }
             if (action.actionType === 'resurrect' && targetIndex !== -1) {
                game.players[targetIndex].isAlive = true;
             }
        });
        
        if (game.currentRound === 1 && game.settings.cupid) {
            const cupidAction = actions.find(a => a.actionType === 'cupid_love');
            if (cupidAction) {
                const loverIds = cupidAction.targetId.split('|') as [string, string];
                if (loverIds.length === 2) {
                    game.lovers = loverIds;
                    game.players.forEach(p => {
                        if (loverIds.includes(p.userId)) {
                            p.isLover = true;
                        }
                    });
                }
            }
        }

        // --- PHASE 2: ATTACK DETERMINATION ---
        let pendingDeaths: { targetId: string | null, cause: GameEvent['type'] }[] = [];
        
        const fishermanAction = actions.find(a => a.actionType === 'fisherman_catch');
        if (fishermanAction) {
            const targetPlayer = game.players.find(p => p.userId === fishermanAction.targetId);
            if (targetPlayer?.isWolf) {
                pendingDeaths.push({ targetId: fishermanAction.playerId, cause: 'special' });
            }
        }
        
        let wolfTargetId: string | null = null;
        if (game.leprosaBlockedRound !== game.currentRound) {
            const wolfVotes = actions.filter(a => a.actionType === 'werewolf_kill').map(a => a.targetId);
            const getConsensusTarget = (votes: string[]) => {
                if (votes.length === 0) return null;
                const voteCounts: Record<string, number> = {};
                votes.forEach(vote => vote.split('|').forEach(target => {
                    if(target) voteCounts[target] = (voteCounts[target] || 0) + 1;
                }));
                const maxVotes = Math.max(...Object.values(voteCounts), 0);
                if (maxVotes === 0) return null;
                const mostVotedTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
                return mostVotedTargets.length === 1 ? mostVotedTargets[0] : null;
            };
            wolfTargetId = getConsensusTarget(wolfVotes);
        }
        
        const hechiceraPoisonAction = actions.find(a => a.actionType === 'hechicera_poison');
        if (hechiceraPoisonAction) pendingDeaths.push({ targetId: hechiceraPoisonAction.targetId, cause: 'special' });
        
        const lookoutAction = actions.find(a => a.actionType === 'lookout_spy');
        if (lookoutAction) {
             if (Math.random() < 0.4) { // 40% fail rate
                pendingDeaths.push({ targetId: lookoutAction.playerId, cause: 'special' });
                game.events.push({ id: `evt_lookout_fail_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `¡${game.players.find(p=>p.userId===lookoutAction.playerId)?.displayName} ha sido descubierto espiando y ha muerto!`, data: { targetId: lookoutAction.playerId }, createdAt: Timestamp.now() });
            } else {
                const visits: Record<string, string[]> = {};
                actions.forEach(act => {
                    if(act.playerId !== lookoutAction.playerId && act.targetId){
                        act.targetId.split('|').forEach(tid => {
                            if(!visits[tid]) visits[tid] = [];
                            const visitor = game.players.find(p => p.userId === act.playerId);
                            if(visitor) visits[tid].push(visitor.displayName);
                        });
                    }
                });
                const visitorsToTarget = visits[lookoutAction.targetId] || [];
                 if (visitorsToTarget.length > 0) {
                    game.events.push({ id: `evt_lookout_success_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `Mientras vigilabas, viste a ${[...new Set(visitorsToTarget)].join(', ')} visitar la casa.`, data: { targetId: lookoutAction.playerId }, createdAt: Timestamp.now() });
                } else {
                    game.events.push({ id: `evt_lookout_success_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `La noche fue tranquila en la casa que vigilabas. No viste a nadie.`, data: { targetId: lookoutAction.playerId }, createdAt: Timestamp.now() });
                }
            }
        }
        
        // --- PHASE 3: PROTECTION & REACTION ---
        const allProtectedIds = new Set<string>();
        actions.filter(a => ['doctor_heal', 'guardian_protect', 'priest_bless', 'hechicera_save'].includes(a.actionType)).forEach(a => allProtectedIds.add(a.targetId));

        if (wolfTargetId) {
            const targetPlayer = game.players.find(p => p.userId === wolfTargetId);
            if (targetPlayer?.role === 'cursed' && game.settings.cursed && !allProtectedIds.has(wolfTargetId)) {
                const cursedPlayerIndex = game.players.findIndex(p => p.userId === wolfTargetId);
                if (cursedPlayerIndex !== -1) {
                    game.players[cursedPlayerIndex].role = 'werewolf';
                    game.players[cursedPlayerIndex].isWolf = true;
                    game.events.push({ id: `evt_transform_cursed_${Date.now()}`, gameId, round: game.currentRound, type: 'player_transformed', message: `¡${targetPlayer.displayName} ha sido mordido y se ha transformado en Hombre Lobo!`, data: { targetId: targetPlayer.userId, newRole: 'werewolf' }, createdAt: Timestamp.now() });
                }
            } else {
                 if (!allProtectedIds.has(wolfTargetId)) {
                    pendingDeaths.push({ targetId: wolfTargetId, cause: 'werewolf_kill' });
                 }
            }
        }
        
        // --- PHASE 4: RESOLVE DEATHS ---
        let triggeredHunterId: string | null = null;
        for (const death of pendingDeaths) {
            if (death.targetId && !allProtectedIds.has(death.targetId)) {
                const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, death.targetId, death.cause);
                game = updatedGame;
                if(newHunterId) triggeredHunterId = newHunterId;
            }
        }
        
        if (game.wolfCubRevengeRound === game.currentRound) {
             game.events.push({ id: `evt_revenge_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: "¡La cría de lobo ha muerto! La manada, enfurecida, atacará de nuevo.", data: {}, createdAt: Timestamp.now() });
             game.players.forEach(p => { if (p.isWolf) p.usedNightAbility = false; });
             game.wolfCubRevengeRound = 0; // Mark as used
             transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, wolfCubRevengeRound: 0 }));
             return; 
        }

        // --- PHASE 5: CHECK GAME OVER & TRANSITION ---
        let gameOverInfo = checkGameOver(game);
        if (gameOverInfo.isGameOver) {
            game.status = "finished";
            game.phase = "finished";
            const winners = game.players.filter(p => gameOverInfo.winners.some(w => w.userId === p.userId));
            const losers = game.players.filter(p => !gameOverInfo.winners.some(w => w.userId === p.userId));
            game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: toPlainObject(winners), losers: toPlainObject(losers) }, createdAt: Timestamp.now() });
            transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events, boat: game.boat, lastActiveAt: Timestamp.now() }));
            return;
        }

        game.pendingHunterShot = triggeredHunterId;
        if (game.pendingHunterShot) {
            transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot, boat: game.boat, lastActiveAt: Timestamp.now() }));
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
        
        transaction.update(gameRef, toPlainObject({
            players: game.players, events: game.events, phase: 'day', phaseEndsAt, boat: game.boat,
            pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null, lastActiveAt: Timestamp.now(),
        }));
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
  const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;

  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists()) throw new Error("Partida no encontrada");

      let game = gameSnap.data();
      if (game.phase !== 'day' || game.status === 'finished') return;
      
      const lastVoteEvent = [...game.events].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)).find(e => e.type === 'vote_result');
      const isTiebreaker = Array.isArray(lastVoteEvent?.data?.tiedPlayerIds) && !lastVoteEvent?.data?.final;

      const alivePlayers = game.players.filter(p => p.isAlive);
      const voteCounts: Record<string, number> = {};
      
      alivePlayers.forEach(player => {
        if (player.votedFor) {
            if (!isTiebreaker || lastVoteEvent.data.tiedPlayerIds.includes(player.votedFor)) {
                 voteCounts[player.votedFor] = (voteCounts[player.votedFor] || 0) + 1;
            }
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
          const deadPlayers = game.players.filter(p => !p.isAlive);
          if (deadPlayers.length > 0 && game.settings.juryVoting) {
              game.events.push({ id: `evt_vote_tie_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message: `¡Empate! La decisión ahora recae en el Jurado de los Muertos. Deben elegir entre: ${mostVotedPlayerIds.map(id => game.players.find(p=>p.userId === id)?.displayName).join(', ')}.`, data: { tiedPlayerIds: mostVotedPlayerIds, final: false }, createdAt: Timestamp.now() });
              const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
              transaction.update(gameRef, toPlainObject({ events: game.events, phase: 'jury_voting', phaseEndsAt, juryVotes: {} }));
          } else {
              game.events.push({ id: `evt_vote_tie_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message: "¡Empate! Como no hay un jurado que decida, el pueblo perdona una vida hoy.", data: { tiedPlayerIds: mostVotedPlayerIds, final: true }, createdAt: Timestamp.now() });
              game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false;});
              const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
              const newRound = game.currentRound + 1;
              transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'night', phaseEndsAt, currentRound: newRound, pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null, lastActiveAt: Timestamp.now() }));
          }
          return;
      }

      let lynchedPlayerId: string | null = mostVotedPlayerIds[0] || null;
      let lynchedPlayerObject: Player | null = null;
      let triggeredHunterId: string | null = null;

      if (lynchedPlayerId) {
        lynchedPlayerObject = game.players.find(p => p.userId === lynchedPlayerId) || null;
        
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
            const result = await killPlayer(transaction, gameRef, game, lynchedPlayerId, 'vote_result');
            game = result.updatedGame;
            triggeredHunterId = result.triggeredHunterId;
        }
      } else {
        const message = isTiebreaker ? 'Tras un segundo empate, el pueblo decide perdonar una vida hoy.' : 'El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.';
        game.events.push({ id: `evt_vote_result_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message, data: { lynchedPlayerId: null, final: true }, createdAt: Timestamp.now() });
      }
      
      const gameOverInfo = checkGameOver(game, lynchedPlayerObject);
      if (gameOverInfo.isGameOver) {
          game.status = "finished";
          game.phase = "finished";
          const winners = game.players.filter(p => gameOverInfo.winners.some(w => w.userId === p.userId));
          const losers = game.players.filter(p => !gameOverInfo.winners.some(w => w.userId === p.userId));
          game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: toPlainObject(winners), losers: toPlainObject(losers) }, createdAt: Timestamp.now() });
          transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events, lastActiveAt: Timestamp.now() }));
          return;
      }
      
      game.pendingHunterShot = triggeredHunterId;
      if (game.pendingHunterShot) {
        transaction.update(gameRef, toPlainObject({
          players: game.players, events: game.events, phase: 'hunter_shot', 
          pendingHunterShot: game.pendingHunterShot, lastActiveAt: Timestamp.now()
        }));
        return;
      }

      const newRound = game.currentRound + 1;
      game.players.forEach(p => { 
        p.votedFor = null;
        p.usedNightAbility = false; 
      });
      const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
      
      transaction.update(gameRef, toPlainObject({
        players: game.players, events: game.events, phase: 'night', phaseEndsAt,
        currentRound: newRound, pendingHunterShot: null, silencedPlayerId: null,
        exiledPlayerId: null, lastActiveAt: Timestamp.now(),
      }));
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
export async function submitJuryVote(db: Firestore, gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(db, async(transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada");
            const game = gameSnap.data();
            if (game.phase !== 'jury_voting' || game.status === 'finished') return;
            const juryVotes = game.juryVotes || {};
            if (juryVotes[voterId]) return; // Already voted

            juryVotes[voterId] = targetId;
            transaction.update(gameRef, { juryVotes });
        });
        return { success: true };
    } catch(error: any) {
        console.error("Error submitting jury vote:", error);
        return { error: error.message };
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

    const isWerewolf = !!targetPlayer.isWolf || (targetPlayer.role === 'lycanthrope' && game.settings.lycanthrope);

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
            
            const hunterPlayer = game.players.find(p => p.userId === hunterId);
            const targetPlayer = game.players.find(p => p.userId === targetId);
            
            if (!hunterPlayer || !targetPlayer) {
                console.error("Hunter or target not found for shot.");
                return;
            }
            
            let { updatedGame, triggeredHunterId } = await killPlayer(transaction, gameRef, game, targetId, 'hunter_shot');
            game = updatedGame;
            
            game.events.push({
                id: `evt_huntershot_${Date.now()}`, gameId, round: game.currentRound, type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
                createdAt: Timestamp.now(), data: {killedPlayerIds: [targetId]},
            });
            
            if (triggeredHunterId) {
                game.pendingHunterShot = triggeredHunterId;
                transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: triggeredHunterId, lastActiveAt: Timestamp.now() }));
                return;
            }

            const gameOverInfo = checkGameOver(game);
             if (gameOverInfo.isGameOver) {
                game.status = "finished";
                game.phase = "finished";
                 const winners = game.players.filter(p => gameOverInfo.winners.some(w => w.userId === p.userId));
                 const losers = game.players.filter(p => !gameOverInfo.winners.some(w => w.userId === p.userId));
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: toPlainObject(winners), losers: toPlainObject(losers) }, createdAt: Timestamp.now() });
                transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events, lastActiveAt: Timestamp.now() }));
                return;
            }
            
            const hunterDeathEvent = [...game.events].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)).find(e => (e.data?.killedPlayerIds?.includes(hunterId) || e.data?.lynchedPlayerId === hunterId));
            
            const nextPhase = hunterDeathEvent?.type === 'vote_result' ? 'night' : 'day';
            const currentRound = game.currentRound;
            const newRound = nextPhase === 'night' ? currentRound + 1 : currentRound;

            game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; });
            const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
            
            transaction.update(gameRef, toPlainObject({
                players: game.players, events: game.events, phase: nextPhase, phaseEndsAt,
                currentRound: newRound, pendingHunterShot: null, lastActiveAt: Timestamp.now()
            }));
        });
        return { success: true };
    } catch (error: any) {
        console.error("CRITICAL ERROR in submitHunterShot: ", error);
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al disparar." };
        }
        return { success: false, error: error.message || "No se pudo registrar el disparo." };
    }
}
export async function submitVote(db: Firestore, gameId: string, voterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    
    try {
       await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
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
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al votar." };
        }
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

            const fairyRoles: PlayerRole[] = ['seeker_fairy', 'sleeping_fairy'];

            let canSend = false;
            let chatField: keyof Game = 'chatMessages';

            switch (chatType) {
                case 'wolf':
                    if (sender.isWolf) {
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
                fairiesFound: false, fairyKillUsed: false, juryVotes: {}, lastActiveAt: Timestamp.now(),
            }));
        });
        return { success: true };
    } catch (e: any) {
        console.error("Error resetting game:", e);
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: gameRef.path, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado para reiniciar la partida." };
        }
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
             transaction.update(gameRef, toPlainObject(updateData));
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

            transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events }));
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
        game.phase = "finished";
        const winners = game.players.filter(p => gameOverInfo.winners.some(w => w.userId === p.userId));
        const losers = game.players.filter(p => !gameOverInfo.winners.some(w => w.userId === p.userId));
        game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners, losers }, createdAt: Timestamp.now() });
        transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events, troublemakerUsed: true }));
        return;
      }

      transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, troublemakerUsed: true, lastActiveAt: Timestamp.now() }));
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

export async function masterKillPlayer(db: Firestore, gameId: string, masterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(db, async(transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data();

            if (game.creator !== masterId) throw new Error("Solo el Máster puede usar esta acción.");
            if (game.masterKillUsed) throw new Error("El Zarpazo del Destino ya ha sido utilizado.");

            const { updatedGame } = await killPlayer(transaction, gameRef, game, targetId, 'special');
            game = updatedGame;

            game.masterKillUsed = true;
            const targetPlayer = game.players.find(p => p.userId === targetId);
            game.events.push({ id: `evt_master_kill_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `El Máster ha intervenido. ${targetPlayer?.displayName || 'Alguien'} ha sido eliminado por el Zarpazo del Destino.`, data: { killedPlayerIds: [targetId] }, createdAt: Timestamp.now() });

            const gameOverInfo = checkGameOver(game);
             if (gameOverInfo.isGameOver) {
                game.status = "finished";
                game.phase = "finished";
                 const winners = game.players.filter(p => gameOverInfo.winners.some(w => w.userId === p.userId));
                 const losers = game.players.filter(p => !gameOverInfo.winners.some(w => w.userId === p.userId));
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners, losers }, createdAt: Timestamp.now() });
            }

            transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, masterKillUsed: true, status: game.status, phase: game.phase, lastActiveAt: Timestamp.now() }));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error in masterKillPlayer:", error);
        return { error: error.message };
    }
}

export async function executeMasterAction(db: Firestore, gameId: string, masterId: string, actionId: MasterActionId, sourceId: string | null, targetId: string) {
    const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(db, async(transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data();
            if (game.creator !== masterId) throw new Error("Solo el Máster puede usar esta acción.");
            
            const action = masterActions[actionId];
            if (!action) throw new Error("Acción del Máster desconocida.");
            
            const finalSourceId = sourceId || masterId;
            const { updatedGame } = action.execute(game, finalSourceId, targetId);

            transaction.update(gameRef, toPlainObject(updatedGame));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error executing master action:", error);
        return { error: error.message };
    }
}

export async function updatePlayerHeartbeat(db: Firestore, gameId: string, userId: string) {
    if (!gameId || !userId) return;
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) return;

            const gameData = gameDoc.data() as Game;
            const playerIndex = gameData.players.findIndex(p => p.userId === userId);

            if (playerIndex !== -1) {
                const updatedPlayers = [...gameData.players];
                updatedPlayers[playerIndex].lastActiveAt = Timestamp.now();
                transaction.update(gameRef, { players: toPlainObject(updatedPlayers), lastActiveAt: Timestamp.now() });
            }
        });
    } catch (error) {
        console.warn("Could not update player heartbeat", error);
    }
}

export async function promoteNextMaster(db: Firestore, gameId: string, currentMasterId: string) {
    const gameRef = doc(db, 'games', gameId);
    try {
        let newMasterName: string = "nadie";
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Partida no encontrada.");
            
            let game = gameDoc.data() as Game;
            if (game.creator !== currentMasterId) throw new Error("Solo el Máster actual puede transferir el liderazgo.");
            
            const sortedAlivePlayers = game.players
                .filter(p => p.isAlive)
                .sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
            
            const currentMasterIndex = sortedAlivePlayers.findIndex(p => p.userId === currentMasterId);
            const nextMaster = sortedAlivePlayers[(currentMasterIndex + 1) % sortedAlivePlayers.length];

            if (!nextMaster || nextMaster.userId === currentMasterId) {
                throw new Error("No hay otro jugador elegible para ser Máster.");
            }

            newMasterName = nextMaster.displayName;
            game.creator = nextMaster.userId;
            
            game.events.push({
                id: `evt_master_transfer_${Date.now()}`, gameId, round: game.currentRound, type: 'special',
                message: `El liderazgo ha sido transferido. ${newMasterName} es el nuevo Máster de la partida.`,
                createdAt: Timestamp.now(), data: { newMasterId: nextMaster.userId },
            });
            
            transaction.update(gameRef, toPlainObject({ creator: game.creator, events: game.events, lastActiveAt: Timestamp.now() }));
        });
        return { success: true, newMaster: newMasterName };
    } catch (error: any) {
        console.error("Error promoting next master:", error);
        return { success: false, error: error.message };
    }
}
