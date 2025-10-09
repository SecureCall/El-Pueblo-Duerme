
"use server";

import { redirect } from "next/navigation";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  query,
  where,
  getDocs,
  writeBatch,
  Timestamp,
  addDoc,
  increment,
  runTransaction,
  Transaction,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Player, NightAction, GameEvent, TakeAITurnInput } from "@/types";
import { takeAITurn } from "@/ai/flows/take-ai-turn-flow";

function generateGameId(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createGame(
  userId: string,
  displayName: string,
  gameName: string,
  maxPlayers: number,
  fillWithAI: boolean
) {
  const gameId = generateGameId();
  const gameRef = doc(db, "games", gameId);

  const werewolfCount = Math.max(1, Math.floor(maxPlayers / 5));

  const gameData: Game = {
    id: gameId,
    name: gameName,
    status: "waiting",
    phase: "night",
    creator: userId,
    players: [userId],
    maxPlayers: maxPlayers,
    createdAt: Timestamp.now(),
    currentRound: 0,
    settings: {
      werewolves: werewolfCount,
      seer: true,
      doctor: true,
      hunter: true,
      cupid: true,
      fillWithAI,
    },
  };

  await setDoc(gameRef, gameData);

  const playerRef = doc(db, "players", `${userId}_${gameId}`);
  const playerData: Player = {
    userId: userId,
    gameId: gameId,
    role: null,
    isAlive: true,
    votedFor: null,
    displayName: displayName,
    joinedAt: Timestamp.now(),
  };

  await setDoc(playerRef, playerData);

  return { gameId };
}

export async function joinGame(
  gameId: string,
  userId: string,
  displayName: string
) {
  const gameRef = doc(db, "games", gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    return { error: "Partida no encontrada." };
  }

  const game = gameSnap.data() as Game;

  if (game.status !== "waiting") {
    return { error: "La partida ya ha comenzado." };
  }

  if (game.players.length >= game.maxPlayers) {
    return { error: "La partida está llena." };
  }
  
  if (game.players.includes(userId)) {
    return { success: true }; // Already in game
  }

  await updateDoc(gameRef, {
    players: arrayUnion(userId),
  });

  const playerRef = doc(db, "players", `${userId}_${gameId}`);
  const playerData: Player = {
    userId: userId,
    gameId: gameId,
    role: null,
    isAlive: true,
    votedFor: null,
    displayName: displayName,
    joinedAt: Timestamp.now(),
  };
  await setDoc(playerRef, playerData);
  return { success: true };
}

const generateRoles = (playerCount: number, settings: Game['settings']) => {
    const roles: Player['role'][] = [];
    
    for (let i = 0; i < settings.werewolves; i++) {
        roles.push('werewolf');
    }
    if (settings.seer) roles.push('seer');
    if (settings.doctor) roles.push('doctor');
    if (settings.hunter) roles.push('hunter');
    if (settings.cupid) roles.push('cupid');
    
    while (roles.length < playerCount) {
        roles.push('villager');
    }
    
    // Shuffle roles
    return roles.sort(() => Math.random() - 0.5);
};

const AI_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jessie", "Jamie", "Kai", "Rowan"];

export async function startGame(gameId: string, creatorId: string) {
    const gameRef = doc(db, 'games', gameId);
    const batch = writeBatch(db);

    try {
        const gameSnap = await getDoc(gameRef);

        if (!gameSnap.exists()) {
            return { error: 'Partida no encontrada.' };
        }

        const game = gameSnap.data() as Game;

        if (game.creator !== creatorId) {
            return { error: 'Solo el creador puede iniciar la partida.' };
        }

        if (game.status !== 'waiting') {
            return { error: 'La partida ya ha comenzado.' };
        }

        const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId));
        const playersSnap = await getDocs(playersQuery);
        const players = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Player }));

        const humanPlayerCount = players.length;
        let finalPlayers = [...players];
        let finalPlayerIds = players.map(p => p.userId);

        if (game.settings.fillWithAI && humanPlayerCount < game.maxPlayers) {
            const aiPlayerCount = game.maxPlayers - humanPlayerCount;
            const availableAINames = AI_NAMES.filter(name => !players.some(p => p.displayName === name));

            for (let i = 0; i < aiPlayerCount; i++) {
                const aiUserId = `ai_${Date.now()}_${i}`;
                const aiName = availableAINames[i % availableAINames.length] || `Bot ${i + 1}`;
                
                const aiPlayerData: Player = {
                    userId: aiUserId,
                    gameId: gameId,
                    role: null,
                    isAlive: true,
                    votedFor: null,
                    displayName: aiName,
                    joinedAt: Timestamp.now(),
                    isAI: true,
                };

                const aiPlayerRef = doc(db, 'players', `${aiUserId}_${gameId}`);
                batch.set(aiPlayerRef, aiPlayerData);
                finalPlayers.push({ id: aiPlayerRef.id, ...aiPlayerData });
                finalPlayerIds.push(aiUserId);
            }
            
            batch.update(gameRef, {
                players: finalPlayerIds,
            });
        }
        
        if (finalPlayers.length < 3) {
            return { error: 'Se necesitan al menos 3 jugadores para comenzar.' };
        }
        
        const newRoles = generateRoles(finalPlayers.length, game.settings);

        finalPlayers.forEach((player, index) => {
            const playerRef = doc(db, 'players', player.id);
            batch.update(playerRef, { role: newRoles[index] });
        });

        batch.update(gameRef, {
            status: 'in_progress',
            phase: 'role_reveal',
            currentRound: 1,
        });

        await batch.commit();

        return { success: true };

    } catch (e: any) {
        console.error("Error starting game:", e);
        return { error: e.message || 'Error al iniciar la partida.' };
    }
}

