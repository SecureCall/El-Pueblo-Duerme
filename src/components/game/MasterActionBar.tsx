
'use client';

import { useState } from 'react';
import type { Game, Player } from '@/types';
import { Button } from '@/components/ui/button';
import { Swords, Eye } from 'lucide-react';
import { masterKillPlayer } from '@/lib/firebase-actions';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { masterActions, type MasterActionId } from '@/lib/master-actions';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

export interface MasterActionState {
    active: boolean;
    actionId: MasterActionId | null;
    sourceId: string | null;
}

interface MasterActionBarProps {
    game: Game;
    setMasterActionState: React.Dispatch<React.SetStateAction<MasterActionState>>;
}

export function MasterActionBar({ game, setMasterActionState }: MasterActionBarProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const handleMasterKillClick = () => {
         if (game.masterKillUsed) {
            toast({ variant: 'destructive', title: 'Acción ya utilizada', description: 'El Zarpazo del Destino solo se puede usar una vez por partida.' });
            return;
        }
        setMasterActionState({ active: true, actionId: 'master_kill', sourceId: null });
        toast({ title: masterActions.master_kill.name, description: 'Selecciona al jugador que quieres eliminar.' });
    };
    
    const handleActionClick = (actionId: MasterActionId) => {
        setMasterActionState({ active: true, actionId, sourceId: null });
        toast({ title: masterActions[actionId].name, description: 'Selecciona el primer jugador (Fuente).'});
    };


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
                            onClick={handleMasterKillClick}
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
