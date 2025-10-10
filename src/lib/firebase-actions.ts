
'use client';
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
  type Firestore,
  type Transaction,
  type Timestamp as FirestoreTimestamp,
} from "firebase/firestore";
import type { Game, Player, NightAction, GameEvent } from "@/types";
import { takeAITurn } from "@/ai/flows/take-ai-turn-flow";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

function generateGameId(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getPlayerDoc(db: Firestore, gameId: string, userId: string) {
    const playerRef = doc(db, 'games', gameId, 'players', userId);
    const playerSnap = await getDoc(playerRef);
    return playerSnap;
}


const createPlayerObject = (userId: string, gameId: string, displayName: string, isAI: boolean = false): Omit<Player, 'id'> => ({
    userId,
    gameId,
    displayName: displayName.trim(),
    role: null,
    isAlive: true,
    votedFor: null,
    joinedAt: Timestamp.now(),
    isAI,
    lastHealedRound: 0,
    potions: {
        poison: null,
        save: null,
    },
    priestSelfHealUsed: false,
    princeRevealed: false,
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
      
  const werewolfCount = Math.max(1, Math.floor(maxPlayers / 5));

  const gameData: Omit<Game, 'id'> = {
      name: gameName.trim(),
      status: "waiting",
      phase: "night", // Lobby UI is driven by status='waiting'
      creator: userId,
      players: [], // Start with an empty player list
      maxPlayers: maxPlayers,
      createdAt: Timestamp.now(),
      settings: {
          ...settings,
          werewolves: werewolfCount,
      },
      pendingHunterShot: null,
      lovers: null,
      twins: null,
      wolfCubRevengeRound: 0,
  };
  
  try {
    // This part should be allowed by "allow create: if request.auth.uid == request.resource.data.creator"
    await setDoc(gameRef, gameData);
    
    // Now that the game is created, join the creator to it.
    // This part should be allowed by "allow write: if request.auth.uid == userId"
    const joinResult = await joinGame(db, gameId, userId, displayName);
    if (joinResult.error) {
      // This might happen if the joinGame transaction fails for other reasons.
      // We are not deleting the game for simplicity, it will be an empty game.
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
        // The listener will throw the error, so we don't need to return a specific message
        return { error: "Permiso denegado al crear la partida." };
    }
    console.error("Error creating game:", error); // Keep for general debugging
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
  const playerRef = doc(db, "games", gameId, "players", userId);
  let playerData = createPlayerObject(userId, gameId, displayName, false);

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
      
      const playerSnap = await transaction.get(playerRef);
      
      if (playerSnap.exists()) {
        // If player exists, just ensure their display name is up-to-date if it changed.
        if(playerSnap.data().displayName !== displayName) {
            transaction.update(playerRef, { displayName: displayName });
        }
        return; // Exit transaction successfully
      }
      
      if (game.players.length >= game.maxPlayers) {
        throw new Error("La partida está llena.");
      }

      // This is the first write in the transaction for a new player
      transaction.update(gameRef, {
        players: arrayUnion(userId),
      });

      // This is the second write
      transaction.set(playerRef, playerData);
    });
    
    return { success: true };

  } catch(error: any) {
    if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: playerRef.path,
            operation: 'create',
            requestResourceData: playerData,
        });
        errorEmitter.emit('permission-error', permissionError);
        return { error: "Permiso denegado al unirse a la partida." };
    }
    console.error("Error joining game:", error);
    return { error: `No se pudo unir a la partida: ${error.message}` };
  }
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

