
'use server';

import { 
  Timestamp,
  type Transaction,
  DocumentReference,
  doc,
  increment
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type GameEvent, type PlayerRole, type PlayerPublicData, type PlayerPrivateData,
} from "@/types";
import { toPlainObject, getMillis } from "@/lib/utils";
import { roleDetails } from "./roles";
import { adminDb } from "./firebase-admin";

const PHASE_DURATION_SECONDS = 60;

const getRoleDistribution = (playerCount: number) => {
    if (playerCount < 5) return { werewolves: 1, special: 0 };
    if (playerCount < 8) return { werewolves: 1, special: 1 };
    if (playerCount < 11) return { werewolves: 2, special: 2 };
    if (playerCount < 14) return { werewolves: 3, special: 3 };
    return { werewolves: 4, special: 4 };
};

export const generateRoles = (playerCount: number, settings: Game['settings']): (PlayerRole)[] => {
    const roles: PlayerRole[] = [];
    const { werewolves: numWerewolves, special: numSpecial } = getRoleDistribution(playerCount);

    for (let i = 0; i < numWerewolves; i++) {
        roles.push('werewolf');
    }

    const availableSpecialRoles: PlayerRole[] = (Object.keys(settings) as Array<keyof typeof settings>)
        .filter(key => {
            const roleKey = key as PlayerRole;
            return settings[key] === true && roleKey && roleDetails[roleKey]?.team !== 'Lobos'; // Exclude wolf-team roles from special pool
        })
        .sort(() => Math.random() - 0.5) as PlayerRole[];
    
    let specialRolesAdded = 0;
    for (const specialRole of availableSpecialRoles) {
        if (specialRolesAdded >= numSpecial) break;

        if (specialRole === 'twin') {
            if (roles.length + 2 <= playerCount) {
                roles.push('twin', 'twin');
                specialRolesAdded += 2; // Twins count as two special roles
            }
        } else {
            roles.push(specialRole);
            specialRolesAdded++;
        }
    }
    
    while (roles.length < playerCount) {
        roles.push('villager');
    }

    return roles.sort(() => Math.random() - 0.5);
};

async function getFullPlayersTransactional(transaction: Transaction, gameId: string, game: Game): Promise<Player[]> {
    const playerPrivateRefs = game.players.map(p => doc(adminDb, 'games', gameId, 'playerData', p.userId));
    const playerPrivateSnaps = await transaction.getAll(...playerPrivateRefs);

    const privateDataMap = new Map<string, PlayerPrivateData>();
    playerPrivateSnaps.forEach(snap => {
        if (snap.exists()) {
            privateDataMap.set(snap.id, snap.data() as PlayerPrivateData);
        }
    });

    const fullPlayers: Player[] = game.players.map(publicData => {
        const privateData = privateDataMap.get(publicData.userId) || {};
        return { ...publicData, ...privateData } as Player;
    });

    return fullPlayers;
}

