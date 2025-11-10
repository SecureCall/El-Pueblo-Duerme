
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

  let pendingDeaths: { playerId: string; cause: GameEvent['type']; }[] = [];
  
  const blessedThisNight = new Set<string>(actions.filter(a => a.actionType === 'priest_bless').map(a => a.targetId));
  const hechiceraSaveAction = actions.find(a => a.actionType === 'hechicera_save');
  const protectedThisNight = new Set<string>(actions.filter(a => a.actionType === 'doctor_heal' || a.actionType === 'guardian_protect').map(a => a.targetId));

  const wolfAttackAction = actions.find(a => a.actionType === 'werewolf_kill');
  if (wolfAttackAction && game.leprosaBlockedRound !== game.currentRound) {
      const targetPlayer = game.players.find(p => p.userId === wolfAttackAction.targetId);
      if(targetPlayer?.role === 'cursed' && game.settings.cursed && !blessedThisNight.has(wolfAttackAction.targetId)) {
           const cursedPlayerIndex = game.players.findIndex(p => p.userId === wolfAttackAction.targetId);
           if (cursedPlayerIndex !== -1) {
               game.players[cursedPlayerIndex].role = 'werewolf';
               game.events.push({ id: `evt_transform_cursed_${Date.now()}`, gameId: game.id, round: game.currentRound, type: 'player_transformed', message: `¡${targetPlayer.displayName} ha sido mordido y se ha transformado en Hombre Lobo!`, data: { targetId: targetPlayer.userId, newRole: 'werewolf' }, createdAt: new Date() });
           }
      } else {
          pendingDeaths.push({ playerId: wolfAttackAction.targetId, cause: 'werewolf_kill' });
      }
  }

  const hechiceraPoisonAction = actions.find(a => a.actionType === 'hechicera_poison');
  if(hechiceraPoisonAction) {
    pendingDeaths.push({ playerId: hechiceraPoisonAction.targetId, cause: 'special' });
  }

  if(hechiceraSaveAction) {
      pendingDeaths = pendingDeaths.filter(death => death.playerId !== hechiceraSaveAction.targetId);
  }

  pendingDeaths = pendingDeaths.filter(death => death.cause !== 'werewolf_kill' || (!protectedThisNight.has(death.playerId) && !blessedThisNight.has(death.playerId)));


  let triggeredHunterId: string | null = null;
  for (const death of pendingDeaths) {
      const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, death.playerId, death.cause);
      game = updatedGame;
      if(newHunterId) triggeredHunterId = newHunterId;

      const deadPlayer = initialPlayerState.find((p: Player) => p.userId === death.playerId);
      if (deadPlayer?.role === 'leprosa' && death.cause === 'werewolf_kill') {
          game.leprosaBlockedRound = game.currentRound + 1;
      }
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
  
  const allProtections = new Set([...protectedThisNight, ...blessedThisNight]);
  if(hechiceraSaveAction) allProtections.add(hechiceraSaveAction.targetId);

  let nightMessage;
  if (newlyKilledPlayers.length > 0) {
      nightMessage = `Anoche, el pueblo perdió a ${newlyKilledPlayers.map(p => p.displayName).join(', ')}.`;
  } else if (pendingDeaths.length > 0 && allProtections.size > 0) {
      nightMessage = "La noche fue tensa. Los lobos atacaron, pero alguien fue salvado por una fuerza protectora.";
  } else {
      nightMessage = "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
  }
  
  game.events.push({ id: `evt_night_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: newlyKilledPlayers.map(p => p.userId), savedPlayerIds: Array.from(allProtections) }, createdAt: new Date() });

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

    const lastVoteEvent = [...game.events].sort((a,b) => toPlainObject(b.createdAt).getTime() - toPlainObject(a.createdAt).getTime()).find(e => e.type === 'vote_result');
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
        const result = await killPlayer(transaction, gameRef, game, lynchedPlayerId, 'vote_result');
        game = result.updatedGame;
        triggeredHunterId = result.triggeredHunterId;
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
    
    // On final tie, random selection
    if (tie && mostVotedPlayerId) {
        const tiedPlayers = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
        mostVotedPlayerId = tiedPlayers[Math.floor(Math.random() * tiedPlayers.length)];
    }
    
    let lynchedPlayerObject: Player | null = null;
    let triggeredHunterId: string | null = null;

    if (mostVotedPlayerId) {
        const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, mostVotedPlayerId, 'vote_result');
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

async function performKill(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string | null, cause: GameEvent['type']): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
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
            data: { killedPlayerIds: [currentIdToKill], revealedRole: playerToKill.role }, createdAt: new Date(),
        });
        
        if (playerToKill.role === 'seer' && newGameData.settings.seer_apprentice) {
            newGameData.seerDied = true;
        }
        
        if (playerToKill.role === 'hunter' && newGameData.settings.hunter && !triggeredHunterId) {
            triggeredHunterId = playerToKill.userId;
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
                    data: { originalVictimId: deadPlayer.userId, killedPlayerIds: [otherId], revealedRole: otherPlayer.role }, createdAt: new Date(),
                });
            }
        };
        
        if (playerToKill.isLover && newGameData.lovers) {
             const otherLoverId = newGameData.lovers.find(id => id !== playerToKill.userId);
             if (otherLoverId) {
                checkAndQueueChainDeath([playerToKill.userId, otherLoverId], playerToKill, 'Por un amor eterno, {otherName} se quita la vida tras la muerte de {victimName}.', 'lover_death');
             }
        }
    }
    
    return { updatedGame: newGameData, triggeredHunterId };
}


export async function killPlayer(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string, cause: GameEvent['type']): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
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
    
    return performKill(transaction, gameRef, gameData, playerIdToKill, cause);
}

export async function killPlayerUnstoppable(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string, cause: GameEvent['type']): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
    return performKill(transaction, gameRef, gameData, playerIdToKill, cause);
}


export async function checkGameOver(gameData: Game, lynchedPlayer?: Player | null): Promise<{ isGameOver: boolean; message: string; winnerCode?: string; winners: Player[] }> {
    if (gameData.status === 'finished') {
        const lastEvent = gameData.events.find(e => e.type === 'game_over');
        return { isGameOver: true, message: lastEvent?.message || "La partida ha terminado.", winnerCode: lastEvent?.data?.winnerCode, winners: lastEvent?.data?.winners || [] };
    }
    
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    
    if (lynchedPlayer) {
        if (lynchedPlayer.role === 'drunk_man' && gameData.settings.drunk_man) {
            return {
                isGameOver: true,
                winnerCode: 'drunk_man',
                message: `¡El Hombre Ebrio ha ganado! Ha conseguido que el pueblo lo linche.`,
                winners: [lynchedPlayer],
            };
        }
        
        if (gameData.settings.executioner) {
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
    }

    const aliveWolves = alivePlayers.filter(p => p.role && ['werewolf', 'wolf_cub', 'cursed'].includes(p.role));
    const aliveVillagers = alivePlayers.filter(p => p.role && !['werewolf', 'wolf_cub', 'cursed'].includes(p.role));

    if (aliveWolves.length === 0 && alivePlayers.length > 0) {
        return {
            isGameOver: true,
            winnerCode: 'villagers',
            message: "¡El pueblo ha ganado! Todas las amenazas han sido eliminadas.",
            winners: aliveVillagers,
        };
    }
    
    if (aliveWolves.length >= aliveVillagers.length) {
        return {
            isGameOver: true,
            winnerCode: 'wolves',
            message: "¡Los hombres lobo han ganado! Superan en número a los aldeanos y la oscuridad consume el pueblo.",
            winners: aliveWolves,
        };
    }
    
    if (alivePlayers.length === 0) {
        return { isGameOver: true, winnerCode: 'draw', message: "¡Nadie ha sobrevivido a la masacre!", winners: [] };
    }

    return { isGameOver: false, message: "", winners: [] };
}

  