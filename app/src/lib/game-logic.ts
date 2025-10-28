'use server';
import { 
  Timestamp,
  type Firestore,
  type Transaction,
  type DocumentReference,
  doc,
  runTransaction,
} from "firebase/firestore";
import type { Game, Player, GameEvent, PlayerRole, NightAction } from "@/types";
import { roleDetails } from "@/lib/roles";
import { toPlainObject } from "@/lib/utils";

const PHASE_DURATION_SECONDS = 45;

export async function killPlayer(transaction: Transaction, gameRef: DocumentReference<Game>, gameData: Game, playerIdToKill: string | null, cause: GameEvent['type']): Promise<{ updatedGame: Game; triggeredHunterId: string | null; }> {
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

        const playerIndex = newGameData.players.findIndex(p => p.userId === currentIdToKill);
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
            data: { killedPlayerIds: [currentIdToKill], revealedRole: playerToKill.role }, createdAt: Timestamp.now(),
        });
        
        if (playerToKill.role === 'seer' && newGameData.settings.seer_apprentice) {
            newGameData.seerDied = true;
            const apprenticeIndex = newGameData.players.findIndex(p => p.role === 'seer_apprentice' && p.isAlive);
            if (apprenticeIndex !== -1) {
                newGameData.players[apprenticeIndex].role = 'seer';
                newGameData.events.push({ id: `evt_transform_apprentice_${Date.now()}`, gameId: newGameData.id!, round: newGameData.currentRound, type: 'player_transformed', message: `¡La Vidente ha muerto! ${newGameData.players[apprenticeIndex].displayName} hereda su don y se convierte en la nueva Vidente.`, data: { targetId: newGameData.players[apprenticeIndex].userId, newRole: 'seer' }, createdAt: Timestamp.now() });
            }
        }
        
        if (playerToKill.role === 'hunter' && newGameData.settings.hunter && !triggeredHunterId) {
            triggeredHunterId = playerToKill.userId;
        }
        
        if (playerToKill.role === 'wolf_cub' && newGameData.settings.wolf_cub) {
            newGameData.wolfCubRevengeRound = newGameData.currentRound;
        }

        if (playerToKill.role === 'leprosa' && newGameData.settings.leprosa) {
            newGameData.leprosaBlockedRound = newGameData.currentRound + 1;
        }
        
        const shapeshifterIndex = newGameData.players.findIndex(p => p.isAlive && p.role === 'shapeshifter' && p.shapeshifterTargetId === playerToKill.userId);
        if (shapeshifterIndex !== -1 && playerToKill.role) {
            const shifter = newGameData.players[shapeshifterIndex];
            if(shifter) {
                const newRole = playerToKill.role;
                newGameData.players[shapeshifterIndex].role = newRole;
                newGameData.players[shapeshifterIndex].shapeshifterTargetId = null; 
                newGameData.events.push({ id: `evt_transform_${Date.now()}_${shifter.userId}`, gameId: newGameData.id!, round: newGameData.currentRound, type: 'player_transformed', message: `¡Has cambiado de forma! Ahora eres: ${roleDetails[newRole]?.name || 'un rol desconocido'}.`, data: { targetId: shifter.userId, newRole }, createdAt: Timestamp.now() });
            }
        }


        const checkAndQueueChainDeath = (linkedIds: (string[] | null | undefined), deadPlayer: Player, messageTemplate: string, eventType: GameEvent['type']) => {
            if (!linkedIds || !linkedIds.includes(deadPlayer.userId)) return;

            const otherId = linkedIds.find(id => id !== deadPlayer.userId);
            const otherPlayer = otherId ? newGameData.players.find(p => p.userId === otherId) : undefined;
            
            if (otherPlayer && otherPlayer.isAlive && !alreadyProcessed.has(otherId) && !killQueue.includes(otherId)) {
                killQueue.push(otherId);
                 newGameData.events.push({
                    id: `evt_chain_death_${Date.now()}_${otherId}`,
                    gameId: newGameData.id!, round: newGameData.currentRound, type: eventType,
                    message: messageTemplate.replace('{otherName}', otherPlayer.displayName).replace('{victimName}', deadPlayer.displayName),
                    data: { originalVictimId: deadPlayer.userId, killedPlayerIds: [otherId], revealedRole: otherPlayer.role }, createdAt: Timestamp.now(),
                });
            }
        };
        
        if (newGameData.twins) {
            checkAndQueueChainDeath(newGameData.twins, playerToKill, 'Tras la muerte de {victimName}, su gemelo/a {otherName} muere de pena.', 'special');
        }
        
        if (playerToKill.isLover && newGameData.lovers) {
             const otherLoverId = newGameData.lovers.find(id => id !== playerToKill.userId);
             if (otherLoverId) {
                checkAndQueueChainDeath([playerToKill.userId, otherLoverId], playerToKill, 'Por un amor eterno, {otherName} se quita la vida tras la muerte de {victimName}.', 'lover_death');
             }
        }
        
        const virginiaLinker = newGameData.players.find(p => p.role === 'virginia_woolf' && p.userId === playerToKill.userId);
        if (virginiaLinker && virginiaLinker.virginiaWoolfTargetId) {
             const linkedPlayerId = virginiaLinker.virginiaWoolfTargetId;
             if (linkedPlayerId) {
                checkAndQueueChainDeath([virginiaLinker.userId, linkedPlayerId], playerToKill, 'Tras la muerte de {victimName}, {otherName} muere por un vínculo misterioso.', 'special');
             }
        }
    }
    
    return { updatedGame: newGameData, triggeredHunterId };
}