async function performKill(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, players: Player[], playerIdToKill: string | null, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; updatedPlayers: Player[]; triggeredHunterId: string | null; }> {
    let newGameData = { ...gameData };
    let newPlayers = [...players];
    let triggeredHunterId: string | null = null;
    
    if (!playerIdToKill) return { updatedGame: newGameData, updatedPlayers: newPlayers, triggeredHunterId };

    const killQueue: {id: string, cause: GameEvent['type'], message?: string}[] = [{id: playerIdToKill, cause, message: customMessage}];
    const alreadyProcessed = new Set<string>();

    while (killQueue.length > 0) {
        const {id: currentIdToKill, cause: currentCause, message: currentMessage} = killQueue.shift()!;
        if (!currentIdToKill || alreadyProcessed.has(currentIdToKill)) {
            continue;
        }

        const playerIndex = newPlayers.findIndex((p: Player) => p.userId === currentIdToKill);
        if (playerIndex === -1 || !newPlayers[playerIndex].isAlive) {
            continue;
        }
        
        alreadyProcessed.add(currentIdToKill);
        const playerToKill = { ...newPlayers[playerIndex] };
        
        newPlayers[playerIndex].isAlive = false;
        
        const deathMessage = currentMessage || `${playerToKill.displayName} ha muerto. Su rol era: ${roleDetails[playerToKill.role!]?.name || 'Desconocido'}`;

        newGameData.events.push({
            id: `evt_${currentCause}_${Date.now()}_${currentIdToKill}`,
            gameId: newGameData.id!, round: newGameData.currentRound, type: currentCause,
            message: deathMessage,
            data: { killedPlayerIds: [currentIdToKill], revealedRole: playerToKill.role }, createdAt: new Date(),
        });
        
        // Shapeshifter transformation logic
        const shapeshifterIndex = newPlayers.findIndex((p: Player) => 
            p.isAlive && 
            p.role === 'shapeshifter' && 
            p.shapeshifterTargetId === playerToKill.userId
        );

        if (shapeshifterIndex !== -1 && playerToKill.role) {
            const shifter = newPlayers[shapeshifterIndex];
            const newRole = playerToKill.role;
            
            // Update the local mutable copy of players
            newPlayers[shapeshifterIndex].role = newRole;
            newPlayers[shapeshifterIndex].shapeshifterTargetId = null; 
            
            // Update the private data on Firestore within the transaction
            const shifterPrivateRef = doc(adminDb, 'games', newGameData.id, 'playerData', shifter.userId);
            transaction.update(shifterPrivateRef, {
                role: newRole,
                shapeshifterTargetId: null,
            });

            newGameData.events.push({ 
                id: `evt_transform_${Date.now()}_${shifter.userId}`,
                gameId: newGameData.id, 
                round: newGameData.currentRound, 
                type: 'special',
                message: `¡Has cambiado de forma! Ahora eres: ${roleDetails[newRole]?.name || 'un rol desconocido'}. Tu nuevo objetivo es ganar con tu nuevo equipo.`,
                data: { targetId: shifter.userId }, // This makes the event private to the shapeshifter
                createdAt: new Date(),
            });
        }
        
        // Post-death triggers
        if (playerToKill.role === 'seer' && newGameData.settings.seer_apprentice) newGameData.seerDied = true;
        if (playerToKill.role === 'hunter' && newGameData.settings.hunter && !triggeredHunterId) triggeredHunterId = playerToKill.userId;
        if (playerToKill.role === 'leprosa' && currentCause === 'werewolf_kill') newGameData.leprosaBlockedRound = newGameData.currentRound + 1;
        if (playerToKill.role === 'wolf_cub') newGameData.wolfCubRevengeRound = newGameData.currentRound;

        const checkAndQueueChainDeath = (linkedIds: (string[] | null | undefined), deadPlayer: Player, messageTemplate: string, eventType: GameEvent['type']) => {
            if (!linkedIds || !linkedIds.includes(deadPlayer.userId)) return;

            const otherId = linkedIds.find(id => id !== deadPlayer.userId);
            const otherPlayer = otherId ? newPlayers.find(p => p.userId === otherId) : undefined;
            
            if (otherPlayer && otherPlayer.isAlive && !alreadyProcessed.has(otherId!) && !killQueue.some(k => k.id === otherId)) {
                killQueue.push({
                    id: otherId!,
                    cause: eventType,
                    message: messageTemplate.replace('{otherName}', otherPlayer.displayName).replace('{victimName}', deadPlayer.displayName),
                });
            }
        };
        
        if (playerToKill.isLover && newGameData.lovers) {
             const otherLoverId = newGameData.lovers.find(id => id !== playerToKill.userId);
             if (otherLoverId) {
                checkAndQueueChainDeath([playerToKill.userId, otherLoverId], playerToKill, 'Por un amor eterno, {otherName} se quita la vida tras la muerte de {victimName}.', 'lover_death');
             }
        }
        
        if (playerToKill.virginiaWoolfTargetId) {
             checkAndQueueChainDeath([playerToKill.userId, playerToKill.virginiaWoolfTargetId], playerToKill, 'Arrastrado por un vínculo fatal, {otherName} muere junto a {victimName}.', 'special');
        }
    }
    
    return { updatedGame: newGameData, updatedPlayers: newPlayers, triggeredHunterId };
}


