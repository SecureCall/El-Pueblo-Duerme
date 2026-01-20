
'use server';

import { 
  Timestamp,
  type Transaction,
  DocumentReference,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type GameEvent, type PlayerRole,
} from "@/types";
import { toPlainObject } from "./utils";
import { roleDetails } from "./roles";

const PHASE_DURATION_SECONDS = 60;

export async function processNight(transaction: Transaction, gameRef: DocumentReference<Game>) {
  const gameSnap = await transaction.get(gameRef);
  if (!gameSnap.exists()) throw new Error("Game not found!");
  
  let game = gameSnap.data()!;
  
  if (game.phase === 'role_reveal' && game.status === 'in_progress') {
     const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
     transaction.update(gameRef, toPlainObject({ phase: 'night', phaseEndsAt }));
     return;
  }
  
  if (game.phase !== 'night' || game.status === 'finished') {
      return;
  }
  
  const initialPlayerState = JSON.parse(JSON.stringify(game.players));
  const actions = game.nightActions?.filter(a => a.round === game.currentRound) || [];

  // PHASE 1: MANIPULACIÓN Y CONTROL
  actions.forEach(action => {
      const playerIndex = game.players.findIndex(p => p.userId === action.playerId);
      if (playerIndex === -1) return;

      if (action.actionType === 'silencer_silence') game.silencedPlayerId = action.targetId;
      if (action.actionType === 'elder_leader_exile') game.exiledPlayerId = action.targetId;
  });
  
  // FASE 2: PROTECCIÓN
  const protections: { targetId: string, type: 'bless' | 'potion' | 'guard' }[] = [];
  actions.forEach(action => {
      if (action.actionType === 'priest_bless') protections.push({ targetId: action.targetId, type: 'bless' });
      if (action.actionType === 'hechicera_save') protections.push({ targetId: action.targetId, type: 'potion' });
      if (action.actionType === 'doctor_heal' || action.actionType === 'guardian_protect') {
          protections.push({ targetId: action.targetId, type: 'guard' });
      }
  });


  // FASE 3: ACCIONES LETALES Y DE CONVERSIÓN
  let pendingDeaths: { playerId: string; cause: GameEvent['type']; message: string; }[] = [];
  
  if (game.leprosaBlockedRound !== game.currentRound) {
      const wolfVotes = actions.filter(a => a.actionType === 'werewolf_kill').map(a => a.targetId);
      const getConsensusTarget = (votes: string[]) => {
          if (votes.length === 0) return null;
          const voteCounts: Record<string, number> = {};
          votes.forEach(vote => vote.split('|').forEach(target => {
              if(target) voteCounts[target] = (voteCounts[target] || 0) + 1;
          }));
          const maxVotes = Math.max(...Object.values(voteCounts), 0);
          if (maxVotes === 0) return null;
          const mostVotedTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
          return mostVotedTargets[0] || null;
      };
      const wolfTargetId = getConsensusTarget(wolfVotes);
      
      if (wolfTargetId) {
          const targetPlayer = game.players.find(p => p.userId === wolfTargetId);
          if(targetPlayer?.role === 'cursed' && game.settings.cursed && !protections.some(p => p.targetId === wolfTargetId)) {
               const cursedPlayerIndex = game.players.findIndex(p => p.userId === wolfTargetId);
               if (cursedPlayerIndex !== -1) {
                   game.players[cursedPlayerIndex].role = 'werewolf';
                   game.events.push({ id: `evt_transform_cursed_${Date.now()}`, gameId: game.id, round: game.currentRound, type: 'player_transformed', message: `¡${targetPlayer.displayName} ha sido mordido y se ha transformado en Hombre Lobo!`, data: { targetId: targetPlayer.userId, newRole: 'werewolf' }, createdAt: new Date() });
               }
          } else {
              pendingDeaths.push({ playerId: wolfTargetId, cause: 'werewolf_kill', message: `Las marcas son inconfundibles: obra de los hombres lobo.` });
          }
      }
  }

  const hechiceraPoisonAction = actions.find(a => a.actionType === 'hechicera_poison');
  if(hechiceraPoisonAction) {
    pendingDeaths.push({ playerId: hechiceraPoisonAction.targetId, cause: 'special', message: `Yace sin una sola herida, pero con un rictus de dolor. Parece haber sido envenenado.` });
  }
  
  const fairyKillAction = actions.find(a => a.actionType === 'fairy_kill');
  if(fairyKillAction) {
    pendingDeaths.push({ playerId: fairyKillAction.targetId, cause: 'special', message: `Un aura de magia oscura rodea el cuerpo. Ha sido víctima de una maldición fatal.` });
  }

  actions.filter(a => a.actionType === 'vampire_bite').forEach(action => {
      const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
      if (targetIndex === -1) return;
      game.players[targetIndex].biteCount = (game.players[targetIndex].biteCount || 0) + 1;
      if (game.players[targetIndex].biteCount >= 3) {
          pendingDeaths.push({ playerId: action.targetId, cause: 'vampire_kill', message: `Está pálido y exangüe, con dos pequeñas marcas en el cuello.` });
          game.vampireKills = (game.vampireKills || 0) + 1;
      }
  });


  // FASE 4: INVESTIGACIÓN Y RECLUTAMIENTO
  actions.forEach(action => {
      if (action.actionType === 'cult_recruit') {
          const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
          if (targetIndex !== -1) game.players[targetIndex].isCultMember = true;
      }
      if (action.actionType === 'fisherman_catch') {
          const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
          if (targetIndex !== -1) game.boat.push(action.targetId);
      }
  });


  // FASE 5: RESOLUCIÓN FINAL
  let savedPlayerIds = new Set<string>();
  let finalDeaths = pendingDeaths.filter(death => {
      const isBlessed = protections.some(p => p.targetId === death.playerId && p.type === 'bless');
      if (isBlessed) { savedPlayerIds.add(death.playerId); return false; }
      
      const isPotionSaved = protections.some(p => p.targetId === death.playerId && p.type === 'potion');
      if (isPotionSaved) { savedPlayerIds.add(death.playerId); return false; }

      if (death.cause === 'werewolf_kill') {
          const isGuarded = protections.some(p => p.targetId === death.playerId && p.type === 'guard');
          if (isGuarded) { savedPlayerIds.add(death.playerId); return false; }
      }
      return true;
  });

  let triggeredHunterId: string | null = null;
  for (const death of finalDeaths) {
      const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, death.playerId, death.cause, death.message);
      game = updatedGame;
      if(newHunterId) triggeredHunterId = newHunterId;
  }
  
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
  
  const newlyKilledPlayers = game.players.filter(p => !p.isAlive && initialPlayerState.find((ip:any) => ip.userId === p.userId)?.isAlive);
  
  let nightMessage;
  if (newlyKilledPlayers.length > 0) {
      nightMessage = `Anoche, el pueblo perdió a ${newlyKilledPlayers.map(p => p.displayName).join(', ')}.`;
  } else if (pendingDeaths.length > 0 && savedPlayerIds.size > 0) {
      nightMessage = "La noche fue tensa. Los lobos atacaron, pero alguien fue salvado por una fuerza protectora.";
  } else {
      nightMessage = "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
  }
  
  const leprosaDeath = newlyKilledPlayers.find(p => p.role === 'leprosa');
  if (leprosaDeath && game.leprosaBlockedRound === game.currentRound + 1) {
      nightMessage += ` Como consecuencia de la muerte de la Leprosa, los lobos no podrán atacar la próxima noche.`;
  }

  game.events.push({ id: `evt_night_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: newlyKilledPlayers.map(p => p.userId), savedPlayerIds: Array.from(savedPlayerIds) }, createdAt: new Date() });

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

function getMillis(timestamp: any): number {
    if (!timestamp) return 0;
    if (timestamp instanceof Timestamp) {
        return timestamp.toMillis();
    }
     if (timestamp instanceof Date) {
        return timestamp.getTime();
    }
    if (typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
        return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
    }
     if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }
    return 0;
};
