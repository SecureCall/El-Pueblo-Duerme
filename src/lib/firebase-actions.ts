
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
import { 
  type Game, 
  type Player, 
  type NightAction, 
  type GameEvent, 
  type PlayerRole, 
  type NightActionType, 
  type ChatMessage,
  type AIPlayerPerspective
} from "@/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { roleDetails } from "@/lib/roles";
import { toPlainObject } from "./utils";
import { masterActions } from "./master-actions";
import { createRoleInstance } from "./roles/role-factory";
import { getSdks } from "@/firebase/server-init";


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
  userId: string,
  displayName: string,
  avatarUrl: string,
  gameName: string,
  maxPlayers: number,
  settings: Game['settings']
) {
  try {
    const { firestore } = getSdks();
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
    const gameRef = doc(firestore, "games", gameId);
        
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
        settings,
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
        juryVotes: {},
        masterKillUsed: false,
    };
    
    await setDoc(gameRef, toPlainObject(gameData));
    
    const joinResult = await joinGame(gameId, userId, displayName, avatarUrl);
    if (joinResult.error) {
      console.error(`Game created (${gameId}), but creator failed to join:`, joinResult.error);
      return { error: `La partida se creó, pero no se pudo unir: ${joinResult.error}` };
    }

    return { gameId };
  } catch (error: any) {
    console.error("--- CATASTROPHIC ERROR IN createGame ---", error);
    return { error: `Error de servidor: ${error.message || 'Error desconocido al crear la partida.'}` };
  }
}

export async function joinGame(
  gameId: string,
  userId: string,
  displayName: string,
  avatarUrl: string
) {
  const { firestore } = getSdks();
  const gameRef = doc(firestore, "games", gameId);
  
  try {
    await runTransaction(firestore, async (transaction) => {
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

export async function updatePlayerAvatar(gameId: string, userId: string, newAvatarUrl: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);
    try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found.");

            const gameData = gameDoc.data() as Game;
            const playerIndex = gameData.players.findIndex(p => p.userId === userId);

            if (playerIndex === -1) throw new Error("Player not found in game.");

            const updatedPlayers = [...gameData.players];
            updatedPlayers[playerIndex].avatarUrl = newAvatarUrl;

            transaction.update(gameRef, { players: toPlainObject(updatedPlayers), lastActiveAt: Timestamp.now() });
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

export async function startGame(gameId: string, creatorId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);
    
    try {
        await runTransaction(firestore, async (transaction) => {
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
                    if (target) {
                        const executionerIndex = assignedPlayers.findIndex(p => p.userId === executioner.userId);
                        if (executionerIndex > -1) {
                            assignedPlayers[executionerIndex].executionerTargetId = target.userId;
                        }
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
// ===============================================================================================
// AI ACTIONS LOGIC
// ===============================================================================================

async function triggerAIChat(gameId: string, triggerMessage: string, chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost') {
    const { firestore } = getSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        if (game.status === 'finished') return;

        const aiPlayersToTrigger = game.players.filter(p => p.isAI && p.isAlive);

        for (const aiPlayer of aiPlayersToTrigger) {
             const isAccused = triggerMessage.toLowerCase().includes(aiPlayer.displayName.toLowerCase());
             const shouldTrigger = isAccused ? Math.random() < 0.95 : Math.random() < 0.35;

             if (shouldTrigger) {
                const perspective: AIPlayerPerspective = {
                    game: toPlainObject(game),
                    aiPlayer: toPlainObject(aiPlayer),
                    trigger: triggerMessage,
                    players: toPlainObject(game.players),
                    chatType,
                };

                generateAIChatMessage(perspective).then(async ({ message, shouldSend }) => {
                    if (shouldSend && message) {
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 1000));
                        await sendChatMessage(gameId, aiPlayer.userId, aiPlayer.displayName, message, true);
                    }
                }).catch(aiError => console.error(`Error generating AI chat for ${aiPlayer.displayName}:`, aiError));
            }
        }
    } catch (e) {
        console.error("Error in triggerAIChat:", e);
    }
}

async function triggerPrivateAIChats(gameId: string, triggerMessage: string) {
     const { firestore } = getSdks();
     try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;

        const game = gameDoc.data() as Game;
        if (game.status === 'finished') return;

        const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
        const twinIds = game.twins || [];
        const loverIds = game.lovers || [];

        const wolves = game.players.filter(p => p.isAI && p.isAlive && p.role && wolfRoles.includes(p.role));
        const twins = game.players.filter(p => p.isAI && p.isAlive && twinIds.includes(p.userId));
        const lovers = game.players.filter(p => p.isAI && p.isAlive && loverIds.includes(p.userId));

        const processChat = async (players: Player[], chatType: 'wolf' | 'twin' | 'lovers', sendMessageFn: Function) => {
            for (const aiPlayer of players) {
                if (Math.random() < 0.8) { // Higher chance to talk in private
                    const perspective: AIPlayerPerspective = {
                        game: toPlainObject(game), aiPlayer: toPlainObject(aiPlayer), trigger: triggerMessage,
                        players: toPlainObject(game.players), chatType,
                    };
                    generateAIChatMessage(perspective).then(async ({ message, shouldSend }) => {
                        if (shouldSend && message) {
                            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
                            await sendMessageFn(gameId, aiPlayer.userId, aiPlayer.displayName, message);
                        }
                    }).catch(err => console.error(`Error in private AI chat for ${aiPlayer.displayName}:`, err));
                }
            }
        };

        if (wolves.length > 1) await processChat(wolves, 'wolf', sendWolfChatMessage);
        if (twins.length > 1) await processChat(twins, 'twin', sendTwinChatMessage);
        if (lovers.length > 1) await processChat(lovers, 'lovers', sendLoversChatMessage);

    } catch (e) {
        console.error("Error in triggerPrivateAIChats:", e);
    }
}


export async function runAIActions(gameId: string) {
    const { firestore } = getSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if(game.phase !== 'night' || game.status === 'finished') return;

        const aiPlayers = game.players.filter((p: Player) => p.isAI && p.isAlive && !p.usedNightAbility);
        const alivePlayers = game.players.filter((p: Player) => p.isAlive);
        const deadPlayers = game.players.filter((p: Player) => !p.isAlive);

        await triggerPrivateAIChats(gameId, "La noche ha caído. ¿Cuál es nuestro plan?");

        for (const ai of aiPlayers) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500)); // Stagger AI actions
            const { actionType, targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);

            if (actionType && actionType !== 'NONE' && targetId) {
                await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType as NightActionType, targetId });
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

export async function triggerAIVote(gameId: string) {
    const { firestore } = getSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
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
                 await submitVote(gameId, ai.userId, targetId);
            }
        }

    } catch(e) {
        console.error("Error in triggerAIVote:", e);
    }
}