export async function killPlayer(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, players: Player[], playerIdToKill: string, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; updatedPlayers: Player[]; triggeredHunterId: string | null; }> {
    const playerToKill = players.find(p => p.userId === playerIdToKill);
    if (!playerToKill || !playerToKill.isAlive) return { updatedGame: gameData, updatedPlayers: players, triggeredHunterId: null };

    if (cause === 'vote_result' && playerToKill.role === 'prince' && gameData.settings.prince && !playerToKill.princeRevealed) {
        const playerIndex = players.findIndex(p => p.userId === playerIdToKill);
        if (playerIndex > -1) {
            let updatedGame = { ...gameData };
            let updatedPlayers = [...players];
            updatedPlayers[playerIndex].princeRevealed = true;
            
            const playerPublicRef = doc(adminDb, 'games', gameData.id, 'players', playerIdToKill);
            transaction.update(playerPublicRef, { princeRevealed: true });

            updatedGame.events.push({
                id: `evt_prince_reveal_${Date.now()}`,
                gameId: gameData.id,
                round: gameData.currentRound,
                type: 'vote_result',
                message: `${playerToKill.displayName} ha sido sentenciado, ¡pero revela su identidad como Príncipe y sobrevive!`,
                createdAt: new Date(),
                data: { lynchedPlayerId: null, final: true, revealedPlayerId: playerIdToKill },
            });
            return { updatedGame, updatedPlayers, triggeredHunterId: null };
        }
    }
    
    return performKill(transaction, gameRef, gameData, players, playerIdToKill, cause, customMessage);
}

export async function killPlayerUnstoppable(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, players: Player[], playerIdToKill: string, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; updatedPlayers: Player[]; triggeredHunterId: string | null; }> {
    return performKill(transaction, gameRef, gameData, players, playerIdToKill, cause, customMessage);
}

