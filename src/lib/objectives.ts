import type { Game, Player, PlayerRole } from '@/types';

export interface SecretObjective {
    id: string;
    description: string;
    appliesTo: PlayerRole[];
    checkCompletion: (player: Player, game: Game) => boolean;
}

export const secretObjectives: SecretObjective[] = [
    // === Objetivos para Aldeanos ===
    {
        id: 'survive_to_end',
        description: 'Sobrevive hasta el final de la partida.',
        appliesTo: ['villager', 'seer', 'doctor', 'hunter', 'guardian', 'priest'],
        checkCompletion: (player, game) => {
            const winners = checkGameOver(game).winners;
            return player.isAlive && winners.some(w => w.userId === player.userId);
        }
    },
    {
        id: 'lynch_a_wolf',
        description: 'Vota con éxito para linchar a un Hombre Lobo.',
        appliesTo: ['villager', 'seer', 'doctor', 'hunter'],
        checkCompletion: (player, game) => {
            const lynchEvents = game.events.filter(e => e.type === 'vote_result' && e.data?.lynchedPlayerId);
            return lynchEvents.some(event => {
                const lynchedPlayer = game.players.find(p => p.userId === event.data.lynchedPlayerId);
                const voter = game.players.find(p => p.userId === player.userId && p.votedFor === event.data.lynchedPlayerId);
                return voter && lynchedPlayer?.role && ['werewolf', 'wolf_cub'].includes(lynchedPlayer.role);
            });
        }
    },
     {
        id: 'save_someone',
        description: 'Como rol protector, salva con éxito a un jugador del ataque de los lobos.',
        appliesTo: ['doctor', 'guardian', 'priest'],
        checkCompletion: (player, game) => {
            return game.events.some(e => e.type === 'night_result' && e.data?.savedPlayerIds?.length > 0 && e.data.savedBy === player.userId);
        }
    },

    // === Objetivos para Lobos ===
    {
        id: 'survive_as_wolf',
        description: 'Gana la partida y sobrevive como Hombre Lobo.',
        appliesTo: ['werewolf', 'wolf_cub'],
        checkCompletion: (player, game) => {
            const gameOver = checkGameOver(game);
            return player.isAlive && gameOver.winnerCode === 'wolves';
        }
    },
    {
        id: 'kill_seer',
        description: 'Como Hombre Lobo, participa en la muerte de la Vidente.',
        appliesTo: ['werewolf', 'wolf_cub'],
        checkCompletion: (player, game) => {
            const seer = game.players.find(p => p.role === 'seer');
            if (!seer || seer.isAlive) return false;
            
            const deathEvent = game.events.find(e => e.type === 'night_result' && e.data?.killedPlayerIds?.includes(seer.userId));
            return !!deathEvent;
        }
    },
    {
        id 'betray_wolf',
        description: 'Consigue que el pueblo linchen a otro lobo, y sobrevive para ganar.',
        appliesTo: ['werewolf'],
        checkCompletion: (player, game) => {
             const gameOver = checkGameOver(game);
             if (!player.isAlive || gameOver.winnerCode !== 'wolves') return false;

             return game.events.some(event => {
                 if (event.type !== 'vote_result' || !event.data?.lynchedPlayerId) return false;
                 const lynchedPlayer = game.players.find(p => p.userId === event.data.lynchedPlayerId);
                 return lynchedPlayer?.role === 'werewolf' || lynchedPlayer?.role === 'wolf_cub';
             });
        }
    },

    // === Objetivos para Roles Especiales ===
    {
        id: 'lovers_win',
        description: 'Como Enamorado, sobrevive con tu pareja hasta el final.',
        appliesTo: ['villager', 'werewolf', 'seer', 'doctor', 'hunter', 'guardian', 'priest', 'cupid'], // Any role can be a lover
        checkCompletion: (player, game) => {
            if (!player.isLover) return false;
            const gameOver = checkGameOver(game);
            return gameOver.winnerCode === 'lovers';
        }
    },
    {
        id: 'executioner_win',
        description: 'Como Verdugo, cumple tu objetivo y haz que linchen a tu presa.',
        appliesTo: ['executioner'],
        checkCompletion: (player, game) => {
            const gameOver = checkGameOver(game);
            return gameOver.winnerCode === 'executioner';
        }
    },
];


// Dummy checkGameOver to satisfy TypeScript. The real one is in firebase-actions.
const checkGameOver = (game: Game): { winnerCode?: string; winners: Player[] } => {
    const lastEvent = game.events.find(e => e.type === 'game_over');
    if (lastEvent) {
        return {
            winnerCode: lastEvent.data?.winnerCode,
            winners: lastEvent.data?.winners || [],
        };
    }
    return { winners: [] };
};
