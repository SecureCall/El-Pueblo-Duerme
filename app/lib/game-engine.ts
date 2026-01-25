
'use server';

import { 
  Timestamp,
  type Transaction,
  DocumentReference,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type GameEvent, type PlayerRole, type NightActionType,
} from "@/types";
import { toPlainObject, getMillis } from "@/lib/utils";
import { roleDetails } from "@/lib/roles";

const PHASE_DURATION_SECONDS = 60;

const getActionPriority = (actionType: NightActionType): number => {
    const priorityMap: Record<NightActionType, number> = {
        // Setup phase actions
        'cupid_love': 10,
        'shapeshifter_select': 15,
        'virginia_woolf_link': 16,
        'river_siren_charm': 17,
        
        // Control & Blocking
        'elder_leader_exile': 20,
        'silencer_silence': 25,

        // Protection
        'priest_bless': 30,
        'guardian_protect': 35,
        'doctor_heal': 35,

        // Information Gathering
        'seer_check': 50,
        'witch_hunt': 55,
        'seeker_fairy': 60,
        'lookout_spy': 65,
        
        // Recruitment
        'cult_recruit': 70,
        'fisherman_catch': 71,

        // Killing / Lethal Actions
        'werewolf_kill': 80,
        'vampire_bite': 81,
        'hechicera_poison': 82,
        'fairy_kill': 83,

        // Post-Damage Saves
        'hechicera_save': 90,
        
        // Resurrection
        'resurrect': 95,
        
        // Prediction
        'banshee_scream': 100,
    };
    return priorityMap[actionType] || 999;
};