export async function startGame(db: Firestore, gameId: string, creatorId: string) {
    const gameRef = doc(db, 'games', gameId);
    let failingOp: { path: string, operation: 'create' | 'update' | 'delete' | 'write', data?: any } | null = null;
    
    try {
        await runTransaction(db, async (transaction) => {
            failingOp = null; // Reset at the start of the transaction
            const gameSnap = await transaction.get(gameRef);

            if (!gameSnap.exists()) {
                throw new Error('Partida no encontrada.');
            }

            const game = { ...gameSnap.data() as Game, id: gameSnap.id };

            if (game.creator !== creatorId) {
                throw new Error('Solo el creador puede iniciar la partida.');
            }

            if (game.status !== 'waiting') {
                throw new Error('La partida ya ha comenzado.');
            }
            
            const playersQuery = query(collection(db, 'games', gameId, 'players'));
            failingOp = { path: playersQuery.path, operation: 'list' };
            const playersSnap = await transaction.get(playersQuery);
            const players = playersSnap.docs.map(doc => ({ ...doc.data() as Player, id: doc.id }));

            let finalPlayers = [...players];
            let finalPlayerIds = players.map(p => p.userId);

            if (game.settings.fillWithAI && finalPlayers.length < game.maxPlayers) {
                const aiPlayerCount = game.maxPlayers - finalPlayers.length;
                const availableAINames = AI_NAMES.filter(name => !players.some(p => p.displayName === name));

                for (let i = 0; i < aiPlayerCount; i++) {
                    const aiUserId = `ai_${Date.now()}_${i}`;
                    const aiName = availableAINames[i % availableAINames.length] || `Bot ${i + 1}`;
                    
                    const aiPlayerRef = doc(db, 'games', gameId, 'players', aiUserId);
                    const aiPlayerData = createPlayerObject(aiUserId, gameId, aiName, true);
                    
                    failingOp = { path: aiPlayerRef.path, operation: 'create', data: aiPlayerData };
                    transaction.set(aiPlayerRef, aiPlayerData);

                    finalPlayers.push({ ...aiPlayerData, id: aiPlayerRef.id });
                    finalPlayerIds.push(aiUserId);
                }
                
                failingOp = { path: gameRef.path, operation: 'update', data: { players: finalPlayerIds } };
                transaction.update(gameRef, {
                    players: finalPlayerIds,
                });
            }
            
            const totalPlayers = game.settings.fillWithAI ? game.maxPlayers : finalPlayers.length;
            if (totalPlayers < 3) {
                throw new Error('Se necesitan al menos 3 jugadores para comenzar.');
            }
            
            const newRoles = generateRoles(finalPlayers.length, game.settings);
            const assignedPlayers = finalPlayers.map((player, index) => ({
                ...player,
                role: newRoles[index],
            }));

            const twinUserIds = assignedPlayers.filter(p => p.role === 'twin').map(p => p.userId);
            if (twinUserIds.length === 2) {
                 failingOp = { path: gameRef.path, operation: 'update', data: { twins: twinUserIds } };
                transaction.update(gameRef, { twins: twinUserIds });
            }

            assignedPlayers.forEach((player) => {
                const playerRef = doc(db, 'games', gameId, 'players', player.userId);
                failingOp = { path: playerRef.path, operation: 'update', data: { role: player.role } };
                transaction.update(playerRef, { role: player.role });
            });

            failingOp = { path: gameRef.path, operation: 'update', data: { status: 'in_progress', phase: 'role_reveal', currentRound: 1 } };
            transaction.update(gameRef, {
                status: 'in_progress',
                phase: 'role_reveal',
                currentRound: 1,
            });
        });
        
        return { success: true };

    } catch (e: any) {
        if (e.code === 'permission-denied' && failingOp) {
            const permissionError = new FirestorePermissionError({
                path: failingOp.path,
                operation: failingOp.operation as 'create' | 'update',
                requestResourceData: failingOp.data,
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al iniciar la partida." };
        }
        console.error("Error starting game:", e);
        return { error: e.message || 'Error al iniciar la partida.' };
    }
}

export async function submitNightAction(db: Firestore, action: Omit<NightAction, 'createdAt' | 'round'> & { round: number }) {
  try {
    const actionRef = collection(db, 'games', action.gameId, 'night_actions');
    const playerDoc = await getPlayerDoc(db, action.gameId, action.playerId);
    if (!playerDoc || !playerDoc.exists()) throw new Error("Player not found");
    const player = playerDoc.data() as Player;

    if (action.actionType === 'doctor_heal') {
        const targetPlayerDoc = await getPlayerDoc(db, action.gameId, action.targetId);
        if (!targetPlayerDoc || !targetPlayerDoc.exists()) throw new Error("Target player for heal not found");
        
        if(targetPlayerDoc.data().lastHealedRound === action.round - 1) {
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
    
    const newActionRef = doc(collection(db, 'games', action.gameId, 'night_actions'));
    batch.set(newActionRef, {
      ...action,
      createdAt: Timestamp.now(),
    });

    if (action.actionType === 'doctor_heal') {
        const targetPlayerDoc = await getPlayerDoc(db, action.gameId, action.targetId);
        if (targetPlayerDoc) {
            batch.update(targetPlayerDoc.ref, {
                lastHealedRound: action.round
            });
        }
    }

    if (action.actionType === 'hechicera_poison') {
       batch.update(playerDoc.ref, {
           "potions.poison": action.round
       });
    }

    if (action.actionType === 'hechicera_save') {
        batch.update(playerDoc.ref, {
            "potions.save": action.round
        });
    }

    if (action.actionType === 'priest_bless' && action.targetId === action.playerId) {
        batch.update(playerDoc.ref, {
            priestSelfHealUsed: true
        });
    }

    await batch.commit();
    
    await checkEndNightEarly(db, action.gameId);

    return { success: true };
  } catch (error) {
    if ((error as any).code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: `games/${action.gameId}/night_actions`,
            operation: 'create',
            requestResourceData: action,
        });
        errorEmitter.emit('permission-error', permissionError);
        return { error: "Permiso denegado al realizar la acción nocturna." };
    }
    console.error("Error submitting night action: ", error);
    return { error: "No se pudo registrar tu acción." };
  }
}

export async function submitCupidAction(db: Firestore, gameId: string, cupidId: string, target1Id: string, target2Id: string) {
    try {
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
            lovers: [target1Id, target2Id]
        });
        
        await submitNightAction(db, {
            gameId,
            round: 1,
            playerId: cupidId,
            actionType: 'cupid_enchant',
            targetId: `${target1Id}|${target2Id}`,
        });

        return { success: true };
    } catch (error) {
        if ((error as any).code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `games/${gameId}`,
                operation: 'update',
                requestResourceData: { lovers: [target1Id, target2Id] },
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al elegir enamorados." };
        }
        console.error("Error submitting cupid action: ", error);
        return { error: "No se pudo registrar tu acción." };
    }
}


