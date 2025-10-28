
'use server';
import { 
  Timestamp,
  type Transaction,
  type DocumentReference,
} from "firebase/firestore";
import type { Game, Player, GameEvent, PlayerRole } from "@/types";
import { roleDetails } from "@/lib/roles";
import { toPlainObject } from "@/lib/utils";

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
                newGameData.events.push({ id: `evt_transform_${Date.now()}_${shifter.userId}`, gameId: newGameData.id!, round: newGameData.currentRound, type: 'player_transformed', message: `¡Has cambiado de forma! Ahora eres: ${roleDetails[newRole]?.name || 'un rol desconocido'}.`, data: { targetId: shifter.userId, newRole: newRole }, createdAt: Timestamp.now() });
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
        const lastEvent = gameData.events.find(e => e.type === 'game_over');
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