export async function submitNightAction(action: Omit<NightAction, 'createdAt' | 'round'> & { round: number }) {
  try {
    const actionRef = collection(db, 'night_actions');

    if (action.actionType === 'doctor_heal') {
        const targetPlayerRef = doc(db, 'players', `${action.targetId}_${action.gameId}`);
        const playerDoc = await getDoc(targetPlayerRef);
        if(playerDoc.exists() && playerDoc.data().lastHealedRound === action.round - 1) {
            return { success: false, error: "No puedes proteger a la misma persona dos noches seguidas." };
        }
    }
    
    // Check for existing action for this player and round to prevent duplicates
    const q = query(actionRef, 
      where('gameId', '==', action.gameId), 
      where('round', '==', action.round), 
      where('playerId', '==', action.playerId)
    );
    const existingActions = await getDocs(q);
    
    // If an action already exists, overwrite it (useful for werewolves changing vote)
    if (!existingActions.empty) {
        const batch = writeBatch(db);
        existingActions.forEach(doc => {
            // Only delete if it's the same type of action being submitted
            // or if it's a werewolf kill vote (so they can change their mind)
            if (doc.data().actionType === action.actionType || action.actionType === 'werewolf_kill') {
               batch.delete(doc.ref);
            }
        });
        await batch.commit();
    }
    
    await addDoc(actionRef, {
      ...action,
      createdAt: Timestamp.now(),
    });

    if (action.actionType === 'doctor_heal') {
        const targetPlayerRef = doc(db, 'players', `${action.targetId}_${action.gameId}`);
        await updateDoc(targetPlayerRef, {
            lastHealedRound: action.round
        });
    }
    
    await checkEndNightEarly(action.gameId);

    return { success: true };
  } catch (error) {
    console.error("Error submitting night action: ", error);
    return { error: "No se pudo registrar tu acción." };
  }
}

export async function submitCupidAction(gameId: string, cupidId: string, target1Id: string, target2Id: string) {
    try {
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
            lovers: [target1Id, target2Id]
        });
        
        await submitNightAction({
            gameId,
            round: 1,
            playerId: cupidId,
            actionType: 'cupid_enchant',
            targetId: `${target1Id}|${target2Id}`,
        });

        return { success: true };
    } catch (error) {
        console.error("Error submitting cupid action: ", error);
        return { error: "No se pudo registrar tu acción." };
    }
}