export async function processNight(transaction: Transaction, gameRef: DocumentReference<Game>) {
  const gameSnap = await transaction.get(gameRef);
  if (!gameSnap.exists()) throw new Error("Game not found!");
  
  let game = gameSnap.data()!;
  
  if (game.phaseEndsAt && getMillis(game.phaseEndsAt) > Date.now()) {
      console.warn("processNight called before phase end. Ignoring.");
      return;
  }

  if (game.phase === 'role_reveal' && game.status === 'in_progress') {
     const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
     transaction.update(gameRef, toPlainObject({ phase: 'night', phaseEndsAt }));
     return;
  }
  
  if (game.phase !== 'night' || game.status === 'finished') {
      return;
  }
  
  const initialPlayers = JSON.parse(JSON.stringify(game.players));
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
      const originalPlayer = game.players.find(p => p.userId === userId);
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

  // 3. Commit state changes from context to the main game object
  Object.assign(game, context.gameUpdates);
  context.playerUpdates.forEach((updates, userId) => {
      const playerIndex = game.players.findIndex(p => p.userId === userId);
      if (playerIndex !== -1) {
          game.players[playerIndex] = { ...game.players[playerIndex], ...updates };
      }
  });
   context.bites.forEach((count, userId) => {
        const playerIndex = game.players.findIndex(p => p.userId === userId);
        if (playerIndex !== -1) {
            game.players[playerIndex].biteCount = count;
        }
    });

  // 4. Execute deaths
  let triggeredHunterId: string | null = null;
  let killedPlayerIds: string[] = [];

  for (const [targetId, cause] of context.deathMarks.entries()) {
      const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, targetId, cause, `Anoche, el pueblo perdió a ${game.players.find(p=>p.userId === targetId)?.displayName}.`);
      game = updatedGame;
      killedPlayerIds.push(targetId);
      if(newHunterId) triggeredHunterId = newHunterId;
  }
  
  // 5. Finalize night results
  let gameOverInfo = await checkGameOver(game);
  if (gameOverInfo.isGameOver) {
      game.status = "finished";
      game.phase = "finished";
      game.events.push({ id: `evt_gameover_${Date.now()}`, gameId: game.id, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
      transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events }));
      return;
  }

  if (triggeredHunterId) {
      game.pendingHunterShot = triggeredHunterId;
      transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
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
  game.events.push({ id: `evt_night_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: killedPlayerIds, savedPlayerIds: Array.from(savedIds) }, createdAt: new Date() });

  game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; p.isExiled = false; });
  const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
  
  transaction.update(gameRef, toPlainObject({
      ...game,
      phase: 'day', phaseEndsAt,
      pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null,
  }));
}
export async function processVotes(transaction: Transaction, gameRef: DocumentReference<Game>) {
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists()) throw new Error("Game not found.");
    let game = gameSnap.data()!;
    if (game.phase !== 'day') return;
    
    if (game.phaseEndsAt && getMillis(game.phaseEndsAt) > Date.now()) {
        console.warn("processVotes called before phase end. Ignoring.");
        return;
    }

    const lastVoteEvent = [...game.events].sort((a,b) => getMillis(b.createdAt) - getMillis(a.createdAt)).find(e => e.type === 'vote_result');
    const isTiebreaker = Array.isArray(lastVoteEvent?.data?.tiedPlayerIds) && !lastVoteEvent?.data?.final;

    const alivePlayers = game.players.filter(p => p.isAlive);
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
        game.players.forEach(p => { p.votedFor = null; });
        const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
        transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phaseEndsAt }));
        return;
    }

    if (mostVotedPlayerIds.length > 1 && isTiebreaker && game.settings.juryVoting) {
         game.phase = "jury_voting";
         game.events.push({ id: `evt_jury_vote_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message: `¡El pueblo sigue dividido! Los espíritus de los caídos emitirán el voto final para decidir el destino de: ${mostVotedPlayerIds.map(id => game.players.find(p => p.userId === id)?.displayName).join(' o ')}.`, data: { tiedPlayerIds: mostVotedPlayerIds, final: false }, createdAt: new Date() });
         game.players.forEach(p => { p.votedFor = null; });
         const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
         transaction.update(gameRef, toPlainObject({ events: game.events, phase: "jury_voting", phaseEndsAt }));
         return;
    }

    let lynchedPlayerId: string | null = mostVotedPlayerIds[0] || null;
    let lynchedPlayerObject: Player | null = null;
    let triggeredHunterId: string | null = null;

    if (lynchedPlayerId) {
        const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, lynchedPlayerId, 'vote_result', `El pueblo ha hablado. ${game.players.find(p => p.userId === lynchedPlayerId)?.displayName} ha sido linchado.`);
        game = updatedGame;
        triggeredHunterId = newHunterId;
        lynchedPlayerObject = game.players.find(p => p.userId === lynchedPlayerId) || null;
    } else {
        const message = isTiebreaker ? 'Tras un segundo empate, el pueblo decide perdonar una vida hoy.' : 'El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.';
        game.events.push({ id: `evt_vote_result_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message, data: { lynchedPlayerId: null, final: true }, createdAt: new Date() });
    }

    let gameOverInfo = await checkGameOver(game, lynchedPlayerObject);
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

    game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; p.isExiled = false; });
    const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);

    transaction.update(gameRef, toPlainObject({
        ...game,
        phase: 'night',
        currentRound: game.currentRound + 1,
        phaseEndsAt
    }));
}
export async function processJuryVotes(transaction: Transaction, gameRef: DocumentReference<Game>) {
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists()) throw new Error("Game not found.");
    let game = gameSnap.data()!;
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
        const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, mostVotedPlayerId, 'vote_result', `El jurado de los muertos ha decidido. ${game.players.find(p=>p.userId === mostVotedPlayerId)?.displayName} ha sido linchado.`);
        game = updatedGame;
        triggeredHunterId = newHunterId;
        lynchedPlayerObject = game.players.find(p => p.userId === mostVotedPlayerId) || null;
    } else {
         game.events.push({ id: `evt_jury_no_vote_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message: "El jurado de los muertos no llegó a un consenso. Nadie es linchado.", data: { lynchedPlayerId: null, final: true }, createdAt: new Date() });
    }
    
    let gameOverInfo = await checkGameOver(game, lynchedPlayerObject);
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

    game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; });
    const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);

    transaction.update(gameRef, toPlainObject({
        ...game, phase: 'night', currentRound: game.currentRound + 1, phaseEndsAt,
    }));
}

