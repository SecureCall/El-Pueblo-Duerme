
'use server';

import type { Game, GameEvent } from "@/types";
import { Timestamp } from "firebase/firestore";

export type MasterActionId = 'reveal_role' | 'master_kill';

export interface MasterAction {
    id: MasterActionId;
    name: string;
    description: string;
    execute: (game: Game, sourceId: string, targetId: string) => { updatedGame: Game };
}

const revealRoleAction: MasterAction = {
    id: 'reveal_role',
    name: "Revelar Rol",
    description: "Revela en secreto el rol de un jugador (Objetivo) a otro (Fuente).",
    execute: (game, sourceId, targetId) => {
        const targetPlayer = game.players.find(p => p.userId === targetId);
        if (!targetPlayer) {
            console.error("Master Action 'reveal_role': Target player not found.");
            return { updatedGame: game };
        }
        
        const revealEvent: GameEvent = {
            id: `evt_master_reveal_${Date.now()}`,
            gameId: game.id,
            round: game.currentRound,
            type: 'special',
            message: `El Máster te ha revelado un secreto. Has visto que ${targetPlayer.displayName} es un(a) ${targetPlayer.role}.`,
            createdAt: Timestamp.now(),
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