async function killPlayer(
  db: Firestore,
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
  
  const playerRef = doc(db, 'games', gameId, 'players', playerToKill.userId);

  if (playerToKill.role === 'hunter' && gameData.settings.hunter) {
    hunterTriggeredId = playerId;
    // Don't mark as dead yet, hunter shoots first
  } else if (playerToKill.role === 'wolf_cub' && gameData.settings.wolf_cub) {
    transaction.update(doc(db, 'games', gameId), { wolfCubRevengeRound: gameData.currentRound + 1 });
    transaction.update(playerRef, { isAlive: false });
  } else {
    transaction.update(playerRef, { isAlive: false });
  }

  if (gameData.lovers && gameData.lovers.includes(playerId)) {
    const otherLoverId = gameData.lovers.find(id => id !== playerId)!;
    const otherLoverPlayer = playersData.find(p => p.userId === otherLoverId);
    if (otherLoverPlayer && otherLoverPlayer.isAlive) {
      if (otherLoverPlayer.role === 'hunter' && gameData.settings.hunter) {
         if (!hunterTriggeredId) { // Prevent overwriting the first hunter
            hunterTriggeredId = otherLoverId;
         }
      } else {
        const otherLoverRef = doc(db, 'games', gameId, 'players', otherLoverPlayer.userId);
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

async function checkGameOver(db: Firestore, gameId: string, transaction: Transaction): Promise<boolean> {
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await transaction.get(gameRef);
    const gameData = { ...gameSnap.data() as Game, id: gameSnap.id };

    const playersQuery = query(collection(db, 'games', gameId, 'players'));
    
    const playersSnap = await transaction.get(playersQuery);
    const players = playersSnap.docs.map(doc => ({ ...doc.data() as Player, id: doc.id }));

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

export async function processNight(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found!");
            const game = { ...gameSnap.data() as Game, id: gameSnap.id };

            if (game.phase !== 'night' || game.status !== 'in_progress') return;

            const playersSnap = await transaction.get(query(collection(db, 'games', gameId, 'players')));
            const playersData = playersSnap.docs.map(doc => ({ ...doc.data() as Player, id: doc.id }));

            const actionsQuery = query(collection(db, 'games', gameId, 'night_actions'),
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
                    const playerRef = doc(db, 'games', gameId, 'players', targetPlayer.userId);
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
                    const result = await killPlayer(db, transaction, gameId, killedPlayer.userId, game, playersData);
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
                    const result = await killPlayer(db, transaction, gameId, killedPlayer.userId, game, playersData);
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
            
            const triggeredHunterId = nightKillResults.map(r => r.hunterId).find(id => id);
            if (triggeredHunterId) return; 

            const anyKills = nightKillResults.some(r => r.killedIds.length > 0);
            if (anyKills) {
                 const isGameOver = await checkGameOver(db, gameId, transaction);
                 if (isGameOver) return;
            }

            playersSnap.forEach(playerDoc => {
                const playerRef = doc(db, 'games', gameId, 'players', playerDoc.id);
                transaction.update(playerRef, { votedFor: null });
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


export async function submitVote(db: Firestore, gameId: string, voterId: string, targetId: string) {
    try {
        const playerRef = doc(db, 'games', gameId, 'players', voterId);
        const playerSnap = await getDoc(playerRef);

        if (playerSnap.exists()) {
            await updateDoc(playerRef, { votedFor: targetId });
            await checkEndDayEarly(db, gameId);
        }
        return { success: true };
    } catch (error) {
        if ((error as any).code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `games/${gameId}/players/${voterId}`,
                operation: 'update',
                requestResourceData: { votedFor: targetId },
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al votar." };
        }
        console.error("Error submitting vote: ", error);
        return { error: "No se pudo registrar tu voto." };
    }
}

export async function processVotes(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            const game = { ...gameSnap.data() as Game, id: gameSnap.id };

            if (game.phase !== 'day' || game.status !== 'in_progress') return;

            const playersSnap = await transaction.get(query(collection(db, 'games', gameId, 'players')));
            const playersData = playersSnap.docs.map(doc => ({ ...doc.data() as Player, id: doc.id }));
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
                    const playerRef = doc(db, 'games', gameId, 'players', lynchedPlayer.userId);
                    transaction.update(playerRef, { princeRevealed: true });
                } else {
                    lynchedPlayerId = potentialLynchedId;
                    eventMessage = `El pueblo ha decidido. ${lynchedPlayer.displayName} ha sido linchado.`;
                    voteKillResult = await killPlayer(db, transaction, gameId, lynchedPlayer.userId, game, playersData);
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
                 const isGameOver = await checkGameOver(db, gameId, transaction);
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

export async function getSeerResult(db: Firestore, gameId: string, seerId: string, targetId: string) {
  try {
    const seerPlayerDoc = await getPlayerDoc(db, gameId, seerId);
    if (!seerPlayerDoc || !seerPlayerDoc.exists()) {
        throw new Error("Seer player not found");
    }

    if (seerPlayerDoc.data()?.role !== 'seer') {
      throw new Error("No eres el vidente.");
    }
    
    const targetPlayerDoc = await getPlayerDoc(db, gameId, targetId);
     if (!targetPlayerDoc || !targetPlayerDoc.exists()) {
        throw new Error("Target player not found");
    }
    
    const gameDoc = await getDoc(doc(db, 'games', gameId));
    if (!gameDoc.exists()) {
      throw new Error("Game not found");
    }
    const game = { ...gameDoc.data() as Game, id: gameDoc.id };

    const targetPlayer = targetPlayerDoc.data() as Player;
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


export async function submitHunterShot(db: Firestore, gameId: string, hunterId: string, targetId: string) {
    const gameRef = doc(db, 'games', gameId);

    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            const game = { ...gameSnap.data() as Game, id: gameSnap.id };

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId) {
                throw new Error("No es tu momento de disparar.");
            }
            
            const playersQuery = query(collection(db, 'games', gameId, 'players'));
            const playersSnap = await transaction.get(playersQuery);
            const playersData = playersSnap.docs.map(doc => ({ ...doc.data() as Player, id: doc.id }));

            const hunterPlayer = playersData.find(p => p.userId === hunterId)!;
            const hunterPlayerRef = doc(db, 'games', gameId, 'players', hunterPlayer.userId);
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

            const targetKillResult = await killPlayer(db, transaction, gameId, targetId, game, playersData);
            
            // If the hunter shot another hunter, we need to resolve that before continuing
            if (targetKillResult.hunterId) {
                 transaction.update(gameRef, { 
                    pendingHunterShot: targetKillResult.hunterId, 
                    phase: 'hunter_shot' 
                });
                return; // End transaction here, the next hunter will trigger a new one
            }

            const isGameOver = await checkGameOver(db, gameId, transaction);
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
            const voteEventSnap = await getDocs(query(collection(db, 'game_events'), 
                where('gameId', '==', gameId),
                where('round', '==', game.currentRound),
                where('type', '==', 'vote_result')
            ));
            
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
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'update',
                requestResourceData: { pendingHunterShot: null },
            });
            errorEmitter.emit('permission-error', permissionError);
            return { error: "Permiso denegado al disparar." };
        }
        console.error("Error submitting hunter shot: ", error);
        return { error: error.message || "No se pudo registrar el disparo." };
    }
}

async function checkEndNightEarly(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) return;

    const game = { ...gameDoc.data() as Game, id: gameDoc.id };
    if (game.phase !== 'night') return;

    const playersQuery = query(collection(db, 'games', gameId, 'players'), where('isAlive', '==', true));
    const playersSnap = await getDocs(playersQuery);
    const alivePlayers = playersSnap.docs.map(p => p.data() as Player);
    
    const nightActionsQuery = query(collection(db, 'games', gameId, 'night_actions'), where('round', '==', game.currentRound));
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
        await processNight(db, gameId);
    }
}

async function checkEndDayEarly(db: Firestore, gameId: string) {
    const gameRef = doc(db, 'games', gameId);
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) return;

    const game = { ...gameDoc.data() as Game, id: gameDoc.id };
    if (game.phase !== 'day') return;

    const playersQuery = query(collection(db, 'games', gameId, 'players'), where('isAlive', '==', true));
    const playersSnap = await getDocs(playersQuery);
    const alivePlayers = playersSnap.docs.map(p => p.data() as Player);

    const allPlayersVoted = alivePlayers.every(p => !!p.votedFor);
    
    if (allPlayersVoted) {
        await processVotes(db, gameId);
    }
}

// AI Actions
const toJSONCompatible = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj.toDate === 'function') {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(toJSONCompatible);
    }
    if (typeof obj === 'object') {
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

export async function runAIActions(db: Firestore, gameId: string, phase: Game['phase']) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = { ...gameDoc.data() as Game, id: gameDoc.id };

        const playersSnap = await getDocs(query(collection(db, 'games', gameId, 'players')));
        const players = playersSnap.docs.map(p => ({ ...p.data() as Player, id: p.id }));
        
        const eventsSnap = await getDocs(query(collection(db, 'game_events'), where('gameId', '==', gameId), orderBy('createdAt', 'asc')));
        const events = eventsSnap.docs.map(e => e.data() as GameEvent);

        const aiPlayers = players.filter(p => p.isAI && p.isAlive);
        const alivePlayers = players.filter(p => p.isAlive);

        for (const ai of aiPlayers) {
             const nightActionsQuery = query(collection(db, 'games', gameId, 'night_actions'), where('round', '==', game.currentRound), where('playerId', '==', ai.userId));
            const existingNightActions = await getDocs(nightActionsQuery);
            if (phase === 'night' && !existingNightActions.empty) continue;
            
            if (phase === 'hunter_shot' && ai.userId !== game.pendingHunterShot) continue;

            const playerDocSnap = await getPlayerDoc(db, game.id, ai.userId);
            if (!playerDocSnap || !playerDocSnap.exists()) continue;

            if (phase === 'day' && playerDocSnap.exists() && playerDocSnap.data().votedFor) continue;

            const serializableGame = toJSONCompatible(game);
            const serializablePlayers = toJSONCompatible(players);
            const serializableEvents = toJSONCompatible(events);
            const serializableCurrentPlayer = toJSONCompatible(ai);

            const aiInput = {
                game: JSON.stringify(serializableGame),
                players: JSON.stringify(serializablePlayers),
                events: JSON.stringify(serializableEvents),
                currentPlayer: JSON.stringify(serializableCurrentPlayer),
            };

            const aiResult = await takeAITurn(aiInput);
            console.log(`AI (${ai.displayName} as ${ai.role}) action: ${aiResult.action}. Reasoning: ${aiResult.reasoning}`);

            const [actionType, targetData] = aiResult.action.split(':');

            if (!actionType || actionType === 'NONE') continue;

            const isValidTarget = (id: string | undefined): id is string => {
                return !!id && alivePlayers.some(p => p.userId === id);
            }
            
             const isValidMultiTarget = (ids: string | undefined): ids is string => {
                if (!ids) return false;
                // For Cupid, target can be self, who might be dead if shot.
                return ids.split('|').every(id => players.some(p => p.userId === id));
            }

            switch(actionType) {
                case 'KILL':
                    if (phase === 'night' && (ai.role === 'werewolf' || ai.role === 'wolf_cub') && isValidMultiTarget(targetData)) {
                        await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: 'werewolf_kill', targetId: targetData });
                    }
                    break;
                case 'CHECK':
                     if (phase === 'night' && ai.role === 'seer' && isValidTarget(targetData)) {
                        await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: 'seer_check', targetId: targetData });
                    }
                    break;
                case 'HEAL':
                     if (phase === 'night' && ai.role === 'doctor' && isValidTarget(targetData)) {
                        const targetPlayer = players.find(p => p.userId === targetData);
                         if (targetPlayer && targetPlayer.lastHealedRound !== game.currentRound - 1) {
                            await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: 'doctor_heal', targetId: targetData });
                         }
                    }
                    break;
                case 'PROTECT':
                     if (phase === 'night' && ai.role === 'guardian' && isValidTarget(targetData) && targetData !== ai.userId) {
                        await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: 'guardian_protect', targetId: targetData });
                    }
                    break;
                case 'BLESS':
                     if (phase === 'night' && ai.role === 'priest' && isValidTarget(targetData)) {
                         if(targetData === ai.userId && ai.priestSelfHealUsed) continue;
                        await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: 'priest_bless', targetId: targetData });
                    }
                    break;
                case 'POISON':
                    if (phase === 'night' && ai.role === 'hechicera' && isValidTarget(targetData) && !ai.potions?.poison) {
                        await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: 'hechicera_poison', targetId: targetData });
                    }
                    break;
                case 'SAVE':
                    if (phase === 'night' && ai.role === 'hechicera' && isValidTarget(targetData) && !ai.potions?.save) {
                        await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: 'hechicera_save', targetId: targetData });
                    }
                    break;
                case 'ENCHANT':
                    if (phase === 'night' && ai.role === 'cupid' && game.currentRound === 1 && isValidMultiTarget(targetData)) {
                        const [target1Id, target2Id] = targetData.split('|');
                        if (target1Id && target2Id) {
                            await submitCupidAction(db, gameId, ai.userId, target1Id, target2Id);
                        }
                    }
                    break;
                case 'VOTE':
                    if (phase === 'day' && isValidTarget(targetData)) {
                        await submitVote(db, gameId, ai.userId, targetData);
                    }
                    break;
                case 'SHOOT':
                    if (phase === 'hunter_shot' && ai.userId === game.pendingHunterShot && isValidTarget(targetData)) {
                        await submitHunterShot(db, gameId, ai.userId, targetData);
                    }
                    break;
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

    