export async function processNightEngine(transaction: Transaction, gameRef: DocumentReference<Game>, game: Game, fullPlayers: Player[]) {
  
  if (game.phaseEndsAt && getMillis(game.phaseEndsAt) > Date.now()) {
      console.warn("processNight called before phase end. Ignoring.");
      return;
  }

  if (game.phase === 'role_reveal' && game.status === 'in_progress') {
     const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
     transaction.update(gameRef, toPlainObject({ phase: 'night', phaseEndsAt, currentRound: 1 }));
     return;
  }
  
  if (game.phase !== 'night' || game.status === 'finished') {
      return;
  }
  
  const initialPlayers = JSON.parse(JSON.stringify(fullPlayers));
  const actions = (game.nightActions?.filter(a => a.round === game.currentRound) || [])
      .sort((a, b) => getActionPriority(a.actionType) - getActionPriority(b.actionType));

  // =================================================================
  // START DETERMINISTIC NIGHT RESOLUTION
  // =================================================================
  
  // 1. Initialize resolution context
  const context = {
      protections: new Map<string, Set<'guard' | 'bless'>>(), // targetId -> protection types
      deathMarks: new Map<string, GameEvent['type']>(), // targetId -> cause of death
      savedByHealPotion: new Set<string>(), // targetIds saved by Hechicera
      bites: new Map<string, number>(), // targetId -> new bite count
      gameUpdates: {} as Partial<Game>,
      playerUpdates: new Map<string, Partial<Player>>(),
      events: [] as GameEvent[],
  };

  const getPlayer = (userId: string) => {
      const updatedPlayer = context.playerUpdates.get(userId);
      const originalPlayer = fullPlayers.find(p => p.userId === userId);
      return { ...originalPlayer, ...updatedPlayer } as Player;
  }

  // 2. Apply all actions sequentially to build the resolution context
  for (const action of actions) {
      const actor = getPlayer(action.playerId);
      if (!actor || !actor.isAlive || actor.isExiled) continue;

      const targetIds = action.targetId.split('|');

      for (const targetId of targetIds) {
          const target = getPlayer(targetId);
          if (!target) continue;

          switch (action.actionType) {
              case 'priest_bless':
              case 'guardian_protect':
              case 'doctor_heal':
                  const protectionType = action.actionType === 'priest_bless' ? 'bless' : 'guard';
                  const currentProtections = context.protections.get(targetId) || new Set();
                  currentProtections.add(protectionType);
                  context.protections.set(targetId, currentProtections);
                  break;

              case 'werewolf_kill':
                  if (!context.protections.get(targetId)?.has('guard') && !context.protections.get(targetId)?.has('bless')) {
                      context.deathMarks.set(targetId, 'werewolf_kill');
                  }
                  break;
              
              case 'hechicera_poison':
                  if (!context.protections.get(targetId)?.has('bless')) {
                     context.deathMarks.set(targetId, 'special');
                  }
                  break;

              case 'fairy_kill':
                   if (!context.protections.get(targetId)?.has('bless')) {
                       context.deathMarks.set(targetId, 'special');
                       context.gameUpdates.fairyKillUsed = true;
                   }
                  break;

              case 'vampire_bite':
                  const newBiteCount = (target.biteCount || 0) + 1;
                  context.bites.set(targetId, newBiteCount);
                  if (newBiteCount >= 3) {
                      context.deathMarks.set(targetId, 'vampire_kill');
                      context.gameUpdates.vampireKills = (game.vampireKills || 0) + 1;
                  }
                  break;

               case 'hechicera_save':
                    if (context.deathMarks.has(targetId)) {
                        context.savedByHealPotion.add(targetId);
                        context.deathMarks.delete(targetId);
                    }
                    break;
              
              case 'cult_recruit':
                  context.playerUpdates.set(targetId, { ...context.playerUpdates.get(targetId), isCultMember: true });
                  break;
              
              case 'silencer_silence':
                  context.gameUpdates.silencedPlayerId = targetId;
                  break;

              case 'elder_leader_exile':
                  const exiledPlayer = context.playerUpdates.get(targetId) || {};
                  context.playerUpdates.set(targetId, { ...exiledPlayer, isExiled: true });
                  break;
          }
      }
  }

  // 3. Commit state changes from context to a mutable copy of the game
  let mutableGame = JSON.parse(JSON.stringify(game));
  let mutableFullPlayers = JSON.parse(JSON.stringify(fullPlayers));
  Object.assign(mutableGame, context.gameUpdates);

  context.playerUpdates.forEach((updates, userId) => {
      const playerIndex = mutableFullPlayers.findIndex((p:Player) => p.userId === userId);
      if (playerIndex !== -1) {
          mutableFullPlayers[playerIndex] = { ...mutableFullPlayers[playerIndex], ...updates };
      }
  });
   context.bites.forEach((count, userId) => {
        const playerIndex = mutableFullPlayers.findIndex((p:Player) => p.userId === userId);
        if (playerIndex !== -1) {
            mutableFullPlayers[playerIndex].biteCount = count;
        }
    });

  // 4. Execute deaths
  let triggeredHunterId: string | null = null;
  let killedPlayerIds: string[] = [];

  for (const [targetId, cause] of context.deathMarks.entries()) {
      const { updatedGame, updatedPlayers, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, mutableGame, mutableFullPlayers, targetId, cause, `Anoche, el pueblo perdió a ${mutableFullPlayers.find((p:Player)=>p.userId === targetId)?.displayName}.`);
      mutableGame = updatedGame;
      mutableFullPlayers = updatedPlayers;
      killedPlayerIds.push(targetId);
      if(newHunterId) triggeredHunterId = newHunterId;
  }
  
  // Banshee scream check
    const bansheeAction = actions.find(a => a.actionType === 'banshee_scream');
    if (bansheeAction) {
        const screamTargetId = bansheeAction.targetId;
        if (killedPlayerIds.includes(screamTargetId)) {
            const bansheePrivateRef = doc(adminDb, 'games', game.id, 'playerData', bansheeAction.playerId);
            transaction.update(bansheePrivateRef, { bansheePoints: increment(1) });
        }
    }


  // 5. Finalize night results
  let gameOverInfo = await checkGameOver(transaction, mutableGame);
  if (gameOverInfo.isGameOver) {
      mutableGame.status = "finished";
      mutableGame.phase = "finished";
      mutableGame.events.push({ id: `evt_gameover_${Date.now()}`, gameId: mutableGame.id, round: mutableGame.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
      
      const {publicPlayersData} = splitFullPlayerList(mutableFullPlayers);
      transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: publicPlayersData, events: mutableGame.events }));
      return;
  }

  if (triggeredHunterId) {
      mutableGame.pendingHunterShot = triggeredHunterId;
      const {publicPlayersData} = splitFullPlayerList(mutableFullPlayers);
      transaction.update(gameRef, toPlainObject({ players: publicPlayersData, events: mutableGame.events, phase: 'hunter_shot', pendingHunterShot: mutableGame.pendingHunterShot }));
      return;
  }
  
  let nightMessage;
  if (killedPlayerIds.length > 0) {
      const killedNames = killedPlayerIds.map(id => initialPlayers.find((p:any) => p.userId === id)?.displayName).join(', ');
      nightMessage = `Anoche, el pueblo perdió a ${killedNames}.`;
  } else if (context.deathMarks.size > 0 && (context.savedByHealPotion.size > 0 || context.protections.size > 0)) {
      nightMessage = "La noche fue tensa. Los lobos atacaron, pero alguien fue salvado por una fuerza protectora.";
  } else {
      nightMessage = "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
  }
  
  const savedIds = new Set([...context.savedByHealPotion, ...Array.from(context.protections.keys())]);
  mutableGame.events.push({ id: `evt_night_${mutableGame.currentRound}`, gameId: mutableGame.id, round: mutableGame.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: killedPlayerIds, savedPlayerIds: Array.from(savedIds) }, createdAt: new Date() });

  mutableFullPlayers.forEach((p: Player) => { 
    const playerPrivateRef = doc(adminDb, 'games', mutableGame.id, 'playerData', p.userId);
    transaction.update(playerPrivateRef, { usedNightAbility: false });
  });
  
  mutableGame.exiledPlayerId = null;

  const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
  
  const {publicPlayersData} = splitFullPlayerList(mutableFullPlayers);

  transaction.update(gameRef, toPlainObject({
      players: publicPlayersData,
      events: mutableGame.events,
      phase: 'day', phaseEndsAt,
      pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null,
  }));
}
export async function processVotesEngine(transaction: Transaction, gameRef: DocumentReference<Game>, game: Game, fullPlayers: Player[]) {
    if (game.phase !== 'day') return;
    
    if (game.phaseEndsAt && getMillis(game.phaseEndsAt) > Date.now()) {
        console.warn("processVotes called before phase end. Ignoring.");
        return;
    }

    const lastVoteEvent = [...game.events].sort((a,b) => getMillis(b.createdAt) - getMillis(a.createdAt)).find(e => e.type === 'vote_result');
    const isTiebreaker = Array.isArray(lastVoteEvent?.data?.tiedPlayerIds) && !lastVoteEvent?.data?.final;

    const alivePlayers = fullPlayers.filter(p => p.isAlive);
    const voteCounts: Record<string, number> = {};
    
    alivePlayers.forEach(player => {
        if (player.votedFor) {
            if (!isTiebreaker || (lastVoteEvent.data.tiedPlayerIds && lastVoteEvent.data.tiedPlayerIds.includes(player.votedFor))) {
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
        game.events.push({ id: `evt_vote_tie_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message: `¡La votación resultó en un empate! Se requiere una segunda votación solo entre los siguientes jugadores: ${mostVotedPlayerIds.map(id => game.players.find(p=>p.userId === id)?.displayName).join(', ')}.`, data: { tiedPlayerIds: mostVotedPlayerIds, final: false }, createdAt: new Date() });
        fullPlayers.forEach(p => { 
            const playerPrivateRef = doc(adminDb, 'games', game.id, 'playerData', p.userId);
            transaction.update(playerPrivateRef, { votedFor: null });
        });
        const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
        transaction.update(gameRef, toPlainObject({ events: game.events, phaseEndsAt }));
        return;
    }

    if (mostVotedPlayerIds.length > 1 && isTiebreaker && game.settings.juryVoting) {
         game.phase = "jury_voting";
         game.events.push({ id: `evt_jury_vote_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message: `¡El pueblo sigue dividido! Los espíritus de los caídos emitirán el voto final para decidir el destino de: ${mostVotedPlayerIds.map(id => game.players.find(p => p.userId === id)?.displayName).join(' o ')}.`, data: { tiedPlayerIds: mostVotedPlayerIds, final: false }, createdAt: new Date() });
         const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
         transaction.update(gameRef, toPlainObject({ events: game.events, phase: "jury_voting", phaseEndsAt }));
         return;
    }

    let lynchedPlayerId: string | null = mostVotedPlayerIds[0] || null;
    let lynchedPlayerObject: Player | null = null;
    let triggeredHunterId: string | null = null;

    if (lynchedPlayerId) {
        const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, fullPlayers, lynchedPlayerId, 'vote_result', `El pueblo ha hablado. ${game.players.find(p => p.userId === lynchedPlayerId)?.displayName} ha sido linchado.`);
        game = updatedGame;
        triggeredHunterId = newHunterId;
        lynchedPlayerObject = fullPlayers.find(p => p.userId === lynchedPlayerId) || null;
    } else {
        const message = isTiebreaker ? 'Tras un segundo empate, el pueblo decide perdonar una vida hoy.' : 'El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.';
        game.events.push({ id: `evt_vote_result_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message, data: { lynchedPlayerId: null, final: true }, createdAt: new Date() });
    }

    let gameOverInfo = await checkGameOver(transaction, game, lynchedPlayerObject);
    if (gameOverInfo.isGameOver) {
        game.status = "finished";
        game.phase = "finished";
        game.events.push({ id: `evt_gameover_${Date.now()}`, gameId: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
        transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', events: game.events }));
        return;
    }

    if (triggeredHunterId) {
        game.pendingHunterShot = triggeredHunterId;
        transaction.update(gameRef, toPlainObject({ events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
        return;
    }

    const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);

    transaction.update(gameRef, toPlainObject({
        ...game,
        phase: 'night',
        currentRound: game.currentRound + 1,
        phaseEndsAt
    }));
}
export async function processJuryVotesEngine(transaction: Transaction, gameRef: DocumentReference<Game>, game: Game, fullPlayers: Player[]) {
    if (game.phase !== 'jury_voting') return;

    if (game.phaseEndsAt && getMillis(game.phaseEndsAt) > Date.now()) {
        console.warn("processJuryVotes called before phase end. Ignoring.");
        return;
    }

    const juryVotes = game.juryVotes || {};
    const voteCounts: Record<string, number> = {};
    Object.values(juryVotes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    
    let maxVotes = 0;
    let mostVotedPlayerId: string | null = null;
    let tie = false;

    for (const playerId in voteCounts) {
        if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            mostVotedPlayerId = playerId;
            tie = false;
        } else if (voteCounts[playerId] === maxVotes) {
            tie = true;
        }
    }
    
    if (tie && mostVotedPlayerId) {
        const tiedPlayers = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
        mostVotedPlayerId = tiedPlayers[Math.floor(Math.random() * tiedPlayers.length)];
    }
    
    let lynchedPlayerObject: Player | null = null;
    let triggeredHunterId: string | null = null;

    if (mostVotedPlayerId) {
        const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, fullPlayers, mostVotedPlayerId, 'vote_result', `El jurado de los muertos ha decidido. ${game.players.find(p=>p.userId === mostVotedPlayerId)?.displayName} ha sido linchado.`);
        game = updatedGame;
        triggeredHunterId = newHunterId;
        lynchedPlayerObject = fullPlayers.find(p => p.userId === mostVotedPlayerId) || null;
    } else {
         game.events.push({ id: `evt_jury_no_vote_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message: "El jurado de los muertos no llegó a un consenso. Nadie es linchado.", data: { lynchedPlayerId: null, final: true }, createdAt: new Date() });
    }
    
    let gameOverInfo = await checkGameOver(transaction, game, lynchedPlayerObject);
    if (gameOverInfo.isGameOver) {
        game.status = "finished";
        game.phase = "finished";
        game.events.push({ id: `evt_gameover_${Date.now()}`, gameId: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
        transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events }));
        return;
    }

    if (triggeredHunterId) {
        game.pendingHunterShot = triggeredHunterId;
        transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
        return;
    }

    const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);

    transaction.update(gameRef, toPlainObject({
        ...game, phase: 'night', currentRound: game.currentRound + 1, phaseEndsAt, players: game.players.map(p => ({...p, votedFor: null}))
    }));
}