async function killPlayer(
  transaction: Transaction,
  gameId: string,
  playerId: string,
  gameData: Game,
  playersData: Player[]
): Promise<{ killedIds: string[], hunterId: string | null }> {
  const playerToKill = playersData.find(p => p.userId === playerId && p.isAlive);
  if (!playerToKill) return { killedIds: [], hunterId: null };

  const killedPlayerIds: string[] = [playerId];
  let hunterTriggeredId: string | null = null;
  
  if (playerToKill.role === 'hunter') {
    hunterTriggeredId = playerId;
  } else {
    const playerRef = doc(db, 'players', `${playerId}_${gameId}`);
    transaction.update(playerRef, { isAlive: false });
  }

  if (gameData.lovers && gameData.lovers.includes(playerId)) {
    const otherLoverId = gameData.lovers.find(id => id !== playerId)!;
    const otherLoverPlayer = playersData.find(p => p.userId === otherLoverId);
    if (otherLoverPlayer && otherLoverPlayer.isAlive) {
      if (otherLoverPlayer.role === 'hunter') {
         hunterTriggeredId = otherLoverId;
      } else {
        const otherLoverRef = doc(db, 'players', `${otherLoverId}_${gameId}`);
        transaction.update(otherLoverRef, { isAlive: false });
        killedPlayerIds.push(otherLoverId);
      }
      
      const killedPlayer = playersData.find(p => p.userId === playerId)!;
      const eventLogRef = doc(collection(db, 'game_events'));
      transaction.set(eventLogRef, {
          gameId,
          round: gameData.currentRound,
          type: 'lover_death',
          message: `${otherLoverPlayer.displayName} no pudo soportar la pérdida de ${killedPlayer.displayName} y ha muerto de desamor.`,
          createdAt: Timestamp.now(),
      });
    }
  }

  if (hunterTriggeredId) {
    transaction.update(doc(db, 'games', gameId), { pendingHunterShot: hunterTriggeredId, phase: 'hunter_shot' });
    return { killedIds: [], hunterId: hunterTriggeredId };
  }

  return { killedIds: killedPlayerIds, hunterId: null };
}

async function checkGameOver(gameId: string, transaction: Transaction, lovers?: [string, string]): Promise<boolean> {
    const gameRef = doc(db, 'games', gameId);
    const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId));
    
    const playersSnap = await transaction.get(playersQuery);
    const players = playersSnap.docs.map(doc => doc.data() as Player);

    const alivePlayers = players.filter(p => p.isAlive);
    const aliveWerewolves = alivePlayers.filter(p => p.isAlive && p.role === 'werewolf');
    const aliveVillagers = alivePlayers.filter(p => p.isAlive && p.role !== 'werewolf');

    let gameOver = false;
    let message = "";
    let winners: string[] = [];

    // 1. Check for Lovers' victory first, as it's a special condition.
    if (lovers) {
        const aliveLovers = alivePlayers.filter(p => lovers.includes(p.userId));
        // If the only players left alive are the lovers, they win.
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length >= 2) {
            gameOver = true;
            const lover1 = players.find(p => p.userId === lovers[0]);
            const lover2 = players.find(p => p.userId === lovers[1]);
            message = `¡Los enamorados han ganado! Desafiando a sus bandos, ${lover1?.displayName} y ${lover2?.displayName} han triunfado solos contra el mundo.`;
            winners = lovers;
        }
    }
    
    // 2. If lovers haven't won, check for other conditions.
    if (!gameOver) {
        if (aliveWerewolves.length === 0) {
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
        const gameData = (await transaction.get(gameRef)).data()
        transaction.update(gameRef, { status: 'finished', phase: 'finished' });
        const logRef = doc(collection(db, 'game_events'));
        transaction.set(logRef, {
            gameId,
            round: gameData?.currentRound,
            type: 'game_over',
            message: message,
            data: { winners },
            createdAt: Timestamp.now(),
        });
    }

    return gameOver;
}

