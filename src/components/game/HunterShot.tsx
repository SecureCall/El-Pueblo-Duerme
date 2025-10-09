"use client";

import { useState } from 'react';
import type { Game, Player } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { PlayerGrid } from './PlayerGrid';
import { useToast } from '@/hooks/use-toast';
import { submitHunterShot } from '@/app/actions';
import { Loader2 } from 'lucide-react';
import { HunterIcon } from '../icons';

interface HunterShotProps {
    game: Game;
    players: Player[];
    currentPlayer: Player;
}

export function HunterShot({ game, players, currentPlayer }: HunterShotProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handlePlayerSelect = (player: Player) => {
        if (!player.isAlive) return;
        setSelectedPlayerId(player.userId);
    };

    const handleSubmit = async () => {
        if (!selectedPlayerId) {
            toast({ variant: 'destructive', title: 'Debes seleccionar a quién disparar.' });
            return;
        }

        setIsSubmitting(true);
        const result = await submitHunterShot(game.id, currentPlayer.userId, selectedPlayerId);

        if (result.success) {
            toast({ title: '¡Venganza cumplida!', description: 'Has disparado tu última bala.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            setIsSubmitting(false);
        }
    };
    
    const targetPlayerName = players.find(p => p.userId === selectedPlayerId)?.displayName;

    return (
        <Card className="mt-8 bg-destructive/20 border-destructive w-full max-w-4xl">
            <CardHeader className="text-center">
                <HunterIcon className="h-16 w-16 mx-auto text-destructive" />
                <CardTitle className="font-headline text-4xl text-destructive">¡Has Sido Eliminado!</CardTitle>
                <CardDescription className='text-lg text-destructive-foreground/80'>
                    Pero como Cazador, tienes una última bala. Elige a un jugador para llevártelo contigo.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <PlayerGrid 
                    players={players}
                    onPlayerClick={handlePlayerSelect}
                    clickable={true}
                    selectedPlayerIds={selectedPlayerId ? [selectedPlayerId] : []}
                />
                <Button 
                    className="w-full mt-6 text-lg" 
                    onClick={handleSubmit} 
                    disabled={!selectedPlayerId || isSubmitting}
                    variant="destructive"
                >
                    {isSubmitting 
                        ? <Loader2 className="animate-spin" /> 
                        : `Disparar a ${targetPlayerName || '...'}`
                    }
                </Button>
            </CardContent>
        </Card>
    );
}
