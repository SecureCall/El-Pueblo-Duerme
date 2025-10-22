
'use client';

import { useState } from 'react';
import type { Game, Player } from '@/types';
import { Button } from '@/components/ui/button';
import { Swords, Eye } from 'lucide-react';
import { executeMasterAction, masterKillPlayer } from '@/lib/firebase-actions';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { masterActions, type MasterActionId } from '@/lib/master-actions';

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
    const [killTarget, setKillTarget] = useState<Player | null>(null);

    const handleMasterKill = async () => {
        if (!firestore || !killTarget) return;

        const result = await masterKillPlayer(firestore, game.id, game.creator, killTarget.userId);
        if (result.error) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        } else {
            toast({ title: '¡Hecho!', description: `${killTarget.displayName} ha sido eliminado por el Máster.` });
        }
        setKillTarget(null);
    };
    
    const handleActionClick = (actionId: MasterActionId) => {
        setMasterActionState({ active: true, actionId, sourceId: null });
        toast({ title: masterActions[actionId].name, description: 'Selecciona el primer jugador (Fuente).'});
    };


    return (
        <div className="flex items-center gap-2">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                     <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-8 w-8"
                        disabled={game.masterKillUsed}
                        onClick={() => setMasterActionState({ active: true, actionId: 'master_kill', sourceId: null })}
                    >
                        <Swords className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmar eliminación del Máster?</AlertDialogTitle>
                        <AlertDialogDescription>
                           Esta acción es irreversible y solo se puede usar una vez. El jugador será eliminado ignorando cualquier protección. ¿Estás seguro?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMasterKill} disabled={!killTarget}>
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => handleActionClick('reveal_role')}
            >
                <Eye className="h-4 w-4" />
            </Button>
        </div>
    );
}