export async function processNight(gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found!");
            const game = gameSnap.data() as Game;

            if (game.phase !== 'night' || game.status !== 'in_progress') return;

            const playersSnap = await transaction.get(query(collection(db, 'players'), where('gameId', '==', gameId)));
            const playersData = playersSnap.docs.map(doc => doc.data() as Player);

            const actionsQuery = query(collection(db, 'night_actions'),
                where('gameId', '==', gameId),
                where('round', '==', game.currentRound)
            );
            const actionsSnap = await transaction.get(actionsQuery); 
            const actions = actionsSnap.docs.map(doc => doc.data() as NightAction);

            let killedPlayerId: string | null = null;
            let savedPlayerId: string | null = null;

            const doctorAction = actions.find(a => a.actionType === 'doctor_heal');
            if (doctorAction) savedPlayerId = doctorAction.targetId;

            const werewolfVotes = actions.filter(a => a.actionType === 'werewolf_kill');
            if (werewolfVotes.length > 0) {
                const voteCounts = werewolfVotes.reduce((acc, vote) => {
                    acc[vote.targetId] = (acc[vote.targetId] || 0) + 1;
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
                
                if (mostVotedPlayerIds.length > 0) {
                    killedPlayerId = mostVotedPlayerIds[Math.floor(Math.random() * mostVotedPlayerIds.length)];
                }
            }

            let eventLogMessage = "La noche transcurre en un inquietante silencio.";
            let nightKillResult: { killedIds: string[], hunterId: string | null } = { killedIds: [], hunterId: null };

            if (killedPlayerId && killedPlayerId !== savedPlayerId) {
                const killedPlayer = playersData.find(p => p.userId === killedPlayerId)!;
                eventLogMessage = `${killedPlayer.displayName} fue atacado en la noche y no ha sobrevivido.`;
                nightKillResult = await killPlayer(transaction, gameId, killedPlayer.userId, game, playersData);
            } else if (killedPlayerId && killedPlayerId === savedPlayerId) {
                eventLogMessage = "Se escuchó un grito en la noche, ¡pero el doctor llegó justo a tiempo!";
            }
            
            const logRef = doc(collection(db, 'game_events'));
            transaction.set(logRef, {
                gameId,
                round: game.currentRound,
                type: 'night_result',
                message: eventLogMessage,
                data: { killedPlayerId: nightKillResult.killedIds.length > 0 ? killedPlayerId : null, savedPlayerId },
                createdAt: Timestamp.now(),
            });

            if (nightKillResult.hunterId) return; 

            if (nightKillResult.killedIds.length > 0) {
                 const isGameOver = await checkGameOver(gameId, transaction, game.lovers);
                 if (isGameOver) return;
            }

            playersSnap.forEach(playerDoc => {
                transaction.update(playerDoc.ref, { votedFor: null });
            });

            transaction.update(gameRef, { phase: 'day' });
        });
        return { success: true };
    } catch (error) {
        console.error("Error processing night:", error);
        return { error: "Hubo un problema al procesar la noche." };
    }
}


export async function submitVote(gameId: string, voterId: string, targetId: string) {
    try {
        const playerRef = doc(db, 'players', `${voterId}_${gameId}`);
        await updateDoc(playerRef, { votedFor: targetId });
        await checkEndDayEarly(gameId);
        return { success: true };
    } catch (error) {
        console.error("Error submitting vote: ", error);
        return { error: "No se pudo registrar tu voto." };
    }
}

export async function processVotes(gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            const game = gameSnap.data() as Game;

            if (game.phase !== 'day' || game.status !== 'in_progress') return;

            const playersSnap = await transaction.get(query(collection(db, 'players'), where('gameId', '==', gameId)));
            const playersData = playersSnap.docs.map(doc => doc.data() as Player);
            const alivePlayers = playersData.filter(p => p.isAlive);

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
            let voteKillResult: { killedIds: string[], hunterId: string | null } = { killedIds: [], hunterId: null };


            if (mostVotedPlayerIds.length === 1 && maxVotes > 0) {
                lynchedPlayerId = mostVotedPlayerIds[0];
                const lynchedPlayer = playersData.find(p => p.userId === lynchedPlayerId)!;
                eventMessage = `El pueblo ha decidido. ${lynchedPlayer.displayName} ha sido linchado.`;
                voteKillResult = await killPlayer(transaction, gameId, lynchedPlayer.userId, game, playersData);

            } else if (mostVotedPlayerIds.length > 1) {
                eventMessage = "La votación resultó en un empate. Nadie fue linchado hoy.";
            } else {
                eventMessage = "El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.";
            }

            const logRef = doc(collection(db, 'game_events'));
            transaction.set(logRef, {
                gameId,
                round: game.currentRound,
                type: 'vote_result',
                message: eventMessage,
                data: { lynchedPlayerId },
                createdAt: Timestamp.now(),
            });
            
            if (voteKillResult.hunterId) return;

            if (voteKillResult.killedIds.length > 0) {
                 const isGameOver = await checkGameOver(gameId, transaction, game.lovers);
                 if (isGameOver) return;
            }
            
            transaction.update(gameRef, {
                phase: 'night',
                currentRound: increment(1),
            });
        });

        return { success: true };
    } catch (error) {
        console.error("Error processing votes:", error);
        return { error: "Hubo un problema al procesar la votación." };
    }
}

