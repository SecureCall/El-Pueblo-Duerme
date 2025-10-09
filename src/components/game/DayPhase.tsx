
"use client";

import { useState, useEffect } from 'react';
import type { Game, Player, GameEvent } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { PlayerGrid } from './PlayerGrid';
import { useToast } from '@/hooks/use-toast';
import { submitVote, processVotes } from '@/app/actions';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { HeartCrack, SunIcon } from 'lucide-react';

interface DayPhaseProps {
    game: Game;
    players: Player[];
    currentPlayer: Player;
    nightEvent?: GameEvent;
    loverDeathEvents?: GameEvent[];
}

export function DayPhase({ game, players, currentPlayer, nightEvent, loverDeathEvents = [] }: DayPhaseProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const hasVoted = !!currentPlayer.votedFor;
    const alivePlayers = players.filter(p => p.isAlive);
    const allPlayersVoted = alivePlayers.every(p => !!p.votedFor);

    useEffect(() => {
        if (allPlayersVoted && currentPlayer.userId === game.creator && game.status === 'in_progress' && game.phase === 'day') {
            processVotes(game.id);
        }
    }, [allPlayersVoted, currentPlayer.userId, game.creator, game.id, game.status, game.phase]);


    const handlePlayerSelect = (player: Player) => {
        if (hasVoted || !player.isAlive || player.userId === currentPlayer.userId) return;
        setSelectedPlayerId(player.userId);
    };

    const handleVoteSubmit = async () => {
        if (!selectedPlayerId) {
            toast({ variant: 'destructive', title: 'Debes seleccionar un jugador para votar.' });
            return;
        }

        setIsSubmitting(true);
        const result = await submitVote(game.id, currentPlayer.userId, selectedPlayerId);
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: 'Voto registrado.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };
    
    const votedForPlayer = players.find(p => p.userId === currentPlayer.votedFor);
    const votesByPlayer = players.reduce((acc, player) => {
        if (player.votedFor) {
            if (!acc[player.votedFor]) {
                acc[player.votedFor] = [];
            }
            acc[player.votedFor].push(player.displayName);
        }
        return acc;
    }, {} as Record<string, string[]>);

    return (
        <Card className="mt-8 bg-card/80 w-full">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Debate y Votación</CardTitle>
                <CardDescription>El pueblo se reúne. Discutid y votad para linchar a un sospechoso.</CardDescription>
            </CardHeader>
            <CardContent>
                {nightEvent && (
                    <Alert className='mb-4 bg-background/50'>
                        <SunIcon className="h-4 w-4" />
                        <AlertTitle>Al Amanecer...</AlertTitle>
                        <AlertDescription>
                            {nightEvent.message}
                        </AlertDescription>
                    </Alert>
                )}

                {loverDeathEvents.map(event => (
                    <Alert key={event.createdAt.toMillis()} variant="destructive" className='mb-4 bg-destructive/20 border-destructive/50'>
                        <HeartCrack className="h-4 w-4" />
                        <AlertTitle>¡Una tragedia de amor!</AlertTitle>
                        <AlertDescription>
                            {event.message}
                        </AlertDescription>
                    </Alert>
                ))}

                {hasVoted ? (
                    <div className="text-center py-4 space-y-4">
                        <p className="text-lg text-primary">
                            Has votado por {votedForPlayer?.displayName || 'alguien'}. Esperando al resto de jugadores...
                        </p>
                        <PlayerGrid 
                            players={alivePlayers.filter(p => p.userId !== currentPlayer.userId)}
                            votesByPlayer={votesByPlayer}
                        />
                    </div>
                ) : (
                    <>
                        <p className="text-center mb-4 text-muted-foreground">Selecciona al jugador que crees que es un Hombre Lobo.</p>
                         <PlayerGrid 
                            players={alivePlayers.filter(p => p.userId !== currentPlayer.userId)}
                            onPlayerClick={handlePlayerSelect}
                            clickable={true}
                            selectedPlayerIds={selectedPlayerId ? [selectedPlayerId] : []}
                            votesByPlayer={votesByPlayer}
                        />
                        <Button 
                            className="w-full mt-6 text-lg" 
                            onClick={handleVoteSubmit} 
                            disabled={!selectedPlayerId || isSubmitting}
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : `Votar por ${players.find(p=>p.userId === selectedPlayerId)?.displayName || '...'}`}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
