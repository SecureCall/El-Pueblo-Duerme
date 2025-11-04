
'use server';
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
import type { Game, Player, NightAction, GameEvent, PlayerRole, NightActionType, ChatMessage, AIPlayerPerspective, GameStateChange } from "@/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { roleDetails } from "@/lib/roles";
import { toPlainObject } from "./utils";
import { masterActions } from "./master-actions";
import { createRoleInstance } from "./roles/role-factory";


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
  userId: string,
  displayName: string,
  avatarUrl: string,
  gameName: string,
  maxPlayers: number,
  settings: Game['settings']
) {
  try {
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

    const gameData: Game = {
        id: gameId,
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
    
    await setDoc(gameRef, toPlainObject(gameData));
    
    const joinResult = await joinGame(db, gameId, userId, displayName, avatarUrl);
    if (joinResult.error) {
      console.error(`Game created (${gameId}), but creator failed to join:`, joinResult.error);
      return { error: `La partida se creó, pero no se pudo unir: ${joinResult.error}` };
    }

    return { gameId };
  } catch (error: any) {
    console.error("Error creating game:", error);
    if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: `games/some-game-id`, // Generic path
            operation: 'create',
            requestResourceData: { name: gameName },
        });
        errorEmitter.emit('permission-error', permissionError);
        return { error: "Permiso denegado al crear la partida." };
    }
    return { error: `Error al crear la partida: ${error.message || 'Error desconocido'}` };
  }
}

// ===============================================================================================
// AI ACTIONS LOGIC
// ===============================================================================================

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
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500)); // Stagger AI actions
            const { actionType, targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);

            if (actionType && actionType !== 'NONE' && targetId) {
                await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType as NightActionType, targetId });
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
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


export async function getAIChatResponse(db: Firestore, gameId: string, aiPlayer: Player, triggerMessage: string, chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost') {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return null;
        
        const game = toPlainObject(gameDoc.data()) as Game;

        if (game.status === 'finished') return null;

        const perspective: AIPlayerPerspective = {
            game: game,
            aiPlayer: toPlainObject(aiPlayer),
            trigger: triggerMessage,
            players: toPlainObject(game.players), 
            chatType,
        };

        const result = await generateAIChatMessage(perspective);
        
        if (result && result.shouldSend && result.message) {
            return result.message;
        }
        return null;

    } catch (e) {
        console.error("Error in getAIChatResponse:", e);
        return null;
    }
}


