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

  const werewolfCount = Math.max(1, Math.floor(maxPlayers / 4));

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
      hunter: false,
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

export async function processNight(gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) {
                throw new Error("Game not found!");
            }
            const game = gameSnap.data() as Game;

            // Prevent re-processing
            if (game.phase !== 'night') {
                return;
            }

            const actionsQuery = query(collection(db, 'night_actions'),
                where('gameId', '==', gameId),
                where('round', '==', game.currentRound)
            );
            const actionsSnap = await getDocs(actionsQuery);
            const actions = actionsSnap.docs.map(doc => doc.data() as NightAction);

            let killedPlayerId: string | null = null;
            let savedPlayerId: string | null = null;

            // 1. Process Doctor's action
            const doctorAction = actions.find(a => a.actionType === 'doctor_heal');
            if (doctorAction) {
                savedPlayerId = doctorAction.targetId;
            }

            // 2. Process Werewolves' action
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
                
                // In case of a tie, one of the tied players is chosen randomly.
                if (mostVotedPlayerIds.length > 0) {
                    killedPlayerId = mostVotedPlayerIds[Math.floor(Math.random() * mostVotedPlayerIds.length)];
                }
            }

            let eventLogMessage = "La noche transcurre en un inquietante silencio.";
            const playersToUpdate: { ref: any, data: any }[] = [];

            // 3. Determine final outcome and update player status
            if (killedPlayerId && killedPlayerId !== savedPlayerId) {
                const playerRef = doc(db, 'players', `${killedPlayerId}_${gameId}`);
                playersToUpdate.push({ ref: playerRef, data: { isAlive: false } });

                const killedPlayerSnap = await transaction.get(playerRef);
                const killedPlayerName = killedPlayerSnap.data()?.displayName || 'Un jugador';
                eventLogMessage = `${killedPlayerName} fue atacado en la noche y no ha sobrevivido.`;
            } else if (killedPlayerId && killedPlayerId === savedPlayerId) {
                eventLogMessage = "Se escuchó un grito en la noche, ¡pero el doctor llegó justo a tiempo!";
            }
            
            // 4. Create event log for the night's result
            const logRef = doc(collection(db, 'game_events'));
            transaction.set(logRef, {
                gameId,
                round: game.currentRound,
                type: 'night_result',
                message: eventLogMessage,
                data: { killedPlayerId: killedPlayerId && killedPlayerId !== savedPlayerId ? killedPlayerId : null, savedPlayerId },
                createdAt: Timestamp.now(),
            });

            // 5. Update players in transaction
            for (const p of playersToUpdate) {
                transaction.update(p.ref, p.data);
            }

            // 6. Reset votes for the new day
            const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId));
            const playersSnap = await getDocs(playersQuery);
            playersSnap.forEach(playerDoc => {
                transaction.update(playerDoc.ref, { votedFor: null });
            });

            // 7. Transition to next phase
            transaction.update(gameRef, { 
                phase: 'day',
            });
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

            if (game.phase !== 'day') return;

            const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId), where('isAlive', '==', true));
            const playersSnap = await getDocs(playersQuery);
            const alivePlayers = playersSnap.docs.map(doc => doc.data() as Player);

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

            if (mostVotedPlayerIds.length === 1 && maxVotes > 0) {
                lynchedPlayerId = mostVotedPlayerIds[0];
                const playerRef = doc(db, 'players', `${lynchedPlayerId}_${gameId}`);
                const lynchedPlayerSnap = await transaction.get(playerRef);
                const lynchedPlayerName = lynchedPlayerSnap.data()?.displayName || 'Alguien';
                
                transaction.update(playerRef, { isAlive: false });
                eventMessage = `El pueblo ha decidido. ${lynchedPlayerName} ha sido linchado.`;

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
