
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
  type Timestamp as FirestoreTimestamp,
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

async function getPlayerRef(gameId: string, userId: string) {
    const q = query(collection(db, 'players'), where('gameId', '==', gameId), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].ref;
}


export async function createGame(
  userId: string,
  displayName: string,
  gameName: string,
  maxPlayers: number,
  settings: Game['settings']
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
        ...settings,
        werewolves: werewolfCount,
    },
    pendingHunterShot: undefined,
  };

  await setDoc(gameRef, gameData);

  const playerRef = doc(collection(db, "players"));
  const playerData: Player = {
    id: playerRef.id,
    userId: userId,
    gameId: gameId,
    role: null,
    isAlive: true,
    votedFor: null,
    displayName: displayName,
    joinedAt: Timestamp.now(),
    isAI: false,
    potions: {
        poison: null,
        save: null,
    },
    priestSelfHealUsed: false,
    princeRevealed: false,
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

  const playerRef = doc(collection(db, "players"));
  const playerData: Player = {
    id: playerRef.id,
    userId: userId,
    gameId: gameId,
    role: null,
    isAlive: true,
    votedFor: null,
    displayName: displayName,
    joinedAt: Timestamp.now(),
    isAI: false,
    potions: {
        poison: null,
        save: null,
    },
    priestSelfHealUsed: false,
    princeRevealed: false,
  };
  await setDoc(playerRef, playerData);
  return { success: true };
}