export const getDeterministicAIAction = (
    aiPlayer: Player,
    game: Game,
    alivePlayers: Player[],
    deadPlayers: Player[],
): { actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE', targetId: string } => {
    const sanitizedGame = toPlainObject(game) as Game;
    const { role, userId } = aiPlayer;
    const { currentRound, nightActions = [] } = sanitizedGame;
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
    const wolfCubRevengeActive = sanitizedGame.wolfCubRevengeRound === currentRound;
    const apprenticeIsActive = role === 'seer_apprentice' && sanitizedGame.seerDied;
    const canFairiesKill = sanitizedGame.fairiesFound && !sanitizedGame.fairyKillUsed && (role === 'seeker_fairy' || role === 'sleeping_fairy');

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

    if (sanitizedGame.phase === 'day') {
        if (aiPlayer.role === 'executioner' && aiPlayer.executionerTargetId) {
            const targetIsAlive = alivePlayers.some(p => p.userId === aiPlayer.executionerTargetId);
            if (targetIsAlive && Math.random() < 0.75) {
                return { actionType: 'VOTE', targetId: aiPlayer.executionerTargetId };
            }
        }
        return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
    }

    if (sanitizedGame.phase === 'hunter_shot' && sanitizedGame.pendingHunterShot === userId) {
        return { actionType: 'SHOOT', targetId: randomTarget(potentialTargets) };
    }

    if (sanitizedGame.phase !== 'night' || aiPlayer.isExiled) {
        return { actionType: 'NONE', targetId: '' };
    }

    if (canFairiesKill) {
        const nonFairies = potentialTargets.filter(p => p.role !== 'seeker_fairy' && p.role !== 'sleeping_fairy');
        return { actionType: 'fairy_kill', targetId: randomTarget(nonFairies) };
    }

    switch (role) {
        case 'werewolf':
        case 'wolf_cub': {
             const wolfActions = nightActions.filter(a => a.round === currentRound && a.actionType === 'werewolf_kill' && a.playerId !== userId && wolfRoles.includes(sanitizedGame.players.find(p=>p.userId === a.playerId)?.role || null));
             if (wolfActions.length > 0 && Math.random() < 0.8) { 
                 const leaderAction = wolfActions[0];
                 if (leaderAction && leaderAction.targetId) {
                    return { actionType: 'werewolf_kill', targetId: leaderAction.targetId };
                 }
             }

            const nonWolves = potentialTargets.filter(p => {
                if (p.role && wolfRoles.includes(p.role)) return false;
                if (sanitizedGame.witchFoundSeer && p.role === 'witch') return false; 
                return true;
            });
            const killCount = wolfCubRevengeActive ? 2 : 1;
            return { actionType: 'werewolf_kill', targetId: randomTarget(nonWolves, killCount) };
        }
        case 'seer':
        case 'seer_apprentice':
            if (role === 'seer' || apprenticeIsActive) {
                const lastVoteEvent = sanitizedGame.events.find(e => e.type === 'vote_result' && e.round === currentRound - 1);
                
                const suspicionMap: Record<string, number> = {};
                alivePlayers.forEach(p => {
                    if (p.userId !== aiPlayer.userId) suspicionMap[p.userId] = 1;
                });
                
                if(lastVoteEvent?.data) {
                    const lynchedPlayerId = lastVoteEvent.data.lynchedPlayerId;
                    const lynchedPlayer = sanitizedGame.players.find(p => p.userId === lynchedPlayerId);
                    if(lynchedPlayer?.role === 'villager') {
                         sanitizedGame.players.filter(p => p.votedFor === lynchedPlayerId).forEach(voter => {
                            if (suspicionMap[voter.userId]) suspicionMap[voter.userId] += 10;
                         });
                    }
                    (lastVoteEvent.data.tiedPlayerIds || []).forEach((id: string) => {
                         if (suspicionMap[id]) suspicionMap[id] += 5;
                    });
                }
                
                const sortedSuspects = Object.keys(suspicionMap).sort((a,b) => suspicionMap[b] - suspicionMap[a]);
                if (sortedSuspects.length > 0 && Math.random() < 0.6) {
                    return { actionType: 'seer_check', targetId: sortedSuspects[0] };
                }

                return { actionType: 'seer_check', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'doctor':
        case 'guardian': {
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            if (role === 'guardian' && (aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) {
                 return { actionType: 'guardian_protect', targetId: userId };
            }
            return { actionType: role === 'doctor' ? 'doctor_heal' : 'guardian_protect', targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
        }
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
            const nonBoatTargets = potentialTargets.filter(p => !sanitizedGame.boat?.includes(p.userId));
            return { actionType: 'fisherman_catch', targetId: randomTarget(nonBoatTargets) };
        }
        case 'silencer':
        case 'elder_leader':
             return { actionType: role === 'silencer' ? 'silencer_silence' : 'elder_leader_exile', targetId: randomTarget(potentialTargets) };
        case 'seeker_fairy':
            if (!sanitizedGame.fairiesFound) {
                 const sleepingFairy = alivePlayers.find(p => p.role === 'sleeping_fairy');
                 if (sleepingFairy && Math.random() < 0.25) {
                     return { actionType: 'fairy_find', targetId: sleepingFairy.userId };
                 }
                 return { actionType: 'fairy_find', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'witch':
            if (!sanitizedGame.witchFoundSeer) {
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

// ===============================================================================================
// GAME LOGIC
// ===============================================================================================

export async function killPlayer(transaction: Transaction, gameRef: DocumentReference, gameData: Game, playerIdToKill: string | null, cause: GameEvent['type']): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
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
            gameId: newGameData.id!, round: newGameData.currentRound, type: cause,
            message: `${playerToKill.displayName} ha muerto. Su rol era: ${roleDetails[playerToKill.role!]?.name || 'Desconocido'}`,
            data: { killedPlayerIds: [currentIdToKill], revealedRole: playerToKill.role }, createdAt: Timestamp.now(),
        });
        
        if (playerToKill.role === 'seer' && newGameData.settings.seer_apprentice) {
            newGameData.seerDied = true;
            const apprenticeIndex = newGameData.players.findIndex(p => p.role === 'seer_apprentice' && p.isAlive);
            if (apprenticeIndex !== -1) {
                newGameData.players[apprenticeIndex].role = 'seer';
                newGameData.events.push({ id: `evt_transform_apprentice_${Date.now()}`, gameId: newGameData.id!, round: newGameData.currentRound, type: 'player_transformed', message: `¡La Vidente ha muerto! ${newGameData.players[apprenticeIndex].displayName} hereda su don y se convierte en la nueva Vidente.`, data: { targetId: newGameData.players[apprenticeIndex].userId, newRole: 'seer' }, createdAt: Timestamp.now() });
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
                newGameData.players[shapeshifterIndex].shapeshifterTargetId = null; 
                newGameData.events.push({ id: `evt_transform_${Date.now()}_${shifter.userId}`, gameId: newGameData.id!, round: newGameData.currentRound, type: 'player_transformed', message: `¡Has cambiado de forma! Ahora eres: ${roleDetails[newRole]?.name || 'un rol desconocido'}.`, data: { targetId: shifter.userId, newRole: newRole }, createdAt: Timestamp.now() });
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


export async function checkGameOver(gameData: Game, lynchedPlayer?: Player | null): Promise<{ isGameOver: boolean; message: string; winnerCode?: string; winners: Player[] }> {
    if (gameData.status === 'finished') {
        const lastEvent = gameData.events.find(e => e.type === 'game_over');
        return { isGameOver: true, message: lastEvent?.message || "La partida ha terminado.", winnerCode: lastEvent?.data?.winnerCode, winners: lastEvent?.data?.winners || [] };
    }
    
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    
    for (const p of alivePlayers) {
        const roleInstance = createRoleInstance(p.role);
        const hasWon = roleInstance.checkWinCondition({ game: gameData, player: p, players: gameData.players });
        if(hasWon) {
             const winners = gameData.players.filter(p_win => roleInstance.alliance === createRoleInstance(p_win.role).alliance);
             return { isGameOver: true, message: roleInstance.getWinMessage(p), winnerCode: p.role || 'special', winners };
        }
    }

    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch']; 
    
    let sharedWinners: Player[] = [];

    if (lynchedPlayer) {
        if (lynchedPlayer.role === 'drunk_man' && gameData.settings.drunk_man) {
            sharedWinners.push(lynchedPlayer);
        }
        
        if (gameData.settings.executioner) {
            const executioner = gameData.players.find(p => p.role === 'executioner' && p.isAlive);
            if (executioner && executioner.executionerTargetId === lynchedPlayer.userId) {
                sharedWinners.push(executioner);
                if (lynchedPlayer.role === 'drunk_man') {
                     sharedWinners.push(lynchedPlayer);
                }
                return {
                    isGameOver: true,
                    winnerCode: 'executioner',
                    message: `¡El Verdugo ha ganado! Ha logrado su objetivo de que el pueblo linche a ${lynchedPlayer.displayName}.`,
                    winners: sharedWinners,
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
            winners: [...aliveWerewolves, ...sharedWinners]
        };
    }
    
    const threats = alivePlayers.filter(p => (p.role && wolfRoles.includes(p.role)) || p.role === 'vampire' || (p.role === 'sleeping_fairy' && gameData.fairiesFound));
    if (threats.length === 0 && alivePlayers.length > 0) {
        const villageWinners = alivePlayers.filter(p => !p.isCultMember && p.role !== 'sleeping_fairy' && p.role !== 'executioner'); 
        return {
            isGameOver: true,
            winnerCode: 'villagers',
            message: "¡El pueblo ha ganado! Todas las amenazas han sido eliminadas.",
            winners: [...villageWinners, ...sharedWinners]
        };
    }
    
    if (alivePlayers.length === 0) {
        return {
            isGameOver: true,
            winnerCode: 'draw',
            message: "¡Nadie ha sobrevivido a la masacre!",
            winners: sharedWinners
        };
    }

    if (sharedWinners.length > 0 && lynchedPlayer) {
        const winnerRole = roleDetails[lynchedPlayer.role!]?.name || 'un rol especial';
        return { isGameOver: true, message: `¡La partida ha terminado! ${lynchedPlayer.displayName} (${winnerRole}) ha cumplido su objetivo y gana en solitario.`, winners: sharedWinners, winnerCode: 'special' }
    }


    return { isGameOver: false, message: "", winners: [] };
}


export async function processNight(db: Firestore, gameId: string) {
  const gameRef = doc(db, 'games', gameId);
  try {
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef as DocumentReference<Game>);
        if (!gameSnap.exists()) throw new Error("Game not found!");
        
        let game = gameSnap.data()!;
        if (game.phase !== 'night' || game.status === 'finished') {
            return;
        }
        
        const initialPlayerState = JSON.parse(JSON.stringify(game.players));
        const actions = game.nightActions?.filter(a => a.round === game.currentRound) || [];

        const actionPriority: Record<NightActionType, number> = {
            elder_leader_exile: 1, silencer_silence: 1,
            cupid_love: 2, shapeshifter_select: 2, virginia_woolf_link: 2, river_siren_charm: 2,
            priest_bless: 3, guardian_protect: 4, doctor_heal: 5,
            seer_check: 6, witch_hunt: 6, lookout_spy: 6, fairy_find: 6,
            werewolf_kill: 7, hechicera_poison: 7, vampire_bite: 7, fairy_kill: 7, banshee_scream: 7,
            cult_recruit: 8, fisherman_catch: 8,
            hechicera_save: 9, resurrect: 10,
        };

        actions.sort((a, b) => (actionPriority[a.actionType] || 99) - (actionPriority[b.actionType] || 99));

        let pendingDeaths: { playerId: string; cause: GameEvent['type']; }[] = [];
        let protectedThisNight = new Set<string>();
        let blessedThisNight = new Set<string>();
        let hechiceraSaveTarget: string | null = null;
        let hechiceraSaveUsed = false;
        
        for (const action of actions) {
             const player = game.players.find(p => p.userId === action.playerId);
             if (!player || !player.isAlive || player.isExiled) continue;

             const roleInstance = createRoleInstance(player.role);
             const context = { game, players: game.players, player };
             const changes = roleInstance.performNightAction(context, action);

             if(changes?.game) game = { ...game, ...changes.game };
             if(changes?.playerUpdates) {
                 changes.playerUpdates.forEach(update => {
                     const pIndex = game.players.findIndex(p => p.userId === update.userId);
                     if(pIndex !== -1) game.players[pIndex] = { ...game.players[pIndex], ...update };
                 });
             }
             if(changes?.events) game.events.push(...changes.events);
             if(changes?.pendingDeaths) pendingDeaths.push(...changes.pendingDeaths);
        }

        const hechiceraSaveAction = actions.find(a => a.actionType === 'hechicera_save');
        if(hechiceraSaveAction) hechiceraSaveTarget = hechiceraSaveAction.targetId;

        if(hechiceraSaveTarget && pendingDeaths.some(d => d.playerId === hechiceraSaveTarget)) {
            pendingDeaths = pendingDeaths.filter(d => d.playerId !== hechiceraSaveTarget);
            hechiceraSaveUsed = true;
        }
         const hechiceraIdx = game.players.findIndex(p => p.role === 'hechicera');
         if(hechiceraSaveUsed && hechiceraIdx !== -1) {
            game.players[hechiceraIdx].potions!.save = game.currentRound;
         }

        let triggeredHunterId: string | null = null;
        for (const death of pendingDeaths) {
            const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, death.playerId, death.cause);
            game = updatedGame;
            if(newHunterId) triggeredHunterId = newHunterId;
        }

        let gameOverInfo = await checkGameOver(game);
        if (gameOverInfo.isGameOver) {
            game.status = "finished";
            game.phase = "finished";
            game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
            transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events }));
            return;
        }

        if (triggeredHunterId) {
            game.pendingHunterShot = triggeredHunterId;
            transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
            return;
        }
        
        const newlyKilledPlayers = game.players.filter(p => !p.isAlive && initialPlayerState.find(ip => ip.userId === p.userId)?.isAlive);
        let nightMessage = newlyKilledPlayers.length > 0 
            ? `Anoche, el pueblo perdió a ${newlyKilledPlayers.map(p => p.displayName).join(', ')}.`
            : "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
        
        game.events.push({ id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: newlyKilledPlayers.map(p => p.userId), savedPlayerIds: Array.from(protectedThisNight) }, createdAt: Timestamp.now() });

        game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; p.isExiled = false; });
        const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
        
        transaction.update(gameRef, toPlainObject({
            ...game,
            phase: 'day', phaseEndsAt,
            pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null,
        }));
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error in processNight:", error);
    return { success: false, error: error.message };
  }
}

export async function processVotes(db: Firestore, gameId: string) {
  const gameRef = doc(db, 'games', gameId);
  try {
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameRef as DocumentReference<Game>);
      if (!gameDoc.exists()) throw new Error("Game not found.");
      let game = gameDoc.data()!;
      if (game.phase !== 'day') return;

      const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
        transaction.update(gameRef, {
            phase: 'night',
            currentRound: game.currentRound + 1,
            phaseEndsAt
        });
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error in processVotes:", error);
    return { success: false, error: error.message };
  }
}

export async function processJuryVotes(db: Firestore, gameId: string) {
    // Placeholder for jury vote logic
    return { success: true };
}

export async function executeMasterAction(db: Firestore, gameId: string, actionId: string, sourceId: string, targetId: string) {
    // Placeholder for master action logic
    return { success: true };
}