export async function runAIHunterShot(gameId: string, hunter: Player) {
    const { firestore } = getSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunter.userId) return;

        const alivePlayers = game.players.filter((p: Player) => p.isAlive && p.userId !== hunter.userId);
        
        const { targetId } = getDeterministicAIAction(hunter, game, alivePlayers, []);

        if (targetId) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            await submitHunterShot(gameId, hunter.userId, targetId);
        } else {
             console.error(`AI Hunter ${hunter.displayName} could not find a target to shoot.`);
        }

    } catch(e) {
         console.error("Error in runAIHunterShot:", e);
    }
}

export const getDeterministicAIAction = (
    aiPlayer: Player,
    game: Game,
    alivePlayers: Player[],
    deadPlayers: Player[],
): { actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE', targetId: string } => {
    const { role, userId } = aiPlayer;
    const { currentRound, nightActions = [] } = game;
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
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
            const target = availableTargets.splice(randomIndex, 1)[0];
            if (target) {
                selectedTargets.push(target.userId);
            }
        }
        return selectedTargets.join('|');
    };
    
    const getSuspicionScores = (): Record<string, number> => {
        const scores: Record<string, number> = {};
        alivePlayers.forEach(p => { if (p.userId !== aiPlayer.userId) scores[p.userId] = 1; });

        const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === currentRound - 1);
        if (lastVoteEvent?.data) {
            const votes: Record<string, number> = {};
            game.players.forEach(p => {
                if(p.isAlive && p.votedFor) {
                    votes[p.votedFor] = (votes[p.votedFor] || 0) + 1;
                }
            });
            for(const targetId in votes) {
                if(scores[targetId]) scores[targetId] += votes[targetId] * 5;
            }
            (lastVoteEvent.data.tiedPlayerIds || []).forEach((id: string) => {
                 if (scores[id]) scores[id] += 10;
            });
        }
        return scores;
    };
    
    const getMostSuspiciousTarget = (targets: Player[]): string => {
        const scores = getSuspicionScores();
        const validTargetIds = new Set(targets.map(t => t.userId));
        
        let highestScore = -1;
        let mostSuspicious: string[] = [];

        for(const userId in scores) {
            if (validTargetIds.has(userId)) {
                if (scores[userId] > highestScore) {
                    highestScore = scores[userId];
                    mostSuspicious = [userId];
                } else if (scores[userId] === highestScore) {
                    mostSuspicious.push(userId);
                }
            }
        }
        
        if (mostSuspicious.length > 0) {
            return mostSuspicious[Math.floor(Math.random() * mostSuspicious.length)];
        }
        return randomTarget(targets);
    };


    if (game.phase === 'day') {
        if (aiPlayer.role === 'executioner' && aiPlayer.executionerTargetId) {
            const targetIsAlive = alivePlayers.some(p => p.userId === aiPlayer.executionerTargetId);
            if (targetIsAlive && Math.random() < 0.75) {
                return { actionType: 'VOTE', targetId: aiPlayer.executionerTargetId };
            }
        }
        return { actionType: 'VOTE', targetId: getMostSuspiciousTarget(potentialTargets) };
    }

    if (game.phase === 'hunter_shot' && game.pendingHunterShot === userId) {
        return { actionType: 'SHOOT', targetId: getMostSuspiciousTarget(potentialTargets) };
    }

    if (game.phase !== 'night' || aiPlayer.isExiled) {
        return { actionType: 'NONE', targetId: '' };
    }

    if (canFairiesKill) {
        const nonFairies = potentialTargets.filter(p => p.role !== 'seeker_fairy' && p.role !== 'sleeping_fairy');
        return { actionType: 'fairy_kill', targetId: getMostSuspiciousTarget(nonFairies) };
    }

    switch (role) {
        case 'werewolf':
        case 'wolf_cub': {
             const wolfActions = nightActions.filter(a => a.round === currentRound && a.actionType === 'werewolf_kill' && a.playerId !== userId && wolfRoles.includes(game.players.find(p=>p.userId === a.playerId)?.role || null));
             if (wolfActions.length > 0 && Math.random() < 0.8) { 
                 const leaderAction = wolfActions[0];
                 if (leaderAction && leaderAction.targetId) {
                    return { actionType: 'werewolf_kill', targetId: leaderAction.targetId };
                 }
             }

            const nonWolves = potentialTargets.filter(p => {
                if (p.role && wolfRoles.includes(p.role)) return false;
                if (game.witchFoundSeer && p.role === 'witch') return false; 
                return true;
            });
            const killCount = wolfCubRevengeActive ? 2 : 1;
            const target = getMostSuspiciousTarget(nonWolves);
            return { actionType: 'werewolf_kill', targetId: killCount > 1 ? `${target}|${randomTarget(nonWolves.filter(p => p.userId !== target))}` : target };
        }
        case 'seer':
        case 'seer_apprentice':
            if (role === 'seer' || apprenticeIsActive) {
                const knownRoles = new Set(nightActions.filter(a => a.playerId === userId).map(a => a.targetId));
                const unknownTargets = potentialTargets.filter(p => !knownRoles.has(p.userId));
                return { actionType: 'seer_check', targetId: getMostSuspiciousTarget(unknownTargets.length > 0 ? unknownTargets : potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'doctor':
        case 'guardian': {
             let healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
             if (role === 'guardian' && (aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) {
                 return { actionType: 'guardian_protect', targetId: userId };
             }
             if (healableTargets.length === 0) healableTargets = potentialTargets;
             return { actionType: role === 'doctor' ? 'doctor_heal' : 'guardian_protect', targetId: getMostSuspiciousTarget(healableTargets) };
        }
        case 'priest':
            if (!aiPlayer.priestSelfHealUsed && Math.random() < 0.2) return { actionType: 'priest_bless', targetId: userId };
            return { actionType: 'priest_bless', targetId: getMostSuspiciousTarget(potentialTargets) };
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
             return { actionType: role === 'silencer' ? 'silencer_silence' : 'elder_leader_exile', targetId: getMostSuspiciousTarget(potentialTargets) };
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
             if (hasPoison) {
                 return { actionType: 'hechicera_poison', targetId: getMostSuspiciousTarget(potentialTargets) };
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

        const playerIndex = newGameData.players.findIndex((p: Player) => p.userId === currentIdToKill);
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
            
            if (otherPlayer && otherPlayer.isAlive && !alreadyProcessed.has(otherId!) && !killQueue.includes(otherId!)) {
                killQueue.push(otherId!);
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
        if (!p.role) continue;
        const roleInstance = createRoleInstance(p.role);
        if (roleInstance.checkWinCondition({ game: gameData, player: p, players: gameData.players })) {
             const winners = gameData.players.filter(p_win => {
                if (p.role === 'cupid' && p.isLover) { // Si cupido es un enamorado, gana con los enamorados
                    return p_win.isLover;
                }
                if (p.role === 'twin' && gameData.twins?.includes(p.userId)) { // Los gemelos ganan con su alianza
                    const playerInstance = createRoleInstance(p.role!);
                    const twinInstance = createRoleInstance(p_win.role!);
                    return playerInstance.alliance === twinInstance.alliance;
                }
                 return p_win.role && createRoleInstance(p_win.role).alliance === roleInstance.alliance
            });
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
            winners: [...gameData.players.filter(p => p.role && wolfRoles.includes(p.role!)), ...sharedWinners]
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


export async function processNight(gameId: string) {
  const { firestore } = getSdks();
  const gameRef = doc(firestore, 'games', gameId);
  try {
    await runTransaction(firestore, async (transaction) => {
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
            if(game.players[hechiceraIdx].potions)
                game.players[hechiceraIdx].potions!.save = game.currentRound;
         }

        let triggeredHunterId: string | null = null;
        for (const death of pendingDeaths) {
            const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef as DocumentReference<Game>, game, death.playerId, death.cause);
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
        
        const protectedThisNight = new Set<string>();
        actions.filter(a => a.actionType === 'doctor_heal' || a.actionType === 'guardian_protect' || a.actionType === 'priest_bless' || (a.actionType === 'hechicera_save' && hechiceraSaveUsed))
            .forEach(a => protectedThisNight.add(a.targetId));

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

export async function processVotes(gameId: string) {
  const { firestore } = getSdks();
  const gameRef = doc(firestore, 'games', gameId);
  try {
    await runTransaction(firestore, async (transaction) => {
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

export async function processJuryVotes(gameId: string) {
    // Placeholder for jury vote logic
    return { success: true };
}

export async function executeMasterAction(gameId: string, actionId: string, sourceId: string, targetId: string) {
    // Placeholder for master action logic
    return { success: true };
}

export async function getSeerResult(gameId: string, seerId: string, targetId: string) {
    const { firestore } = getSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
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

export async function submitHunterShot(gameId: string, hunterId: string, targetId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;

    try {
        await runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data()!;

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId || game.status === 'finished') {
                return;
            }

            const hunterPlayer = game.players.find(p => p.userId === hunterId);
            const targetPlayer = game.players.find(p => p.userId === targetId);

            if (!hunterPlayer || !targetPlayer) {
                console.error("Hunter or target not found for shot.");
                return;
            }

            let { updatedGame, triggeredHunterId } = await killPlayer(transaction, gameRef as DocumentReference<Game>, game, targetId, 'hunter_shot');
            game = updatedGame;

            game.events.push({
                id: `evt_huntershot_${Date.now()}`, gameId, round: game.currentRound, type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
                createdAt: Timestamp.now(), data: { killedPlayerIds: [targetId] },
            });

            if (triggeredHunterId) {
                game.pendingHunterShot = triggeredHunterId;
                transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: triggeredHunterId }));
                return;
            }

            const gameOverInfo = await checkGameOver(game);
            if (gameOverInfo.isGameOver) {
                game.status = "finished";
                game.phase = "finished";
                game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
                transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events }));
                return;
            }

            const hunterDeathEvent = [...game.events].sort((a, b) => toPlainObject(b.createdAt) - toPlainObject(a.createdAt)).find(e => (e.data?.killedPlayerIds?.includes(hunterId) || e.data?.lynchedPlayerId === hunterId));

            const nextPhase = hunterDeathEvent?.type === 'vote_result' ? 'night' : 'day';
            const currentRound = game.currentRound;
            const newRound = nextPhase === 'night' ? currentRound + 1 : currentRound;

            game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; });
            const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);

            transaction.update(gameRef, toPlainObject({
                players: game.players, events: game.events, phase: nextPhase, phaseEndsAt,
                currentRound: newRound, pendingHunterShot: null
            }));
        });
        return { success: true };
    } catch (error: any) {
        console.error("CRITICAL ERROR in submitHunterShot: ", error);
        return { success: false, error: error.message || "No se pudo registrar el disparo." };
    }
}

export async function submitVote(gameId: string, voterId: string, targetId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
    
    try {
       await runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            
            let game = gameSnap.data()!;
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
                await triggerAIChat(gameId, `${voter.displayName} ha votado por ${target.displayName}.`, 'public');
            }
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error submitting vote: ", error);
        return { error: "No se pudo registrar tu voto." };
    }
}

export async function sendChatMessage(
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    isFromAI: boolean = false
) {
    const { firestore } = getSdks();
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(firestore, 'games', gameId);

    try {
        let latestGame: Game | null = null;
        await runTransaction(firestore, async (transaction) => {
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
            await triggerAIChat(gameId, triggerMessage, 'public');
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

async function sendSpecialChatMessage(
    gameId: string,
    senderId: string,
    senderName: string,
    text: string,
    chatType: 'wolf' | 'fairy' | 'lovers' | 'twin' | 'ghost'
) {
    const { firestore } = getSdks();
    if (!text?.trim()) {
        return { success: false, error: 'El mensaje no puede estar vacío.' };
    }

    const gameRef = doc(firestore, 'games', gameId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            
            const sender = game.players.find(p => p.userId === senderId);
            if (!sender) throw new Error("Sender not found.");

            const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
            const fairyRoles: PlayerRole[] = ['seeker_fairy', 'sleeping_fairy'];

            let canSend = false;
            let chatField: keyof Game = 'chatMessages';

            switch (chatType) {
                case 'wolf':
                    if (sender.role && wolfRoles.includes(sender.role)) {
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
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export const sendWolfChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'wolf');
export const sendFairyChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'fairy');
export const sendLoversChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'lovers');
export const sendTwinChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'twin');
export const sendGhostChatMessage = (gameId: string, senderId: string, senderName: string, text: string) => sendSpecialChatMessage(gameId, senderId, senderName, text, 'ghost');


export async function resetGame(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);

    try {
        await runTransaction(firestore, async (transaction) => {
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
                fairiesFound: false, fairyKillUsed: false,
            }));
        });
        return { success: true };
    } catch (e: any) {
        console.error("Error resetting game:", e);
        return { error: e.message || 'No se pudo reiniciar la partida.' };
    }
}

export async function submitNightAction(action: Omit<NightAction, 'createdAt' | 'round'> & { round: number }) {
  const { firestore } = getSdks();
  const { gameId, playerId, actionType, targetId } = action;
  const gameRef = doc(firestore, 'games', gameId);
  try {
    await runTransaction(firestore, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        
        let game = gameSnap.data() as Game;
        if (game.phase !== 'night' || game.status === 'finished') return;

        const player = game.players.find(p => p.userId === playerId);
        if (!player || !player.isAlive) throw new Error("Jugador no válido o muerto.");
        if (player.isExiled) throw new Error("Has sido exiliado esta noche y no puedes usar tu habilidad.");
        if (player.usedNightAbility) return;
        
        const playerIndex = game.players.findIndex(p => p.userId === action.playerId);
        
        if (playerIndex === -1) {
            console.error(`Critical error: Player ${action.playerId} not found in game ${gameId} during night action.`);
            return;
        }

        const roleInstance = createRoleInstance(player.role);
        const context = { game, player, players: game.players };
        const changes = roleInstance.performNightAction(context, action);

        if(changes?.game) game = { ...game, ...changes.game };
        if(changes?.playerUpdates) {
             changes.playerUpdates.forEach(update => {
                const pIndex = game.players.findIndex(p => p.userId === update.userId);
                if(pIndex !== -1) game.players[pIndex] = { ...game.players[pIndex], ...update };
            });
        }
        
        game.players[playerIndex].usedNightAbility = true;
        const newAction: NightAction = { ...action, createdAt: Timestamp.now() };
        game.nightActions = [...(game.nightActions || []), newAction];
        
        transaction.update(gameRef, toPlainObject(game));
    });

    return { success: true };

  } catch (error: any) {
    console.error("Error submitting night action: ", error);
    return { success: false, error: error.message || "No se pudo registrar tu acción." };
  }
}

export async function submitJuryVote(gameId: string, jurorId: string, targetId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);
    try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            if (game.phase !== 'jury_voting') throw new Error("No es momento de votar como jurado.");
            const juror = game.players.find(p => p.userId === jurorId);
            if (!juror || juror.isAlive) throw new Error("Solo los muertos pueden ser jurado.");
            if (game.juryVotes && game.juryVotes[jurorId]) throw new Error("Ya has votado.");

            const updatedJuryVotes = { ...(game.juryVotes || {}), [jurorId]: targetId };
            transaction.update(gameRef, { juryVotes: updatedJuryVotes });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting jury vote:", error);
        return { success: false, error: error.message };
    }
}