const generateRoles = (playerCount: number, settings: Game['settings']) => {
    let roles: Player['role'][] = [];
    
    // Add werewolves
    for (let i = 0; i < settings.werewolves; i++) {
        roles.push('werewolf');
    }
    
    // Add other wolf roles
    if (settings.wolf_cub && roles.length < playerCount) roles.push('wolf_cub');
    if (settings.seeker_fairy && roles.length < playerCount) roles.push('seeker_fairy');


    // Add special village roles based on settings
    if (settings.seer && roles.length < playerCount) roles.push('seer');
    if (settings.doctor && roles.length < playerCount) roles.push('doctor');
    if (settings.hunter && roles.length < playerCount) roles.push('hunter');
    if (settings.cupid && roles.length < playerCount) roles.push('cupid');
    if (settings.hechicera && roles.length < playerCount) roles.push('hechicera');
    if (settings.lycanthrope && roles.length < playerCount) roles.push('lycanthrope');
    if (settings.prince && roles.length < playerCount) roles.push('prince');
    if (settings.twin && (roles.length + 1) < playerCount) {
      roles.push('twin');
      roles.push('twin'); 
    }
    if (settings.guardian && roles.length < playerCount) roles.push('guardian');
    if (settings.priest && roles.length < playerCount) roles.push('priest');
    if (settings.cursed && roles.length < playerCount) roles.push('cursed');
    if (settings.ghost && roles.length < playerCount) roles.push('ghost');
    if (settings.virginia_woolf && roles.length < playerCount) roles.push('virginia_woolf');
    if (settings.leprosa && roles.length < playerCount) roles.push('leprosa');
    if (settings.river_siren && roles.length < playerCount) roles.push('river_siren');
    if (settings.lookout && roles.length < playerCount) roles.push('lookout');
    if (settings.troublemaker && roles.length < playerCount) roles.push('troublemaker');
    if (settings.silencer && roles.length < playerCount) roles.push('silencer');
    if (settings.seer_apprentice && roles.length < playerCount) roles.push('seer_apprentice');
    if (settings.elder_leader && roles.length < playerCount) roles.push('elder_leader');
    if (settings.sleeping_fairy && roles.length < playerCount) roles.push('sleeping_fairy');
    
    // Add special neutral roles
    if (settings.shapeshifter && roles.length < playerCount) roles.push('shapeshifter');
    if (settings.drunk_man && roles.length < playerCount) roles.push('drunk_man');
    if (settings.cult_leader && roles.length < playerCount) roles.push('cult_leader');
    if (settings.fisherman && roles.length < playerCount) roles.push('fisherman');
    if (settings.vampire && roles.length < playerCount) roles.push('vampire');
    if (settings.witch && roles.length < playerCount) roles.push('witch');
    if (settings.banshee && roles.length < playerCount) roles.push('banshee');


    // Fill remaining spots with villagers
    while (roles.length < playerCount) {
        roles.push('villager');
    }

    // Ensure there are enough roles, if not, add villagers
    while (roles.length > playerCount) {
      roles.pop(); // Remove excess roles
    }

    // Ensure we have at least one werewolf if roles were cut.
    const hasWolfRole = roles.some(r => r === 'werewolf' || r === 'wolf_cub' || r === 'seeker_fairy');
    if (!hasWolfRole && playerCount > 0) {
        const villagerIndex = roles.findIndex(r => r === 'villager');
        if (villagerIndex !== -1) {
            roles[villagerIndex] = 'werewolf';
        } else if (roles.length > 0) {
            roles[0] = 'werewolf';
        } else {
            roles.push('werewolf');
        }
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
        const players = playersSnap.docs.map(doc => ({ ...doc.data() as Player, id: doc.id }));

        let finalPlayers = [...players];
        let finalPlayerIds = players.map(p => p.userId);

        if (game.settings.fillWithAI && finalPlayers.length < game.maxPlayers) {
            const aiPlayerCount = game.maxPlayers - finalPlayers.length;
            const availableAINames = AI_NAMES.filter(name => !players.some(p => p.displayName === name));

            for (let i = 0; i < aiPlayerCount; i++) {
                const aiUserId = `ai_${crypto.randomUUID()}`;
                const aiName = availableAINames[i % availableAINames.length] || `Bot ${i + 1}`;
                
                const aiPlayerRef = doc(collection(db, 'players'));
                const aiPlayerData: Player = {
                    id: aiPlayerRef.id,
                    userId: aiUserId,
                    gameId: gameId,
                    role: null,
                    isAlive: true,
                    votedFor: null,
                    displayName: aiName,
                    joinedAt: Timestamp.now(),
                    isAI: true,
                    potions: { poison: null, save: null },
                    priestSelfHealUsed: false,
                    princeRevealed: false,
                };

                batch.set(aiPlayerRef, aiPlayerData);
                finalPlayers.push(aiPlayerData);
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
        const assignedPlayers = finalPlayers.map((player, index) => ({
            ...player,
            role: newRoles[index],
        }));

        const twinUserIds = assignedPlayers.filter(p => p.role === 'twin').map(p => p.userId);
        if (twinUserIds.length === 2) {
            batch.update(gameRef, { twins: twinUserIds });
        }


        assignedPlayers.forEach((player) => {
            const playerRef = doc(db, 'players', player.id);
            batch.update(playerRef, { role: player.role });
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
    const playerRef = await getPlayerRef(action.gameId, action.playerId);
    if (!playerRef) throw new Error("Player not found");
    const playerDoc = await getDoc(playerRef);
    const player = playerDoc.data() as Player;

    if (action.actionType === 'doctor_heal') {
        const targetPlayerRef = await getPlayerRef(action.gameId, action.targetId);
        if (!targetPlayerRef) throw new Error("Target player for heal not found");
        const targetDoc = await getDoc(targetPlayerRef);
        if(targetDoc.exists() && targetDoc.data().lastHealedRound === action.round - 1) {
            return { success: false, error: "No puedes proteger a la misma persona dos noches seguidas." };
        }
    }
    
    if (action.actionType === 'hechicera_poison') {
        if (player.potions?.poison) {
            return { success: false, error: "Ya has usado tu poción de veneno." };
        }
    }
    
    if (action.actionType === 'hechicera_save') {
        if (player.potions?.save) {
            return { success: false, error: "Ya has usado tu poción de salvación." };
        }
    }

    if (action.actionType === 'guardian_protect' && action.targetId === action.playerId && player.userId === action.playerId) {
        // This check is a bit redundant as Guardian has a one-time self protect rule.
        // A better implementation would track this on the player object.
        // For now, we will allow it once. This logic needs to be improved.
    }

    if (action.actionType === 'priest_bless' && action.targetId === action.playerId && player.priestSelfHealUsed) {
        return { success: false, error: "Ya te has bendecido a ti mismo una vez." };
    }
    
    // Check for existing action for this player and round to prevent duplicates
    const q = query(actionRef, 
      where('gameId', '==', action.gameId), 
      where('round', '==', action.round), 
      where('playerId', '==', action.playerId)
    );
    const existingActions = await getDocs(q);
    
    const batch = writeBatch(db);
    // If an action already exists, overwrite it (useful for werewolves changing vote or witch changing action)
    if (!existingActions.empty) {
        existingActions.forEach(doc => {
            const docData = doc.data();
            // Allow override for werewolves or if witch is changing potion type
            const isWitchChangingPotion = action.playerId === docData.playerId && (docData.actionType === 'hechicera_poison' || docData.actionType === 'hechicera_save');
            if (docData.actionType === action.actionType || action.actionType === 'werewolf_kill' || isWitchChangingPotion) {
               batch.delete(doc.ref);
            }
        });
    }
    
    const newActionRef = doc(collection(db, 'night_actions'));
    batch.set(newActionRef, {
      ...action,
      createdAt: Timestamp.now(),
    });

    if (action.actionType === 'doctor_heal') {
        const targetPlayerRef = await getPlayerRef(action.gameId, action.targetId);
        if (targetPlayerRef) {
            batch.update(targetPlayerRef, {
                lastHealedRound: action.round
            });
        }
    }

    if (action.actionType === 'hechicera_poison') {
       batch.update(playerRef, {
           "potions.poison": action.round
       });
    }

    if (action.actionType === 'hechicera_save') {
        batch.update(playerRef, {
            "potions.save": action.round
        });
    }

    if (action.actionType === 'priest_bless' && action.targetId === action.playerId) {
        batch.update(playerRef, {
            priestSelfHealUsed: true
        });
    }

    await batch.commit();
    
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
  
  if (playerToKill.role === 'hunter' && gameData.settings.hunter) {
    hunterTriggeredId = playerId;
  } else if (playerToKill.role === 'wolf_cub' && gameData.settings.wolf_cub) {
    transaction.update(doc(db, 'games', gameId), { wolfCubRevengeRound: gameData.currentRound + 1 });
    const playerRef = doc(db, 'players', playerToKill.id);
    transaction.update(playerRef, { isAlive: false });
  } else {
    const playerRef = doc(db, 'players', playerToKill.id);
    transaction.update(playerRef, { isAlive: false });
  }

  if (gameData.lovers && gameData.lovers.includes(playerId)) {
    const otherLoverId = gameData.lovers.find(id => id !== playerId)!;
    const otherLoverPlayer = playersData.find(p => p.userId === otherLoverId);
    if (otherLoverPlayer && otherLoverPlayer.isAlive) {
      if (otherLoverPlayer.role === 'hunter' && gameData.settings.hunter) {
         hunterTriggeredId = otherLoverId;
      } else {
        const otherLoverRef = doc(db, 'players', otherLoverPlayer.id);
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

async function checkGameOver(gameId: string, transaction: Transaction): Promise<boolean> {
    const gameRef = doc(db, 'games', gameId);
    const gameData = (await transaction.get(gameRef)).data() as Game;

    const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId));
    
    const playersSnap = await transaction.get(playersQuery);
    const players = playersSnap.docs.map(doc => doc.data() as Player);

    const alivePlayers = players.filter(p => p.isAlive);
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy'];
    const aliveWerewolves = alivePlayers.filter(p => p.isAlive && wolfRoles.includes(p.role));
    const aliveVillagers = alivePlayers.filter(p => p.isAlive && !wolfRoles.includes(p.role));

    let gameOver = false;
    let message = "";
    let winners: string[] = [];

    // 1. Check for Lovers' victory first, as it's a special condition.
    if (gameData.lovers) {
        const aliveLovers = alivePlayers.filter(p => gameData.lovers!.includes(p.userId));
        // If the only players left alive are the lovers, they win.
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length >= 2) {
            gameOver = true;
            const lover1 = players.find(p => p.userId === gameData.lovers![0]);
            const lover2 = players.find(p => p.userId === gameData.lovers![1]);
            message = `¡Los enamorados han ganado! Desafiando a sus bandos, ${lover1?.displayName} y ${lover2?.displayName} han triunfado solos contra el mundo.`;
            winners = gameData.lovers;
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

            const killedByWerewolfIds: string[] = [];
            let killedByPoisonId: string | null = null;
            let savedByDoctorId: string | null = null;
            let savedByHechiceraId: string | null = null;
            let savedByGuardianId: string | null = null;
            let savedByPriestId: string | null = null;
            let nightKillResults: { killedIds: string[], hunterId: string | null }[] = [];

            const doctorAction = actions.find(a => a.actionType === 'doctor_heal');
            if (doctorAction) savedByDoctorId = doctorAction.targetId;

            const hechiceraSaveAction = actions.find(a => a.actionType === 'hechicera_save');
            if (hechiceraSaveAction) savedByHechiceraId = hechiceraSaveAction.targetId;
            
            const guardianAction = actions.find(a => a.actionType === 'guardian_protect');
            if (guardianAction) savedByGuardianId = guardianAction.targetId;

            const priestAction = actions.find(a => a.actionType === 'priest_bless');
            if (priestAction) savedByPriestId = priestAction.targetId;

            const werewolfVotes = actions.filter(a => a.actionType === 'werewolf_kill');
            if (werewolfVotes.length > 0) {
                const voteCounts = werewolfVotes.reduce((acc, vote) => {
                    // Handle single and double votes
                    const targets = vote.targetId.split('|');
                    targets.forEach(targetId => {
                        if(targetId) acc[targetId] = (acc[targetId] || 0) + 1;
                    });
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
                
                // If there's a tie, randomly select among the tied players.
                // If wolf cub revenge is active, wolves select 2 players.
                const killCount = game.wolfCubRevengeRound === game.currentRound ? 2 : 1;
                while (killedByWerewolfIds.length < killCount && mostVotedPlayerIds.length > 0) {
                    const randomIndex = Math.floor(Math.random() * mostVotedPlayerIds.length);
                    const killedId = mostVotedPlayerIds.splice(randomIndex, 1)[0];
                    killedByWerewolfIds.push(killedId);
                }
            }

            const poisonAction = actions.find(a => a.actionType === 'hechicera_poison');
            if (poisonAction) {
                killedByPoisonId = poisonAction.targetId;
            }

            let messages: string[] = [];
            // Priest save is absolute
            const finalSavedPlayerIds = [savedByDoctorId, savedByHechiceraId, savedByGuardianId].filter(id => id && id !== savedByPriestId).filter(Boolean) as string[];

            // Process werewolf attacks
            for (const killedId of killedByWerewolfIds) {
                 const targetPlayer = playersData.find(p => p.userId === killedId);

                 if (targetPlayer?.role === 'cursed' && game.settings.cursed) {
                    const playerRef = doc(db, 'players', targetPlayer.id);
                    transaction.update(playerRef, { role: 'werewolf' });
                    messages.push(`En la oscuridad, ${targetPlayer.displayName} no muere, ¡sino que se une a la manada! Ahora es un Hombre Lobo.`);
                    const eventLogRef = doc(collection(db, 'game_events'));
                    transaction.set(eventLogRef, {
                        gameId,
                        round: game.currentRound,
                        type: 'player_transformed',
                        message: `${targetPlayer.displayName} fue atacado, pero en lugar de morir, ha sido transformado en un Hombre Lobo.`,
                        data: { playerId: targetPlayer.userId },
                        createdAt: Timestamp.now(),
                    });

                } else if (killedId === savedByPriestId) {
                     messages.push("Una bendición ha protegido a un aldeano de un destino fatal.");
                } else if (finalSavedPlayerIds.includes(killedId)) {
                    messages.push("Se escuchó un grito en la noche, ¡pero alguien fue salvado en el último momento!");
                } else {
                    const killedPlayer = playersData.find(p => p.userId === killedId)!;
                    messages.push(`${killedPlayer.displayName} fue atacado en la noche.`);
                    const result = await killPlayer(transaction, gameId, killedPlayer.userId, game, playersData);
                    nightKillResults.push(result);
                }
            }

            // Process poison attack
            if (killedByPoisonId && !killedByWerewolfIds.includes(killedByPoisonId)) {
                if (killedByPoisonId === savedByPriestId) {
                    messages.push("Una bendición ha protegido a un aldeano de un veneno mortal.");
                } else if (finalSavedPlayerIds.includes(killedByPoisonId)) {
                     // Technically, only priest can save from poison based on rules. But lets make save potion work too.
                    messages.push("La poción de una hechicera ha salvado a alguien de un veneno.");
                }
                 else {
                    const killedPlayer = playersData.find(p => p.userId === killedByPoisonId)!;
                    messages.push(`${killedPlayer.displayName} ha muerto misteriosamente, víctima de un veneno.`);
                    const result = await killPlayer(transaction, gameId, killedPlayer.userId, game, playersData);
                    nightKillResults.push(result);
                }
            }

            if (messages.length === 0) {
                messages.push("La noche transcurre en un inquietante silencio.");
            }
            
            const allProtectedIds = [savedByPriestId, ...finalSavedPlayerIds];
            const killedWerewolfTargets = killedByWerewolfIds.filter(id => !allProtectedIds.includes(id));
            const killedPoisonTarget = (killedByPoisonId && !killedByWerewolfIds.includes(killedByPoisonId) && !allProtectedIds.includes(killedByPoisonId)) ? killedByPoisonId : null;

            const logRef = doc(collection(db, 'game_events'));
            transaction.set(logRef, {
                gameId,
                round: game.currentRound,
                type: 'night_result',
                message: messages.join(' '),
                data: { 
                    killedByWerewolfIds: killedWerewolfTargets,
                    killedByPoisonId: killedPoisonTarget,
                    savedPlayerIds: allProtectedIds,
                },
                createdAt: Timestamp.now(),
            });
            
            const triggeredHunterId = nightKillResults.map(r => r.hunterId).find(id => id !== null);
            if (triggeredHunterId) return; 

            const anyKills = nightKillResults.some(r => r.killedIds.length > 0);
            if (anyKills) {
                 const isGameOver = await checkGameOver(gameId, transaction);
                 if (isGameOver) return;
            }

            playersSnap.forEach(playerDoc => {
                transaction.update(playerDoc.ref, { votedFor: null });
            });

            const nextPhaseUpdate: {phase: Game['phase'], wolfCubRevengeRound?: number} = { phase: 'day' };
            if (game.wolfCubRevengeRound === game.currentRound) {
                nextPhaseUpdate.wolfCubRevengeRound = 0; // Reset revenge
            }

            transaction.update(gameRef, nextPhaseUpdate);
        });
        return { success: true };
    } catch (error) {
        console.error("Error processing night:", error);
        return { error: "Hubo un problema al procesar la noche." };
    }
}


export async function submitVote(gameId: string, voterId: string, targetId: string) {
    try {
        const playerRef = await getPlayerRef(gameId, voterId);
        if (playerRef) {
            await updateDoc(playerRef, { votedFor: targetId });
            await checkEndDayEarly(gameId);
        }
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

            const lynchedPlayerIsPrince = (playerId: string) => {
                const player = playersData.find(p => p.userId === playerId);
                return player?.role === 'prince' && game.settings.prince;
            };

            if (mostVotedPlayerIds.length === 1 && maxVotes > 0) {
                const potentialLynchedId = mostVotedPlayerIds[0];
                const lynchedPlayer = playersData.find(p => p.userId === potentialLynchedId)!;
                
                if (lynchedPlayerIsPrince(potentialLynchedId) && !lynchedPlayer.princeRevealed) {
                    eventMessage = `${lynchedPlayer.displayName} ha sido sentenciado, pero revela su identidad como ¡el Príncipe! y sobrevive a la votación.`;
                    const playerRef = doc(db, 'players', lynchedPlayer.id);
                    transaction.update(playerRef, { princeRevealed: true });
                } else {
                    lynchedPlayerId = potentialLynchedId;
                    eventMessage = `El pueblo ha decidido. ${lynchedPlayer.displayName} ha sido linchado.`;
                    voteKillResult = await killPlayer(transaction, gameId, lynchedPlayer.userId, game, playersData);
                }

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
                data: { lynchedPlayerId: lynchedPlayerId }, // Log the ID of the person who would have been lynched if not for prince
                createdAt: Timestamp.now(),
            });
            
            if (voteKillResult.hunterId) return;

            if (voteKillResult.killedIds.length > 0) {
                 const isGameOver = await checkGameOver(gameId, transaction);
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
    const seerPlayerRef = await getPlayerRef(gameId, seerId);
    if (!seerPlayerRef) {
        throw new Error("Seer player not found");
    }
    const seerPlayerSnap = await getDoc(seerPlayerRef);

    if (!seerPlayerSnap.exists() || seerPlayerSnap.data()?.role !== 'seer') {
      throw new Error("No eres el vidente.");
    }
    
    const targetPlayerRef = await getPlayerRef(gameId, targetId);
     if (!targetPlayerRef) {
        throw new Error("Target player not found");
    }
    const targetPlayerSnap = await getDoc(targetPlayerRef);

    if (!targetPlayerSnap.exists()) {
      throw new Error("Jugador objetivo no encontrado.");
    }
    
    const gameDoc = await getDoc(doc(db, 'games', gameId));
    if (!gameDoc.exists()) {
      throw new Error("Game not found");
    }
    const game = gameDoc.data() as Game;

    const targetPlayer = targetPlayerSnap.data() as Player;
    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy'];
    const isWerewolf = wolfRoles.includes(targetPlayer.role) || (targetPlayer.role === 'lycanthrope' && game.settings.lycanthrope);

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

            const hunterPlayer = playersData.find(p => p.userId === hunterId)!;
            const hunterPlayerRef = doc(db, 'players', hunterPlayer.id);
            transaction.update(hunterPlayerRef, { isAlive: false });

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

            const isGameOver = await checkGameOver(gameId, transaction);
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

    const wolfRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'seeker_fairy'];
    const werewolves = alivePlayers.filter(p => wolfRoles.includes(p.role));
    if (werewolves.length > 0) {
        werewolves.forEach(w => requiredPlayerIds.add(w.userId));
    }

    if (game.settings.seer) {
        const seer = alivePlayers.find(p => p.role === 'seer');
        if (seer) requiredPlayerIds.add(seer.userId);
    }
    
    if (game.settings.doctor) {
        const doctor = alivePlayers.find(p => p.role === 'doctor');
        if (doctor) requiredPlayerIds.add(doctor.userId);
    }
    
    if (game.settings.guardian) {
        const guardian = alivePlayers.find(p => p.role === 'guardian');
        if (guardian) requiredPlayerIds.add(guardian.userId);
    }

    if (game.settings.priest) {
        const priest = alivePlayers.find(p => p.role === 'priest');
        if (priest) requiredPlayerIds.add(priest.userId);
    }

    if (game.currentRound === 1 && game.settings.cupid) {
        const cupid = alivePlayers.find(p => p.role === 'cupid');
        if (cupid) requiredPlayerIds.add(cupid.userId);
    }
    
    if (game.settings.hechicera) {
        const hechicera = alivePlayers.find(p => p.role === 'hechicera');
        if (hechicera && (!hechicera.potions?.poison || !hechicera.potions?.save)) {
             // A hechicera might not act, so this is tricky. For now, let's assume they MUST act if they have potions.
             // A better implementation would have a "skip" action. For now, we consider them required if they have potions.
             requiredPlayerIds.add(hechicera.userId);
        }
    }
    
    const submittedPlayerIds = new Set(submittedActions.map(a => a.playerId));

    // A special case for Hechicera: if they used a potion, they've acted.
    // The current submittedActions only tracks one action type per player. This is a flaw.
    // Let's refine the check.
    const allActionsSubmitted = Array.from(requiredPlayerIds).every(id => {
        // A Hechicera might submit 'poison' or 'save'.
        if (alivePlayers.find(p => p.userId === id)?.role === 'hechicera') {
            return submittedActions.some(a => a.playerId === id);
        }
        return submittedPlayerIds.has(id);
    });

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