export async function checkGameOver(gameData: Game, lynchedPlayer?: Player | null): Promise<{ isGameOver: boolean; message: string; winnerCode?: string; winners: string[] }> {
    if (gameData.status === 'finished') {
        const lastEvent = gameData.events[gameData.events.length - 1];
        return { isGameOver: true, message: lastEvent?.message || "La partida ha terminado.", winnerCode: lastEvent?.data?.winnerCode, winners: lastEvent?.data?.winners || [] };
    }
    
    const alivePlayers = gameData.players.filter(p => p.isAlive);
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch']; 
    
    let sharedWinners: string[] = [];

    if (lynchedPlayer) {
        if (lynchedPlayer.role === 'drunk_man' && gameData.settings.drunk_man) {
            sharedWinners.push(lynchedPlayer.userId);
        }
        
        if (gameData.settings.executioner) {
            const executioner = gameData.players.find(p => p.role === 'executioner' && p.isAlive);
            if (executioner && executioner.executionerTargetId === lynchedPlayer.userId) {
                sharedWinners.push(executioner.userId);
                return {
                    isGameOver: true,
                    winnerCode: 'executioner',
                    message: `¡El Verdugo ha ganado! Ha logrado su objetivo de que el pueblo linche a ${lynchedPlayer.displayName}.`,
                    winners: sharedWinners,
                };
            }
        }
    }

    if (gameData.lovers) {
        const aliveLovers = alivePlayers.filter(p => gameData.lovers!.includes(p.userId));
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length >= 2) {
            return {
                isGameOver: true,
                winnerCode: 'lovers',
                message: '¡El amor ha triunfado! Los enamorados son los únicos supervivientes y ganan la partida.',
                winners: aliveLovers.map(l => l.userId),
            };
        }
    }

     const aliveCultMembers = alivePlayers.filter(p => p.isCultMember);
    if (gameData.settings.cult_leader && aliveCultMembers.length > 0 && aliveCultMembers.length === alivePlayers.length) {
         const cultLeader = gameData.players.find(p => p.role === 'cult_leader');
         return {
            isGameOver: true,
            winnerCode: 'cult',
            message: '¡El Culto ha ganado! Todos los supervivientes se han unido a la sombra del Líder.',
            winners: cultLeader ? [cultLeader.userId, ...sharedWinners] : [...aliveCultMembers.map(p => p.userId), ...sharedWinners]
        };
    }
    
    if (gameData.settings.vampire && gameData.players.some(p => p.role === 'vampire' && p.isAlive) && (gameData.vampireKills || 0) >= 3) {
        return {
            isGameOver: true,
            winnerCode: 'vampire',
            message: '¡El Vampiro ha ganado! Ha reclamado sus tres víctimas y ahora reina en la oscuridad.',
            winners: [...gameData.players.filter(p => p.role === 'vampire').map(p => p.userId), ...sharedWinners]
        };
    }

    const fisherman = gameData.players.find(p => p.role === 'fisherman' && p.isAlive);
    if (gameData.settings.fisherman && fisherman && gameData.boat) {
        const aliveVillagers = alivePlayers.filter(p => p.role && !wolfRoles.includes(p.role) && p.role !== 'vampire' && p.role !== 'cult_leader' && p.role !== 'drunk_man' && p.role !== 'executioner');
        if (aliveVillagers.length > 0 && aliveVillagers.every(v => gameData.boat.includes(v.userId))) {
            return {
                isGameOver: true,
                winnerCode: 'fisherman',
                message: `¡El Pescador ha ganado! Ha conseguido salvar a todos los aldeanos en su barco.`,
                winners: [fisherman.userId, ...sharedWinners],
            };
        }
    }

    const banshee = gameData.players.find(p => p.role === 'banshee');
    if (gameData.settings.banshee && banshee?.isAlive) {
        const screams = banshee.bansheeScreams || {};
        if (Object.keys(screams).length >= 2) {
             const scream1TargetId = screams[Object.keys(screams)[0]];
             const scream2TargetId = screams[Object.keys(screams)[1]];
             const target1 = gameData.players.find(p => p.userId === scream1TargetId);
             const target2 = gameData.players.find(p => p.userId === scream2TargetId);

             if (target1 && target2 && !target1.isAlive && !target2.isAlive) {
                return {
                    isGameOver: true,
                    winnerCode: 'banshee',
                    message: `¡La Banshee ha ganado! Sus dos gritos han sentenciado a muerte y ha cumplido su objetivo.`,
                    winners: [banshee.userId, ...sharedWinners],
                };
             }
        }
    }
    
    if (gameData.fairyKillUsed) {
        const fairies = gameData.players.filter(p => p.role === 'seeker_fairy' || p.role === 'sleeping_fairy');
        const fairiesAreAlive = fairies.every(f => f.isAlive);
        if (fairiesAreAlive) {
            return {
                isGameOver: true,
                winnerCode: 'fairies',
                message: '¡Las Hadas han ganado! Han lanzado su maldición y cumplido su misterioso objetivo.',
                winners: [...fairies.map(f => f.userId), ...sharedWinners]
            };
        }
    }

    const aliveWerewolves = alivePlayers.filter(p => p.role && wolfRoles.includes(p.role));
    const nonWolves = alivePlayers.filter(p => p.role && !wolfRoles.includes(p.role));
    if (aliveWerewolves.length > 0 && aliveWerewolves.length >= nonWolves.length) {
        return {
            isGameOver: true,
            winnerCode: 'wolves',
            message: "¡Los hombres lobo han ganado! Superan en número a los aldeanos y la oscuridad consume el pueblo.",
            winners: [...aliveWerewolves.map(p => p.userId), ...sharedWinners]
        };
    }
    
    const threats = alivePlayers.filter(p => (p.role && wolfRoles.includes(p.role)) || p.role === 'vampire' || (p.role === 'sleeping_fairy' && gameData.fairiesFound));
    if (threats.length === 0 && alivePlayers.length > 0) {
        const villageWinners = alivePlayers.filter(p => !p.isCultMember && p.role !== 'sleeping_fairy' && p.role !== 'executioner'); 
        return {
            isGameOver: true,
            winnerCode: 'villagers',
            message: "¡El pueblo ha ganado! Todas las amenazas han sido eliminadas.",
            winners: [...villageWinners.map(p => p.userId), ...sharedWinners]
        };
    }
    
    if (alivePlayers.length === 0) {
        return {
            isGameOver: true,
            winnerCode: 'draw',
            message: "¡Nadie ha sobrevivido a la masacre!",
            winners: sharedWinners
        };
    }

    if (sharedWinners.length > 0 && lynchedPlayer) {
        const winnerRole = roleDetails[lynchedPlayer.role!]?.name || 'un rol especial';
        return { isGameOver: true, message: `¡La partida ha terminado! ${lynchedPlayer.displayName} (${winnerRole}) ha cumplido su objetivo y gana en solitario.`, winners: sharedWinners, winnerCode: 'special' }
    }


    return { isGameOver: false, message: "", winners: [] };
}