export async function checkGameOver(transaction: Transaction, gameData: Game, lynchedPlayer?: Player | null): Promise<{ isGameOver: boolean; message: string; winnerCode?: string; winners: Player[] }> {
    if (gameData.status === 'finished') {
        const lastEvent = gameData.events.find(e => e.type === 'game_over');
        return { isGameOver: true, message: lastEvent?.message || "La partida ha terminado.", winnerCode: lastEvent?.data?.winnerCode, winners: lastEvent?.data?.winners || [] };
    }
    
    const fullPlayers = await getFullPlayersTransactional(transaction, gameData.id, gameData);
    const alivePlayers = fullPlayers.filter(p => p.isAlive);
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'witch', 'seeker_fairy'];

    // Individual win conditions take priority
    if (lynchedPlayer) {
        if (lynchedPlayer.role === 'drunk_man' && gameData.settings.drunk_man) {
            return {
                isGameOver: true,
                winnerCode: 'drunk_man',
                message: `¡El Hombre Ebrio ha ganado! Ha conseguido que el pueblo lo linche.`,
                winners: [lynchedPlayer],
            };
        }
        
        const executioner = fullPlayers.find(p => p.role === 'executioner' && p.isAlive);
        if (executioner && executioner.executionerTargetId === lynchedPlayer.userId) {
            return {
                isGameOver: true,
                winnerCode: 'executioner',
                message: `¡El Verdugo ha ganado! Ha logrado su objetivo de que el pueblo linche a ${lynchedPlayer.displayName}.`,
                winners: [executioner],
            };
        }
    }

     if (gameData.settings.banshee) {
        const banshee = fullPlayers.find(p => p.role === 'banshee' && p.isAlive);
        if (banshee && (banshee.bansheePoints || 0) >= 2) {
             return {
                isGameOver: true,
                winnerCode: 'banshee',
                message: `¡La Banshee ha ganado! Sus dos gritos han sentenciado a muerte y ha cumplido su objetivo.`,
                winners: [banshee],
            };
        }
    }

    if (gameData.lovers) {
        const aliveLovers = alivePlayers.filter(p => gameData.lovers!.includes(p.userId));
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length >= 2) {
            return {
                isGameOver: true, winnerCode: 'lovers',
                message: '¡El amor ha triunfado! Los enamorados son los únicos supervivientes.',
                winners: aliveLovers
            };
        }
    }

    // Team win conditions
    const aliveWolvesCount = alivePlayers.filter(p => p.role && wolfRoles.includes(p.role)).length;
    const aliveCivilians = alivePlayers.filter(p => p.role && !wolfRoles.includes(p.role));

    if (aliveWolvesCount > 0 && aliveWolvesCount >= aliveCivilians.length) {
        return { isGameOver: true, winnerCode: 'wolves', message: "¡Los hombres lobo han ganado! Superan en número al pueblo.", winners: fullPlayers.filter(p => p.role && wolfRoles.includes(p.role)) };
    }
    
    const threats = alivePlayers.filter(p => p.role && wolfRoles.includes(p.role));
    if (threats.length === 0 && alivePlayers.length > 0) {
        return { isGameOver: true, winnerCode: 'villagers', message: "¡El pueblo ha ganado! Todas las amenazas han sido eliminadas.", winners: aliveCivilians };
    }
    
    if (alivePlayers.length === 0) {
        return { isGameOver: true, winnerCode: 'draw', message: "¡Nadie ha sobrevivido a la masacre!", winners: [] };
    }

    return { isGameOver: false, message: "", winners: [] };
}


