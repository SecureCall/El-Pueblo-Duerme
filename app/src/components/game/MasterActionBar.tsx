
'use client';

import type { Game } from '@/types';
import { Button } from '@/components/ui/button';
import { Swords, Eye, UserCog } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { masterActions, type MasterActionId } from '@/lib/master-actions';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { promoteNextMaster } from '@/lib/firebase-actions';
import { useFirebase } from '@/firebase';
import { useGameSession } from '@/hooks/use-game-session';

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
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { userId } = useGameSession();

    const handleMasterKillClick = () => {
         if (game.masterKillUsed) {
            toast({ variant: 'destructive', title: 'Acción ya utilizada', description: 'El Zarpazo del Destino solo se puede usar una vez por partida.' });
            return;
        }
        setMasterActionState({ active: true, actionId: 'master_kill', sourceId: null });
        
        // Defensive check as per user's final diagnosis
        const safeMasterActions = masterActions || {};
        const killAction = safeMasterActions.master_kill || { name: 'Asesinato Forzado', description: 'Elimina a un jugador al instante.' };

        toast({ title: killAction.name, description: 'Selecciona al jugador que quieres eliminar.' });
    };
    
    const handleActionClick = (actionId: MasterActionId) => {
        setMasterActionState({ active: true, actionId, sourceId: null });
        const action = masterActions?.[actionId] || { name: 'Acción de Máster' };
        toast({ title: action.name, description: 'Selecciona el primer jugador (Fuente).'});
    };

    const handlePromoteClick = async () => {
        if (!firestore || !userId) return;
        const result = await promoteNextMaster(firestore, game.id, userId);
        if (result.success) {
            toast({ title: 'Liderazgo transferido', description: `Se ha promovido al siguiente jugador.` });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
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
                        <p className='font-bold'>{masterActions.master_kill.name}</p>
                        <p>{masterActions.master_kill.description}</p>
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
                        <p className='font-bold'>{masterActions.reveal_role.name}</p>
                        <p>{masterActions.reveal_role.description}</p>
                    </TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="secondary" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={handlePromoteClick}
                        >
                            <UserCog className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className='font-bold'>Transferir Liderazgo</p>
                        <p>Cede el rol de Máster al siguiente jugador en la lista.</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}