export async function processNight(db: Firestore, gameId: string) {
  const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
    
  try {
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found!");
        
        let game = gameSnap.data();
        // Allow processNight to be called multiple times, but only execute if the phase is right.
        if (game.phase !== 'night' && game.phase !== 'role_reveal') {
            return;
        }

        const initialPlayerState = JSON.parse(JSON.stringify(game.players));
        const actions = game.nightActions?.filter((a: NightAction) => a.round === game.currentRound) || [];
        
        // --- PHASE 1: PRE-ATTACK ACTIONS ---
        actions.forEach((action: NightAction) => {
             const playerIndex = game.players.findIndex(p => p.userId === action.playerId);
             const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
             if (playerIndex === -1) return;

             if (action.actionType === 'cult_recruit' && targetIndex !== -1) game.players[targetIndex].isCultMember = true;
             if (action.actionType === 'virginia_woolf_link' && game.currentRound === 1) game.players[playerIndex].virginiaWoolfTargetId = action.targetId;
             if (action.actionType === 'river_siren_charm' && game.currentRound === 1) game.players[playerIndex].riverSirenTargetId = action.targetId;
             if (action.actionType === 'silencer_silence') game.silencedPlayerId = action.targetId;
             if (action.actionType === 'elder_leader_exile') game.exiledPlayerId = action.targetId;
             if (action.actionType === 'fisherman_catch' && targetIndex !== -1) game.boat.push(action.targetId);
             if (action.actionType === 'witch_hunt' && targetIndex !== -1 && game.players[targetIndex].role === 'seer') game.witchFoundSeer = true;
             if (action.actionType === 'fairy_find' && targetIndex !== -1 && game.players[targetIndex].role === 'sleeping_fairy') {
                 game.fairiesFound = true;
                 game.events.push({ id: `evt_fairy_found_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `¡Las hadas se han encontrado! Un nuevo poder ha despertado.`, data: {}, createdAt: Timestamp.now() });
             }
             if (action.actionType === 'banshee_scream' && game.players[playerIndex].bansheeScreams) {
                game.players[playerIndex].bansheeScreams![game.currentRound] = action.targetId;
             }
             if (action.actionType === 'resurrect' && targetIndex !== -1) {
                game.players[targetIndex].isAlive = true;
             }
        });
        
        if (game.currentRound === 1 && game.settings.cupid) {
            const cupidAction = actions.find((a: NightAction) => a.actionType === 'cupid_love');
            if (cupidAction) {
                const loverIds = cupidAction.targetId.split('|') as [string, string];
                if (loverIds.length === 2) {
                    game.lovers = loverIds;
                    game.players.forEach(p => {
                        if (loverIds.includes(p.userId)) {
                            p.isLover = true;
                        }
                    });
                }
            }
        }

        // --- PHASE 2: ATTACK DETERMINATION ---
        let pendingDeaths: { targetId: string | null, cause: GameEvent['type'] }[] = [];
        
        const fishermanAction = actions.find((a: NightAction) => a.actionType === 'fisherman_catch');
        if (fishermanAction) {
            const targetPlayer = game.players.find(p => p.userId === fishermanAction.targetId);
            if (targetPlayer?.role && ['werewolf', 'wolf_cub'].includes(targetPlayer.role)) {
                pendingDeaths.push({ targetId: fishermanAction.playerId, cause: 'special' });
            }
        }
        
        let wolfTargetId: string | null = null;
        if (game.leprosaBlockedRound !== game.currentRound) {
            const wolfVotes = actions.filter((a: NightAction) => a.actionType === 'werewolf_kill').map(a => a.targetId);
            const getConsensusTarget = (votes: string[]) => {
                if (votes.length === 0) return null;
                const voteCounts: Record<string, number> = {};
                votes.forEach(vote => vote.split('|').forEach(target => {
                    if(target) voteCounts[target] = (voteCounts[target] || 0) + 1;
                }));
                const maxVotes = Math.max(...Object.values(voteCounts), 0);
                if (maxVotes === 0) return null;
                const mostVotedTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
                return mostVotedTargets.length === 1 ? mostVotedTargets[0] : null;
            };
            wolfTargetId = getConsensusTarget(wolfVotes);
        }
        
        const hechiceraPoisonAction = actions.find((a: NightAction) => a.actionType === 'hechicera_poison');
        if (hechiceraPoisonAction) pendingDeaths.push({ targetId: hechiceraPoisonAction.targetId, cause: 'special' });
        
        const lookoutAction = actions.find((a: NightAction) => a.actionType === 'lookout_spy');
        if (lookoutAction) {
             if (Math.random() < 0.4) { // 40% fail rate
                pendingDeaths.push({ targetId: lookoutAction.playerId, cause: 'special' });
                game.events.push({ id: `evt_lookout_fail_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `¡${game.players.find(p=>p.userId===lookoutAction.playerId)?.displayName} ha sido descubierto espiando y ha muerto!`, data: { targetId: lookoutAction.playerId }, createdAt: Timestamp.now() });
            } else {
                const visits: Record<string, string[]> = {};
                actions.forEach((act: NightAction) => {
                    if(act.playerId !== lookoutAction.playerId && act.targetId){
                        act.targetId.split('|').forEach(tid => {
                            if(!visits[tid]) visits[tid] = [];
                            const visitor = game.players.find(p => p.userId === act.playerId);
                            if(visitor) visits[tid].push(visitor.displayName);
                        });
                    }
                });
                const visitorsToTarget = visits[lookoutAction.targetId] || [];
                 if (visitorsToTarget.length > 0) {
                    game.events.push({ id: `evt_lookout_success_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `Mientras vigilabas, viste a ${[...new Set(visitorsToTarget)].join(', ')} visitar la casa.`, data: { targetId: lookoutAction.playerId }, createdAt: Timestamp.now() });
                } else {
                    game.events.push({ id: `evt_lookout_success_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: `La noche fue tranquila en la casa que vigilabas. No viste a nadie.`, data: { targetId: lookoutAction.playerId }, createdAt: Timestamp.now() });
                }
            }
        }
        
        // --- PHASE 3: PROTECTION & REACTION ---
        const allProtectedIds = new Set<string>();
        actions.filter((a: NightAction) => ['doctor_heal', 'guardian_protect', 'priest_bless', 'hechicera_save'].includes(a.actionType)).forEach(a => allProtectedIds.add(a.targetId));

        if (wolfTargetId) {
            const targetPlayer = game.players.find(p => p.userId === wolfTargetId);
            if (targetPlayer?.role === 'cursed' && game.settings.cursed && !allProtectedIds.has(wolfTargetId)) {
                const cursedPlayerIndex = game.players.findIndex(p => p.userId === wolfTargetId);
                if (cursedPlayerIndex !== -1) {
                    game.players[cursedPlayerIndex].role = 'werewolf';
                    game.events.push({ id: `evt_transform_cursed_${Date.now()}`, gameId, round: game.currentRound, type: 'player_transformed', message: `¡${targetPlayer.displayName} ha sido mordido y se ha transformado en Hombre Lobo!`, data: { targetId: targetPlayer.userId, newRole: 'werewolf' }, createdAt: Timestamp.now() });
                }
            } else {
                 if (!allProtectedIds.has(wolfTargetId)) {
                    pendingDeaths.push({ targetId: wolfTargetId, cause: 'werewolf_kill' });
                 }
            }
        }
        
        // --- PHASE 4: RESOLVE DEATHS ---
        let triggeredHunterId: string | null = null;
        for (const death of pendingDeaths) {
            if (death.targetId && !allProtectedIds.has(death.targetId)) {
                const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, death.targetId, death.cause);
                game = updatedGame;
                if(newHunterId) triggeredHunterId = newHunterId;
            }
        }
        
        if (game.wolfCubRevengeRound === game.currentRound) {
             game.events.push({ id: `evt_revenge_${Date.now()}`, gameId, round: game.currentRound, type: 'special', message: "¡La cría de lobo ha muerto! La manada, enfurecida, atacará de nuevo.", data: {}, createdAt: Timestamp.now() });
             game.players.forEach(p => { if (p.role === 'werewolf' || p.role === 'wolf_cub') p.usedNightAbility = false; });
             game.wolfCubRevengeRound = 0; // Mark as used
             transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, wolfCubRevengeRound: 0 }));
             return; 
        }

        // --- PHASE 5: CHECK GAME OVER & TRANSITION ---
        let gameOverInfo = await checkGameOver(game);
        if (gameOverInfo.isGameOver) {
            game.status = "finished";
            game.phase = "finished";
            game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
            transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events }));
            return;
        }

        game.pendingHunterShot = triggeredHunterId;
        if (game.pendingHunterShot) {
            transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
            return;
        }
        
        const newlyKilledPlayers = game.players.filter(p => !p.isAlive && initialPlayerState.find((ip: Player) => ip.userId === p.userId)?.isAlive);
        const killedPlayerDetails = newlyKilledPlayers.map(p => `${p.displayName} (que era ${roleDetails[p.role!]?.name || 'un rol desconocido'})`);
        let nightMessage = newlyKilledPlayers.length > 0 
            ? `Anoche, el pueblo perdió a ${killedPlayerDetails.join(' y a ')}.`
            : "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
        
        game.events.push({ id: `evt_night_${game.currentRound}`, gameId, round: game.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: newlyKilledPlayers.map(p => p.userId), savedPlayerIds: Array.from(allProtectedIds) }, createdAt: Timestamp.now() });

        game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; });
        const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
        
        transaction.update(gameRef, toPlainObject({
            players: game.players, events: game.events, phase: 'day', phaseEndsAt,
            pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null,
        }));
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("CRITICAL ERROR in processNight:", error);
    // Avoid emitting permission error here as it's a generic catch-all
    return { error: `Hubo un problema fatal al procesar la noche: ${error.message}` };
  }
}


