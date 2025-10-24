
'use server';

import type { Game, GameEvent } from "@/types";
import { Timestamp } from "firebase/firestore";
import { roleDetails } from "./roles";

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
    description: "Revela en secreto el rol de un jugador (Fuente) a otro (Objetivo).",
    execute: (game, sourceId, targetId) => {
        const sourcePlayer = game.players.find(p => p.userId === sourceId);
        if (!sourcePlayer?.role) {
            console.error("Master Action 'reveal_role': Source player not found or has no role.");
            return { updatedGame: game };
        }
        
        const roleName = roleDetails[sourcePlayer.role]?.name || 'un rol desconocido';
        
        const revealEvent: GameEvent = {
            id: `evt_master_reveal_${Date.now()}`,
            gameId: game.id,
            round: game.currentRound,
            type: 'special',
            message: `El Máster te ha revelado un secreto. Has visto que ${sourcePlayer.displayName} es un(a) ${roleName}.`,
            createdAt: Timestamp.now(),
            data: { 
                targetId: targetId, // The event is directed TO the target player
                revealedPlayerId: sourceId,
                revealedRole: sourcePlayer.role,
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
        description: "Elimina a un jugador al instante, ignorando todas las protecciones. Un solo uso.",
        execute: (game, sourceId, targetId) => {
             // The actual killing logic is handled separately in firebase-actions to reuse killPlayer
            return { updatedGame: game };
        }
    }
};