async function performKill(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string | null, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
    let newGameData = { ...gameData };
    let triggeredHunterId: string | null = null;
    
    if (!playerIdToKill) return { updatedGame: newGameData, triggeredHunterId };

    const killQueue: {id: string, cause: GameEvent['type'], message?: string}[] = [{id: playerIdToKill, cause, message: customMessage}];
    const alreadyProcessed = new Set<string>();

    while (killQueue.length > 0) {
        const {id: currentIdToKill, cause: currentCause, message: currentMessage} = killQueue.shift()!;
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
        
        const deathMessage = currentMessage || `${playerToKill.displayName} ha muerto. Su rol era: ${roleDetails[playerToKill.role!]?.name || 'Desconocido'}`;

        newGameData.events.push({
            id: `evt_${currentCause}_${Date.now()}_${currentIdToKill}`,
            gameId: newGameData.id!, round: newGameData.currentRound, type: currentCause,
            message: deathMessage,
            data: { killedPlayerIds: [currentIdToKill], revealedRole: playerToKill.role }, createdAt: new Date(),
        });
        
        // Post-death triggers
        if (playerToKill.role === 'seer' && newGameData.settings.seer_apprentice) newGameData.seerDied = true;
        if (playerToKill.role === 'hunter' && newGameData.settings.hunter && !triggeredHunterId) triggeredHunterId = playerToKill.userId;
        if (playerToKill.role === 'leprosa' && currentCause === 'werewolf_kill') newGameData.leprosaBlockedRound = newGameData.currentRound + 1;
        if (playerToKill.role === 'wolf_cub') newGameData.wolfCubRevengeRound = newGameData.currentRound;

        // Chain death triggers
        const checkAndQueueChainDeath = (linkedIds: (string[] | null | undefined), deadPlayer: Player, messageTemplate: string, eventType: GameEvent['type']) => {
            if (!linkedIds || !linkedIds.includes(deadPlayer.userId)) return;

            const otherId = linkedIds.find(id => id !== deadPlayer.userId);
            const otherPlayer = otherId ? newGameData.players.find(p => p.userId === otherId) : undefined;
            
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
    
    return { updatedGame: newGameData, triggeredHunterId };
}


export async function killPlayer(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
    const playerToKill = gameData.players.find(p => p.userId === playerIdToKill);
    if (!playerToKill || !playerToKill.isAlive) return { updatedGame: gameData, triggeredHunterId: null };

    // Prince check for voting
    if (cause === 'vote_result' && playerToKill.role === 'prince' && gameData.settings.prince && !playerToKill.princeRevealed) {
        const playerIndex = gameData.players.findIndex(p => p.userId === playerIdToKill);
        if (playerIndex > -1) {
            let updatedGame = { ...gameData };
            updatedGame.players[playerIndex].princeRevealed = true;
            updatedGame.events.push({
                id: `evt_prince_reveal_${Date.now()}`,
                gameId: gameData.id,
                round: gameData.currentRound,
                type: 'vote_result',
                message: `${playerToKill.displayName} ha sido sentenciado, ¡pero revela su identidad como Príncipe y sobrevive!`,
                createdAt: new Date(),
                data: { lynchedPlayerId: null, final: true, revealedPlayerId: playerIdToKill },
            });
            return { updatedGame, triggeredHunterId: null };
        }
    }
    
    return performKill(transaction, gameRef, gameData, playerIdToKill, cause, customMessage);
}

export async function killPlayerUnstoppable(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
    return performKill(transaction, gameRef, gameData, playerIdToKill, cause, customMessage);
}


export async function checkGameOver(gameData: Game, lynchedPlayer?: Player | null): Promise<{ isGameOver: boolean; message: string; winnerCode?: string; winners: Player[] }> {
    if (gameData.status === 'finished') {
        const lastEvent = gameData.events.find(e => e.type === 'game_over');
        return { isGameOver: true, message: lastEvent?.message || "La partida ha terminado.", winnerCode: lastEvent?.data?.winnerCode, winners: lastEvent?.data?.winners || [] };
    }
    
    const alivePlayers = gameData.players.filter(p => p.isAlive);
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
        
        const executioner = gameData.players.find(p => p.role === 'executioner' && p.isAlive);
        if (executioner && executioner.executionerTargetId === lynchedPlayer.userId) {
            return {
                isGameOver: true,
                winnerCode: 'executioner',
                message: `¡El Verdugo ha ganado! Ha logrado su objetivo de que el pueblo linche a ${lynchedPlayer.displayName}.`,
                winners: [executioner],
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
        return { isGameOver: true, winnerCode: 'wolves', message: "¡Los hombres lobo han ganado! Superan en número al pueblo.", winners: gameData.players.filter(p => p.role && wolfRoles.includes(p.role)) };
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