const getActionPriority = (actionType: NightActionType) => {
    switch (actionType) {
        case 'silencer_silence':
        case 'elder_leader_exile':
            return 1;
        case 'priest_bless':
        case 'guardian_protect':
        case 'doctor_heal':
            return 2;
        case 'werewolf_kill':
        case 'hechicera_poison':
        case 'fairy_kill':
        case 'vampire_bite':
            return 3;
        case 'hechicera_save':
            return 4;
        case 'seer_check':
        case 'cult_recruit':
        case 'witch_hunt':
        case 'lookout_spy':
        case 'banshee_scream':
        case 'fairy_find':
            return 5;
        default:
            return 99; // Actions that don't need ordering
    }
}

const splitPlayerData = (player: Player): { publicData: PlayerPublicData, privateData: PlayerPrivateData } => {
  const { 
    userId, gameId, displayName, avatarUrl, isAlive, isAI, 
    princeRevealed, joinedAt, votedFor, lastActiveAt,
    ...privateData
  } = player;

  const publicData: PlayerPublicData = {
    userId, gameId, displayName, avatarUrl, isAlive, isAI,
    princeRevealed, joinedAt, votedFor, lastActiveAt
  };

  return { publicData, privateData };
}

const splitFullPlayerList = (fullPlayers: Player[]): { publicPlayersData: PlayerPublicData[], privatePlayersData: Record<string, PlayerPrivateData> } => {
    const publicPlayersData: PlayerPublicData[] = [];
    const privatePlayersData: Record<string, PlayerPrivateData> = {};

    fullPlayers.forEach(player => {
        const { publicData, privateData } = splitPlayerData(player);
        publicPlayersData.push(publicData);
        privatePlayersData[player.userId] = privateData;
    });

    return { publicPlayersData, privatePlayersData };
};