export async function getSeerResult(gameId: string, seerId: string, targetId: string) {
  try {
    const seerPlayerRef = doc(db, 'players', `${seerId}_${gameId}`);
    const seerPlayerSnap = await getDoc(seerPlayerRef);

    if (!seerPlayerSnap.exists() || seerPlayerSnap.data()?.role !== 'seer') {
      throw new Error("No eres el vidente.");
    }
    
    const targetPlayerRef = doc(db, 'players', `${targetId}_${gameId}`);
    const targetPlayerSnap = await getDoc(targetPlayerRef);

    if (!targetPlayerSnap.exists()) {
      throw new Error("Jugador objetivo no encontrado.");
    }

    const targetPlayer = targetPlayerSnap.data() as Player;
    const isWerewolf = targetPlayer.role === 'werewolf';

    return { 
        success: true, 
        isWerewolf, 
        targetName: targetPlayer.displayName 
    };

  } catch (error: any) {
    console.error("Error getting seer result: ", error);
    return { success: false, error: error.message };
  }
}


export async function submitHunterShot(gameId: string, hunterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            const game = gameSnap.data() as Game;

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId) {
                throw new Error("No es tu momento de disparar.");
            }
            
            const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId));
            const playersSnap = await transaction.get(playersQuery);
            const playersData = playersSnap.docs.map(doc => doc.data() as Player);

            const hunterPlayerRef = doc(db, 'players', `${hunterId}_${gameId}`);
            transaction.update(hunterPlayerRef, { isAlive: false });

            const hunterPlayer = playersData.find(p => p.userId === hunterId)!;
            const targetPlayer = playersData.find(p => p.userId === targetId)!;

            const hunterEventRef = doc(collection(db, 'game_events'));
            transaction.set(hunterEventRef, {
                gameId,
                round: game.currentRound,
                type: 'hunter_shot',
                message: `En su último aliento, ${hunterPlayer.displayName} dispara y se lleva consigo a ${targetPlayer.displayName}.`,
                createdAt: Timestamp.now(),
            });

            const targetKillResult = await killPlayer(transaction, gameId, targetId, game, playersData);
            
            // If the hunter shot another hunter, we need to resolve that before continuing
            if (targetKillResult.hunterId) {
                 transaction.update(gameRef, { 
                    pendingHunterShot: targetKillResult.hunterId, 
                    phase: 'hunter_shot' 
                });
                return; // End transaction here, the next hunter will trigger a new one
            }

            const isGameOver = await checkGameOver(gameId, transaction, game.lovers);
            if (isGameOver) return;
            
            // This logic needs to know if the hunter died during the day or night
            // A simple way is to check if it's round 0, which means pre-game, or if the vote just happened.
            // A better approach is needed, maybe store originating phase. For now, assume it goes to the opposite phase.
            // Let's check a vote event for the same round to decide.
            const voteEventQuery = query(collection(db, 'game_events'), 
                where('gameId', '==', gameId),
                where('round', '==', game.currentRound),
                where('type', '==', 'vote_result')
            );
            const voteEventSnap = await transaction.get(voteEventQuery);
            
            const diedDuringDay = !voteEventSnap.empty;
            const nextPhase = diedDuringDay ? 'night' : 'day';

            transaction.update(gameRef, {
                phase: nextPhase,
                pendingHunterShot: null,
                currentRound: nextPhase === 'night' ? increment(1) : game.currentRound,
            });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting hunter shot: ", error);
        return { error: error.message || "No se pudo registrar el disparo." };
    }
}

async function checkEndNightEarly(gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) return;

    const game = gameDoc.data() as Game;
    if (game.phase !== 'night') return;

    const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId), where('isAlive', '==', true));
    const playersSnap = await getDocs(playersQuery);
    const alivePlayers = playersSnap.docs.map(p => p.data() as Player);
    
    const nightActionsQuery = query(collection(db, 'night_actions'), where('gameId', '==', gameId), where('round', '==', game.currentRound));
    const nightActionsSnap = await getDocs(nightActionsQuery);
    const submittedActions = nightActionsSnap.docs.map(a => a.data() as NightAction);

    const requiredPlayerIds = new Set<string>();

    const werewolves = alivePlayers.filter(p => p.role === 'werewolf');
    if (werewolves.length > 0) {
        werewolves.forEach(w => requiredPlayerIds.add(w.userId));
    }

    const seer = alivePlayers.find(p => p.role === 'seer');
    if (seer) requiredPlayerIds.add(seer.userId);
    
    const doctor = alivePlayers.find(p => p.role === 'doctor');
    if (doctor) requiredPlayerIds.add(doctor.userId);
    
    if (game.currentRound === 1) {
        const cupid = alivePlayers.find(p => p.role === 'cupid');
        if (cupid) requiredPlayerIds.add(cupid.userId);
    }
    
    const submittedPlayerIds = new Set(submittedActions.map(a => a.playerId));

    const allActionsSubmitted = Array.from(requiredPlayerIds).every(id => submittedPlayerIds.has(id));

    if (allActionsSubmitted) {
        await processNight(gameId);
    }
}

