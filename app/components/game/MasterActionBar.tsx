
'use client';

import type { Game } from '@/types';
import { Button } from '@/components/ui/button';
import { Swords, Eye, X } from 'lucide-react';
import { masterActions, type MasterActionId } from '@/lib/master-actions';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export interface MasterActionState {
    active: boolean;
    actionId: MasterActionId | null;
    sourceId: string | null; // For actions that have a source and target
}

interface MasterActionBarProps {
    game: Game;
    masterActionState: MasterActionState;
    setMasterActionState: React.Dispatch<React.SetStateAction<MasterActionState>>;
}

export function MasterActionBar({ game, masterActionState, setMasterActionState }: MasterActionBarProps) {
    const handleActionClick = (actionId: MasterActionId) => {
        if (actionId === 'master_kill' && game.masterKillUsed) {
            // This is just a client-side toast, the server will enforce the rule
            return;
        }
        setMasterActionState({ active: true, actionId, sourceId: null });
    };

    const cancelAction = () => {
        setMasterActionState({ active: false, actionId: null, sourceId: null });
    };

    if (masterActionState.active) {
        return (
             <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/20 border border-destructive">
                <p className="text-sm font-bold text-destructive-foreground animate-pulse">
                    {masterActionState.sourceId ? 'Selecciona Objetivo' : `Modo Máster: ${masterActions[masterActionState.actionId!].name}`}
                </p>
                <Button variant="destructive" size="icon" className="h-6 w-6" onClick={cancelAction}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="flex items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-8 w-8"
                            disabled={game.masterKillUsed}
                            onClick={() => handleActionClick('master_kill')}
                        >
                            <Swords className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className='font-bold'>Zarpazo del Destino (Máster)</p>
                        <p>Elimina a un jugador al instante. Un solo uso.</p>
                    </TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleActionClick('reveal_role')}
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className='font-bold'>Revelar Rol (Máster)</p>
                        <p>Muestra el rol de un jugador a otro.</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}