export async function processVotes(db: Firestore, gameId: string) {
  const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;

  try {
    await runTransaction(db, async (transaction) => {
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists()) throw new Error("Partida no encontrada");

      let game = gameSnap.data();
      if (game.phase !== 'day' || game.status === 'finished') return;
      
      const lastVoteEvent = [...game.events].sort((a, b) => toPlainObject(b.createdAt) - toPlainObject(a.createdAt)).find(e => e.type === 'vote_result');
      const isTiebreaker = lastVoteEvent?.data?.tiedPlayerIds && !lastVoteEvent?.data?.final;

      const alivePlayers = game.players.filter(p => p.isAlive);
      const voteCounts: Record<string, number> = {};
      
      alivePlayers.forEach(player => {
        if (player.votedFor) {
             if (!isTiebreaker || (lastVoteEvent.data.tiedPlayerIds as string[]).includes(player.votedFor)) {
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
          game.events.push({ id: `evt_vote_tie_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message: `¡La votación resultó en un empate! Se requiere una segunda votación solo entre los siguientes jugadores: ${mostVotedPlayerIds.map(id => game.players.find(p=>p.userId === id)?.displayName).join(', ')}.`, data: { tiedPlayerIds: mostVotedPlayerIds, final: false }, createdAt: Timestamp.now() });
          game.players.forEach(p => { p.votedFor = null; });
          const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
          transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phaseEndsAt }));
          return;
      }

      let lynchedPlayerId: string | null = mostVotedPlayerIds[0] || null;
      let lynchedPlayerObject: Player | null = null;
      let triggeredHunterId: string | null = null;

      if (lynchedPlayerId) {
        lynchedPlayerObject = game.players.find(p => p.userId === lynchedPlayerId) || null;
        
        if (lynchedPlayerObject?.role === 'prince' && game.settings.prince && !lynchedPlayerObject.princeRevealed) {
            const playerIndex = game.players.findIndex(p => p.userId === lynchedPlayerId);
            if (playerIndex > -1) game.players[playerIndex].princeRevealed = true;
            game.events.push({
              id: `evt_vote_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result',
              message: `${lynchedPlayerObject.displayName} ha sido sentenciado, ¡pero revela su identidad como Príncipe y sobrevive!`,
              createdAt: Timestamp.now(), data: { lynchedPlayerId: null, final: true },
            });
            lynchedPlayerId = null; 
        } else {
            const result = await killPlayer(transaction, gameRef, game, lynchedPlayerId, 'vote_result');
            game = result.updatedGame;
            triggeredHunterId = result.triggeredHunterId;
        }
      } else {
        const message = isTiebreaker ? 'Tras un segundo empate, el pueblo decide perdonar una vida hoy.' : 'El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.';
        game.events.push({ id: `evt_vote_result_${game.currentRound}`, gameId, round: game.currentRound, type: 'vote_result', message, data: { lynchedPlayerId: null, final: true }, createdAt: Timestamp.now() });
      }
      
      const gameOverInfo = await checkGameOver(game, lynchedPlayerObject);
      if (gameOverInfo.isGameOver) {
          game.status = "finished";
          game.phase = "finished";
          game.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: Timestamp.now() });
          transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events }));
          return;
      }
      
      game.pendingHunterShot = triggeredHunterId;
      if (game.pendingHunterShot) {
        transaction.update(gameRef, toPlainObject({
          players: game.players, events: game.events, phase: 'hunter_shot', 
          pendingHunterShot: game.pendingHunterShot
        }));
        return;
      }

      const newRound = game.currentRound + 1;
      game.players.forEach(p => { 
        p.votedFor = null;
        p.usedNightAbility = false; 
      });
      const phaseEndsAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_SECONDS * 1000);
      
      transaction.update(gameRef, toPlainObject({
        players: game.players, events: game.events, phase: 'night', phaseEndsAt,
        currentRound: newRound, pendingHunterShot: null, silencedPlayerId: null,
        exiledPlayerId: null,
      }));
    });

    return { success: true };
  } catch (error: any) {
    // Avoid emitting permission error here as it's a generic catch-all
    console.error("Error processing votes:", error);
    return { error: `Hubo un problema al procesar la votación: ${error.message}` };
  }
}
