
import type { Game, Player, PlayerRole } from '@/types';

export interface SecretObjective {
    id: string;
    name: string;
    description: string;
    appliesTo: (PlayerRole | 'any')[];
}

interface SecretObjectiveWithLogic extends SecretObjective {
     checkCompletion: (player: Player, game: Game) => boolean;
}

const getGameOverInfo = (game: Game): { winnerCode?: string; winners: Player[] } => {
    const lastEvent = game.events.find(e => e.type === 'game_over');
    if (lastEvent) {
        return {
            winnerCode: lastEvent.data?.winnerCode,
            winners: lastEvent.data?.winners || [],
        };
    }
    return { winners: [] };
};

const allObjectives: SecretObjectiveWithLogic[] = [
    // === Objetivos para Aldeanos ===
    {
        id: 'survive_to_end_villager',
        name: 'Superviviente Definitivo',
        description: 'Sobrevive hasta el final de la partida y gana con el pueblo.',
        appliesTo: ['villager', 'seer', 'doctor', 'hunter', 'guardian', 'priest', 'prince', 'twin', 'ghost'],
        checkCompletion: (player, game) => {
            const gameOver = getGameOverInfo(game);
            return player.isAlive && gameOver.winnerCode === 'villagers';
        }
    },
    {
        id: 'lynch_a_wolf',
        name: 'Justiciero',
        description: 'Vota con éxito para linchar a un Hombre Lobo.',
        appliesTo: ['villager', 'seer', 'doctor', 'hunter', 'guardian', 'priest', 'prince'],
        checkCompletion: (player, game) => {
            return game.events.some(event => 
                event.type === 'vote_result' && 
                event.data?.lynchedPlayerId &&
                game.players.some(p => p.userId === event.data.lynchedPlayerId && (p.role === 'werewolf' || p.role === 'wolf_cub')) &&
                game.players.some(voter => voter.userId === player.userId && voter.votedFor === event.data.lynchedPlayerId)
            );
        }
    },
     {
        id: 'successful_save',
        name: 'El Ángel Guardián',
        description: 'Como rol protector, salva con éxito a un jugador que iba a ser atacado por los lobos.',
        appliesTo: ['doctor', 'guardian', 'priest'],
        checkCompletion: (player, game) => {
             return game.events.some(e => e.type === 'night_result' && e.data?.savedPlayerIds?.includes(player.userId) && e.data.savedBy === player.userId);
        }
    },

    // === Objetivos para Lobos ===
    {
        id: 'survive_as_wolf_winner',
        name: 'Lobo Alfa',
        description: 'Gana la partida y sobrevive como Hombre Lobo.',
        appliesTo: ['werewolf', 'wolf_cub'],
        checkCompletion: (player, game) => {
            const gameOver = getGameOverInfo(game);
            return player.isAlive && gameOver.winnerCode === 'wolves';
        }
    },
    {
        id: 'kill_the_seer',
        name: 'Apaga la Luz',
        description: 'Como Hombre Lobo, participa en la muerte nocturna de la Vidente.',
        appliesTo: ['werewolf', 'wolf_cub'],
        checkCompletion: (player, game) => {
            const seer = game.players.find(p => p.role === 'seer');
            if (!seer || seer.isAlive) return false;
            
            const deathEvent = game.events.find(e => 
                e.type === 'night_result' && 
                e.data?.killedPlayerIds?.includes(seer.userId) &&
                e.round === game.nightActions?.find(a => a.playerId === player.userId && a.actionType === 'werewolf_kill')?.round
            );
            return !!deathEvent;
        }
    },
    {
        id: 'betray_wolf',
        name: 'El Chacal',
        description: 'Consigue que el pueblo linche a otro miembro de la manada, y sobrevive para ganar.',
        appliesTo: ['werewolf'],
        checkCompletion: (player, game) => {
             const gameOver = getGameOverInfo(game);
             if (!player.isAlive || gameOver.winnerCode !== 'wolves') return false;

             return game.events.some(event => {
                 if (event.type !== 'vote_result' || !event.data?.lynchedPlayerId) return false;
                 const lynchedPlayer = game.players.find(p => p.userId === event.data.lynchedPlayerId);
                 const wasMyVote = game.players.some(voter => voter.userId === player.userId && voter.votedFor === lynchedPlayer?.userId);
                 return wasMyVote && (lynchedPlayer?.role === 'werewolf' || lynchedPlayer?.role === 'wolf_cub');
             });
        }
    },

    // === Objetivos para Roles Especiales ===
    {
        id: 'lovers_survive_together',
        name: 'Amor Inmortal',
        description: 'Como Enamorado, sobrevive con tu pareja hasta el final.',
        appliesTo: ['any'], // Any role can be a lover
        checkCompletion: (player, game) => {
            if (!player.isLover) return false;
            const gameOver = getGameOverInfo(game);
            return gameOver.winnerCode === 'lovers';
        }
    },
    {
        id: 'executioner_objective_met',
        name: 'Justicia Ciega',
        description: 'Como Verdugo, cumple tu objetivo y haz que el pueblo linche a tu presa.',
        appliesTo: ['executioner'],
        checkCompletion: (player, game) => {
            const gameOver = getGameOverInfo(game);
            return gameOver.winnerCode === 'executioner';
        }
    },
     {
        id: 'get_lynched_as_drunk',
        name: 'El Sacrificio del Ebrio',
        description: 'Como Hombre Ebrio, consigue que te linchen.',
        appliesTo: ['drunk_man'],
        checkCompletion: (player, game) => {
             const gameOver = getGameOverInfo(game);
             return gameOver.winnerCode === 'drunk_man';
        }
    }
];

// Export only the data, not the logic
export const secretObjectives: SecretObjective[] = allObjectives.map(({ checkCompletion, ...data }) => data);

// Export a way to get the logic by ID
export const getObjectiveLogic = (id: string): ((player: Player, game: Game) => boolean) | undefined => {
    return allObjectives.find(obj => obj.id === id)?.checkCompletion;
};

    