async function checkEndDayEarly(gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) return;

    const game = gameDoc.data() as Game;
    if (game.phase !== 'day') return;

    const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId), where('isAlive', '==', true));
    const playersSnap = await getDocs(playersQuery);
    const alivePlayers = playersSnap.docs.map(p => p.data() as Player);

    const allPlayersVoted = alivePlayers.every(p => !!p.votedFor);
    
    if (allPlayersVoted) {
        await processVotes(gameId);
    }
}

export async function runAIActions(gameId: string, phase: Game['phase']) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        const playersSnap = await getDocs(query(collection(db, 'players'), where('gameId', '==', gameId)));
        const players = playersSnap.docs.map(p => p.data() as Player);
        
        const eventsSnap = await getDocs(query(collection(db, 'game_events'), where('gameId', '==', gameId), orderBy('createdAt', 'asc')));
        const events = eventsSnap.docs.map(e => e.data() as GameEvent);

        const aiPlayers = players.filter(p => p.isAI && p.isAlive);

        for (const ai of aiPlayers) {
             const nightActionsQuery = query(collection(db, 'night_actions'), where('gameId', '==', gameId), where('round', '==', game.currentRound), where('playerId', '==', ai.userId));
            const existingNightActions = await getDocs(nightActionsQuery);
            if (phase === 'night' && !existingNightActions.empty) continue;

            const playerDocSnap = await getDoc(doc(db, 'players', `${ai.userId}_${gameId}`));
            if (phase === 'day' && playerDocSnap.exists() && playerDocSnap.data().votedFor) continue;

            const serializableGame = toJSONCompatible(game);
            const serializablePlayers = toJSONCompatible(players);
            const serializableEvents = toJSONCompatible(events);
            const serializableCurrentPlayer = toJSONCompatible(ai);

            const aiInput: TakeAITurnInput = {
                game: JSON.stringify(serializableGame),
                players: JSON.stringify(serializablePlayers),
                events: JSON.stringify(serializableEvents),
                currentPlayer: JSON.stringify(serializableCurrentPlayer),
            };

            const aiResult = await takeAITurn(aiInput);
            console.log(`AI (${ai.displayName} as ${ai.role}) action: ${aiResult.action}. Reasoning: ${aiResult.reasoning}`);

            const [actionType, targetId] = aiResult.action.split(':');

            if (!actionType || actionType === 'NONE' || !targetId) continue;

            const alivePlayers = players.filter(p => p.isAlive);
            const validTarget = alivePlayers.some(p => p.userId === targetId);

            if (!validTarget && actionType !== 'NONE') {
                console.log(`AI (${ai.displayName}) chose an invalid target: ${targetId}. Skipping turn.`);
                continue;
            }

            switch(actionType) {
                case 'KILL':
                    if (phase === 'night' && ai.role === 'werewolf') {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'werewolf_kill', targetId });
                    }
                    break;
                case 'CHECK':
                     if (phase === 'night' && ai.role === 'seer') {
                        await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'seer_check', targetId });
                    }
                    break;
                case 'HEAL':
                     if (phase === 'night' && ai.role === 'doctor') {
                         const targetPlayerDoc = await getDoc(doc(db, 'players', `${targetId}_${gameId}`));
                         if (targetPlayerDoc.exists() && targetPlayerDoc.data().lastHealedRound !== game.currentRound - 1) {
                            await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: 'doctor_heal', targetId });
                         }
                    }
                    break;
                case 'VOTE':
                    if (phase === 'day') {
                        await submitVote(gameId, ai.userId, targetId);
                    }
                    break;
                case 'SHOOT':
                    if (phase === 'hunter_shot' && ai.userId === game.pendingHunterShot) {
                        await submitHunterShot(gameId, ai.userId, targetId);
                    }
                    break;
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

// Helper to convert Firestore Timestamps to something JSON-serializable (ISO strings)
const toJSONCompatible = (obj: any): any => {
    if (!obj) return obj;
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(toJSONCompatible);
    }
    if (typeof obj === 'object' && obj.constructor === Object) {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = toJSONCompatible(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
};

    