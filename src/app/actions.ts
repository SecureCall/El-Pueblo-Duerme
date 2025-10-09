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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Player, NightAction } from "@/types";

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
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) return { error: 'Game not found' };
    const game = gameSnap.data() as Game;

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
        let mostVotedPlayerId: string | null = null;
        for (const targetId in voteCounts) {
            if (voteCounts[targetId] > maxVotes) {
                maxVotes = voteCounts[targetId];
                mostVotedPlayerId = targetId;
            }
        }
        
        if(mostVotedPlayerId) {
             killedPlayerId = mostVotedPlayerId;
        }
    }
    
    const batch = writeBatch(db);
    let eventLogMessage = "La noche transcurre en silencio.";

    // 3. Determine final outcome and update player status
    if (killedPlayerId && killedPlayerId !== savedPlayerId) {
        const playerRef = doc(db, 'players', `${killedPlayerId}_${gameId}`);
        batch.update(playerRef, { isAlive: false });
        
        const killedPlayerSnap = await getDoc(doc(db, 'players', `${killedPlayerId}_${gameId}`));
        const killedPlayerName = killedPlayerSnap.data()?.displayName || 'Un jugador';
        eventLogMessage = `${killedPlayerName} fue atacado en la noche y no ha sobrevivido.`;
    } else if (killedPlayerId && killedPlayerId === savedPlayerId) {
        eventLogMessage = "Se escuchó un grito en la noche, ¡pero el doctor llegó a tiempo!";
    }
    
    // 4. Create event log for the night's result
    const logRef = collection(db, 'game_events');
    await addDoc(logRef, {
        gameId,
        round: game.currentRound,
        type: 'night_result',
        message: eventLogMessage,
        data: { killedPlayerId, savedPlayerId },
        createdAt: Timestamp.now(),
    });

    // 5. Transition to next phase
    batch.update(gameRef, { 
        phase: 'day',
        currentRound: increment(1)
    });
    
    await batch.commit();

    return { success: true };
}
