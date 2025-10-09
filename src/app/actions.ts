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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Player, NightAction, GameEvent } from "@/types";

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
  maxPlayers: number
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

export async function startGame(gameId: string, creatorId: string) {
    const gameRef = doc(db, 'games', gameId);
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

    if (players.length < 3) { // Minimum players to start
      return { error: 'Se necesitan al menos 3 jugadores para comenzar.' };
    }

    const newRoles = generateRoles(players.length, game.settings);

    const batch = writeBatch(db);

    players.forEach((player, index) => {
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
}

export async function submitNightAction(action: Omit<NightAction, 'createdAt' | 'round'> & { round: number }) {
  try {
    const actionRef = collection(db, 'night_actions');
    
    const q = query(actionRef, 
      where('gameId', '==', action.gameId), 
      where('round', '==', action.round), 
      where('playerId', '==', action.playerId),
      where('actionType', '==', action.actionType)
    );
    const existingActions = await getDocs(q);
    
    if (!existingActions.empty) {
      const batch = writeBatch(db);
      existingActions.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    
    await addDoc(actionRef, {
      ...action,
      createdAt: Timestamp.now(),
    });

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
        
        // Log the action to prevent re-doing it
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
  
  if (playerToKill.role === 'hunter') {
    transaction.update(doc(db, 'games', gameId), { pendingHunterShot: playerId, phase: 'hunter_shot' });
    return { killedIds: [], hunterId: playerId };
  }
  
  const playerRef = doc(db, 'players', `${playerId}_${gameId}`);
  transaction.update(playerRef, { isAlive: false });

  if (gameData.lovers && gameData.lovers.includes(playerId)) {
    const otherLoverId = gameData.lovers.find(id => id !== playerId)!;
    const otherLoverPlayer = playersData.find(p => p.userId === otherLoverId);
    if (otherLoverPlayer && otherLoverPlayer.isAlive) {
      
      if (otherLoverPlayer.role === 'hunter') {
         transaction.update(doc(db, 'games', gameId), { pendingHunterShot: otherLoverId, phase: 'hunter_shot' });
      } else {
        const otherLoverRef = doc(db, 'players', `${otherLoverId}_${gameId}`);
        transaction.update(otherLoverRef, { isAlive: false });
        killedPlayerIds.push(otherLoverId);

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
  }

  return { killedIds: killedPlayerIds, hunterId: null };
}

async function checkGameOver(gameId: string, transaction: Transaction, lovers?: [string, string]): Promise<boolean> {
    const gameRef = doc(db, 'games', gameId);
    const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId));
    
    // We need to fetch players within the transaction context for consistency
    const playersSnap = await transaction.get(playersQuery);
    const players = playersSnap.docs.map(doc => doc.data() as Player);

    const alivePlayers = players.filter(p => p.isAlive);
    const aliveWerewolves = alivePlayers.filter(p => p.isAlive && p.role === 'werewolf');
    const aliveVillagers = alivePlayers.filter(p => p.isAlive && p.role !== 'werewolf');

    let gameOver = false;
    let message = "";

    if (lovers) {
        const aliveLovers = alivePlayers.filter(p => lovers.includes(p.userId));
        if (aliveLovers.length === 2 && alivePlayers.length === 2) {
            gameOver = true;
            message = `¡Los enamorados han ganado! Desafiando a sus bandos, ${aliveLovers[0].displayName} y ${aliveLovers[1].displayName} han triunfado solos.`;
        }
    }
    
    if (!gameOver) {
        if (aliveWerewolves.length === 0) {
            gameOver = true;
            message = "¡El pueblo ha ganado! Todos los hombres lobo han sido eliminados.";
        } else if (aliveWerewolves.length >= aliveVillagers.length) {
            gameOver = true;
            message = "¡Los hombres lobo han ganado! Han superado en número a los aldeanos.";
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

            // Fetch players inside transaction to ensure consistency
            const playersSnap = await getDocs(query(collection(db, 'players'), where('gameId', '==', gameId)));
            const playersData = playersSnap.docs.map(doc => doc.data() as Player);

            const actionsQuery = query(collection(db, 'night_actions'),
                where('gameId', '==', gameId),
                where('round', '==', game.currentRound)
            );
            // Must fetch outside transaction, as it's a query not a single doc get
            const actionsSnap = await getDocs(actionsQuery); 
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

            if (nightKillResult.hunterId) return; // Stop processing, wait for hunter

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

            // Fetch players inside transaction to ensure consistency
            const playersSnap = await getDocs(query(collection(db, 'players'), where('gameId', '==', gameId)));
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
            
            if (voteKillResult.hunterId) return; // Stop processing, wait for hunter

            if (voteKillResult.killedIds.length > 0) {
                 const isGameOver = await checkGameOver(gameId, transaction, game.lovers);
                 if (isGameOver) return;
            }
            
            transaction.update(gameRef, {
                phase: 'night',
                currentRound: increment(1)
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
            
            // Fetch players to get data for events and lover logic
            const playersSnap = await getDocs(query(collection(db, 'players'), where('gameId', '==', gameId)));
            const playersData = playersSnap.docs.map(doc => doc.data() as Player);

            // Kill the hunter first
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

            // Kill the target and check for game over
            const targetKillResult = await killPlayer(transaction, gameId, targetId, game, playersData);
            const isGameOver = await checkGameOver(gameId, transaction, game.lovers);
            if (isGameOver) return;
            
            // Determine next phase based on when the hunter was killed
            const originatingPhase = game.currentRound > 0 ? 'day' : 'night'; // Assumption: hunter died during day if round > 0 vote, else night. Better logic might be needed.
            const nextPhase = originatingPhase === 'day' ? 'night' : 'day';

            transaction.update(gameRef, {
                phase: nextPhase,
                pendingHunterShot: null, // Clear the pending shot
                currentRound: nextPhase === 'night' ? increment(1) : game.currentRound // Increment round if moving to night
            });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting hunter shot: ", error);
        return { error: error.message || "No se pudo registrar el disparo." };
    }
}
