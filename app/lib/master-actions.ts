import type { Game, GameEvent } from "@/types";
import { roleDetails } from "./roles";

export type MasterActionId = 'reveal_role' | 'master_kill';

export interface MasterAction {
    id: MasterActionId;
    name: string;
    description: string;
    execute: (game: Game, sourceId: string, targetId: string, fullPlayers: Player[]) => { updatedGame: Game };
}

const revealRoleAction: MasterAction = {
    id: 'reveal_role',
    name: "Revelar Rol",
    description: "Revela en secreto el rol de un jugador (Objetivo) a otro (Fuente).",
    execute: (game, sourceId, targetId, fullPlayers) => {
        const targetPlayer = fullPlayers.find(p => p.userId === targetId);
        if (!targetPlayer) {
            console.error("Master Action 'reveal_role': Target player not found.");
            return { updatedGame: game };
        }
        
        const revealEvent: GameEvent = {
            id: `evt_master_reveal_${Date.now()}`,
            gameId: game.id,
            round: game.currentRound,
            type: 'special',
            message: `El Máster te ha revelado un secreto. Has visto que ${targetPlayer.displayName} es un(a) ${roleDetails[targetPlayer.role!]?.name || 'Desconocido'}.`,
            createdAt: new Date(),
            data: { 
                targetId: sourceId, // The event is directed TO the source player
                revealedPlayerId: targetId,
                revealedRole: targetPlayer.role,
            },
        };

        const updatedGame = { ...game, events: [...game.events, revealEvent] };
        return { updatedGame };
    }
};

export const masterActions: Record<MasterActionId, MasterAction> = {
    reveal_role: revealRoleAction,
    master_kill: {
        id: 'master_kill',
        name: "Zarpazo del Destino",
        description: "Elimina a un jugador al instante, ignorando todas las protecciones.",
        execute: (game, sourceId, targetId) => {
             // The actual killing logic is handled separately in firebase-actions to reuse killPlayer
            return { updatedGame: game };
        }
    }
};
