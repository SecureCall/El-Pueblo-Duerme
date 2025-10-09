"use client";

import { useState } from 'react';
import type { Game, Player, NightActionType, PlayerRole } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { PlayerGrid } from './PlayerGrid';
import { useToast } from '@/hooks/use-toast';
import { submitNightAction, getSeerResult } from '@/app/actions';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WolfIcon } from '../icons';
import { SeerResult } from './SeerResult';

interface NightActionsProps {
    game: Game;
    players: Player[];
    currentPlayer: Player;
}

export function NightActions({ game, players, currentPlayer }: NightActionsProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [seerResult, setSeerResult] = useState<{ targetName: string; isWerewolf: boolean; } | null>(null);
    const { toast } = useToast();

    const handlePlayerSelect = (player: Player) => {
        if (submitted) return;

        // Logic to prevent selecting invalid targets
        if (!player.isAlive) return;
        if (currentPlayer.role === 'werewolf' && player.role === 'werewolf') return;
        if ((currentPlayer.role === 'seer' || currentPlayer.role === 'doctor') && player.userId === currentPlayer.userId) {
             // Allow self-selection for seer/doctor
        }

        setSelectedPlayerId(player.userId);
    };

    const getActionType = (): NightActionType | null => {
        switch (currentPlayer.role) {
            case 'werewolf': return 'werewolf_kill';
            case 'seer': return 'seer_check';
            case 'doctor': return 'doctor_heal';
            default: return null;
        }
    }

    const handleSubmit = async () => {
        if (!selectedPlayerId) {
            toast({ variant: 'destructive', title: 'Debes seleccionar un jugador.' });
            return;
        }

        const actionType = getActionType();
        if (!actionType) return;

        setIsSubmitting(true);
        const result = await submitNightAction({
            gameId: game.id,
            round: game.currentRound,
            playerId: currentPlayer.userId,
            actionType: actionType,
            targetId: selectedPlayerId,
        });

        if (result.success) {
            setSubmitted(true);
            toast({ title: 'Acción registrada.', description: 'Tu decisión ha sido guardada.' });

            if (currentPlayer.role === 'seer') {
                const seerResultData = await getSeerResult(game.id, currentPlayer.userId, selectedPlayerId);
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

    const canPerformAction = currentPlayer.role === 'werewolf' || currentPlayer.role === 'seer' || currentPlayer.role === 'doctor';

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
                {submitted ? (
                     <div className="text-center py-8">
                        <p className="text-lg text-primary">Has realizado tu acción. Espera a que amanezca.</p>
                    </div>
                ) : canPerformAction ? (
                    <>
                        <PlayerGrid 
                            players={players.filter(p => {
                                // Seer can't check themselves
                                if (currentPlayer.role === 'seer' && p.userId === currentPlayer.userId) return false;
                                // Werewolves can't target other werewolves
                                if (currentPlayer.role === 'werewolf') return p.role !== 'werewolf';
                                return true;
                            })}
                            onPlayerClick={handlePlayerSelect}
                            clickable={true}
                            selectedPlayerId={selectedPlayerId}
                        />
                        <Button 
                            className="w-full mt-6 text-lg" 
                            onClick={handleSubmit} 
                            disabled={!selectedPlayerId || isSubmitting}
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
