
"use client";

import { useState, useEffect } from 'react';
import type { Game, Player, NightActionType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { PlayerGrid } from './PlayerGrid';
import { useToast } from '@/hooks/use-toast';
import { submitNightAction, getSeerResult, submitCupidAction } from '@/app/actions';
import { Loader2, Heart, FlaskConical, Shield } from 'lucide-react';
import { WolfIcon } from '../icons';
import { SeerResult } from './SeerResult';
import { useNightActions } from '@/hooks/use-night-actions';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';

interface NightActionsProps {
    game: Game;
    players: Player[];
    currentPlayer: Player;
}

type HechiceraAction = 'poison' | 'save';

export function NightActions({ game, players, currentPlayer }: NightActionsProps) {
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [seerResult, setSeerResult] = useState<{ targetName: string; isWerewolf: boolean; } | null>(null);
    const [hechiceraAction, setHechiceraAction] = useState<HechiceraAction>('poison');
    
    const { toast } = useToast();
    const { hasSubmitted } = useNightActions(game.id, game.currentRound, currentPlayer.userId);

    const isCupidFirstNight = currentPlayer.role === 'cupid' && game.currentRound === 1;
    const isHechicera = currentPlayer.role === 'hechicera';
    
    // Check if potions have been used in any previous round or this round
    const hasUsedPoison = !!currentPlayer.potions?.poison;
    const hasUsedSave = !!currentPlayer.potions?.save;

    const hasPoison = isHechicera && !hasUsedPoison;
    const hasSavePotion = isHechicera && !hasUsedSave;

    useEffect(() => {
        // Default to 'save' if poison is used
        if (isHechicera && !hasPoison && hasSavePotion) {
            setHechiceraAction('save');
        }
    }, [isHechicera, hasPoison, hasSavePotion]);
    
    const selectionLimit = isCupidFirstNight ? 2 : 1;

    const handlePlayerSelect = (player: Player) => {
        if (hasSubmitted || !player.isAlive) return;

        // Role-specific selection logic
        if (currentPlayer.role === 'werewolf' && player.role === 'werewolf') return;
        if (currentPlayer.role === 'doctor' && player.lastHealedRound === game.currentRound - 1) {
            toast({ variant: 'destructive', title: 'Regla del Doctor', description: 'No puedes proteger a la misma persona dos noches seguidas.' });
            return;
        }
        if (currentPlayer.role === 'hechicera' && hechiceraAction === 'save' && player.userId === currentPlayer.userId) {
            // Original game rule, witch cannot save herself.
            // toast({ variant: 'destructive', title: 'Regla de la Hechicera', description: 'No puedes usar la poción de salvación en ti misma.' });
            // return;
        }


        setSelectedPlayerIds(prev => {
            if (prev.includes(player.userId)) {
                return prev.filter(id => id !== player.userId);
            }
            if (prev.length < selectionLimit) {
                return [...prev, player.userId];
            }
            if (selectionLimit === 1) {
                return [player.userId];
            }
            return [prev[1], player.userId];
        });
    };

    const getActionType = (): NightActionType | null => {
        switch (currentPlayer.role) {
            case 'werewolf': return 'werewolf_kill';
            case 'seer': return 'seer_check';
            case 'doctor': return 'doctor_heal';
            case 'cupid': return 'cupid_enchant';
            case 'hechicera':
                if (hechiceraAction === 'poison') return 'hechicera_poison';
                if (hechiceraAction === 'save') return 'hechicera_save';
                return null;
            default: return null;
        }
    }

    const handleSubmit = async () => {
        if (selectedPlayerIds.length !== selectionLimit) {
            toast({ variant: 'destructive', title: `Debes seleccionar ${selectionLimit} jugador(es).` });
            return;
        }

        const actionType = getActionType();
        if (!actionType) return;
        
        if (actionType === 'hechicera_poison' && !hasPoison) {
            toast({ variant: 'destructive', title: 'Poción usada', description: 'Ya has usado tu poción de veneno.' });
            return;
        }
        if (actionType === 'hechicera_save' && !hasSavePotion) {
            toast({ variant: 'destructive', title: 'Poción usada', description: 'Ya has usado tu poción de salvación.' });
            return;
        }

        setIsSubmitting(true);

        let result;
        if (isCupidFirstNight) {
            result = await submitCupidAction(game.id, currentPlayer.userId, selectedPlayerIds[0], selectedPlayerIds[1]);
        } else {
             result = await submitNightAction({
                gameId: game.id,
                round: game.currentRound,
                playerId: currentPlayer.userId,
                actionType: actionType,
                targetId: selectedPlayerIds[0],
            });
        }

        if (result.success) {
            toast({ title: 'Acción registrada.', description: 'Tu decisión ha sido guardada.' });

            if (currentPlayer.role === 'seer') {
                const seerResultData = await getSeerResult(game.id, currentPlayer.userId, selectedPlayerIds[0]);
                if (seerResultData.success) {
                    setSeerResult({
                        targetName: seerResultData.targetName!,
                        isWerewolf: seerResultData.isWerewolf!,
                    });
                } else {
                     toast({ variant: 'destructive', title: 'Error del Vidente', description: seerResultData.error });
                }
            }
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSubmitting(false);
    };
    
    const otherWerewolves = currentPlayer.role === 'werewolf' 
        ? players.filter(p => p.role === 'werewolf' && p.userId !== currentPlayer.userId) 
        : [];
    
    const getActionPrompt = () => {
        switch (currentPlayer.role) {
            case 'werewolf': return 'Elige a un aldeano para eliminar.';
            case 'seer': return 'Elige a un jugador para descubrir su identidad.';
            case 'doctor': return 'Elige a un jugador para proteger esta noche.';
            case 'cupid': return game.currentRound === 1 ? 'Elige a dos jugadores para que se enamoren.' : 'Tu flecha ya ha unido dos corazones.';
            case 'hechicera': return (hasPoison || hasSavePotion) ? 'Elige una poción y un objetivo.' : 'Has usado todas tus pociones.';
            default: return 'No tienes acciones esta noche. Espera al amanecer.';
        }
    }

    const renderWerewolfInfo = () => {
        if (currentPlayer.role !== 'werewolf') return null;

        return (
            <div className="mb-4 text-center">
                <p>Tus compañeros lobos:</p>
                <div className="flex justify-center gap-4 mt-2">
                    {otherWerewolves.length > 0 ? otherWerewolves.map(wolf => (
                        <div key={wolf.userId} className="flex flex-col items-center text-sm">
                            <WolfIcon className="h-6 w-6 text-destructive" />
                            <span>{wolf.displayName}</span>
                        </div>
                    )) : <p className='text-sm text-muted-foreground'>Estás solo esta noche.</p>}
                </div>
            </div>
        )
    }
    
    const renderHechiceraInfo = () => {
        if (currentPlayer.role !== 'hechicera') return null;
        
        if (!hasPoison && !hasSavePotion) return null;

        return (
            <div className="mb-4 flex justify-center">
                <ToggleGroup 
                    type="single" 
                    value={hechiceraAction} 
                    onValueChange={(value: HechiceraAction) => {
                        if (value) {
                            setHechiceraAction(value);
                            setSelectedPlayerIds([]);
                        }
                    }}
                    className='w-auto'
                >
                    <ToggleGroupItem value="poison" aria-label="Usar veneno" disabled={!hasPoison}>
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Veneno
                    </ToggleGroupItem>
                    <ToggleGroupItem value="save" aria-label="Usar poción de salvación" disabled={!hasSavePotion}>
                        <Shield className="h-4 w-4 mr-2" />
                        Salvar
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        )
    }

    const canPerformAction = (
        currentPlayer.role === 'werewolf' || 
        currentPlayer.role === 'seer' || 
        currentPlayer.role === 'doctor' ||
        isCupidFirstNight ||
        (isHechicera && (hasPoison || hasSavePotion))
    );

    if (seerResult) {
        return <SeerResult targetName={seerResult.targetName} isWerewolf={seerResult.isWerewolf} />;
    }

    return (
        <Card className="mt-8 bg-card/80">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Tus Acciones Nocturnas</CardTitle>
                <CardDescription>{getActionPrompt()}</CardDescription>
            </CardHeader>
            <CardContent>
                {renderWerewolfInfo()}
                {renderHechiceraInfo()}
                {hasSubmitted ? (
                     <div className="text-center py-8">
                        <p className="text-lg text-primary">Has realizado tu acción. Espera a que amanezca.</p>
                    </div>
                ) : canPerformAction ? (
                    <>
                        <PlayerGrid 
                            players={players.filter(p => {
                                if (p.userId === currentPlayer.userId && hechiceraAction === 'save') return true;
                                if (p.userId === currentPlayer.userId) return false;
                                if (currentPlayer.role === 'werewolf') return p.role !== 'werewolf';
                                return true;
                            })}
                            onPlayerClick={handlePlayerSelect}
                            clickable={true}
                            selectedPlayerIds={selectedPlayerIds}
                        />
                         {isCupidFirstNight && (
                            <div className="flex justify-center items-center gap-4 mt-4">
                                <span className='text-lg'>{players.find(p => p.userId === selectedPlayerIds[0])?.displayName || '?'}</span>
                                <Heart className="h-6 w-6 text-pink-400" />
                                <span className='text-lg'>{players.find(p => p.userId === selectedPlayerIds[1])?.displayName || '?'}</span>
                            </div>
                        )}
                        <Button 
                            className="w-full mt-6 text-lg" 
                            onClick={handleSubmit} 
                            disabled={selectedPlayerIds.length !== selectionLimit || isSubmitting}
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirmar Acción'}
                        </Button>
                    </>
                ) : (
                    <p className="text-center text-muted-foreground py-8">Duermes profundamente...</p>
                )}
            </CardContent>
        </Card>
    );
}

    