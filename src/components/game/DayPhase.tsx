
"use client";

import { useState } from 'react';
import type { Game, Player, GameEvent, ChatMessage } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { PlayerGrid } from './PlayerGrid';
import { useToast } from '@/hooks/use-toast';
import { submitVote, submitTroublemakerAction } from '@/lib/firebase-actions';
import { Loader2, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { HeartCrack, SunIcon, Users, BrainCircuit } from 'lucide-react';
import { useFirebase } from '@/firebase';

interface DayPhaseProps {
    game: Game;
    players: Player[];
    currentPlayer: Player;
    nightEvent?: GameEvent;
    loverDeathEvents?: GameEvent[];
    voteEvent?: GameEvent;
    behaviorClueEvent?: GameEvent;
    chatMessages: ChatMessage[];
}

function TroublemakerPanel({ game, currentPlayer, players }: { game: Game, currentPlayer: Player, players: Player[] }) {
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const handlePlayerSelect = (player: Player) => {
        if (!player.isAlive || player.userId === currentPlayer.userId) return;
        
        setSelectedPlayerIds(prev => {
            if (prev.includes(player.userId)) {
                return prev.filter(id => id !== player.userId);
            }
            if (prev.length < 2) {
                return [...prev, player.userId];
            }
            return [...prev.slice(1), player.userId];
        });
    };

    const handleSubmit = async () => {
        if (selectedPlayerIds.length !== 2) {
            toast({ variant: 'destructive', title: 'Debes seleccionar exactamente a dos jugadores.' });
            return;
        }
        if (!firestore) return;

        setIsSubmitting(true);
        const result = await submitTroublemakerAction(firestore, game.id, currentPlayer.userId, selectedPlayerIds[0], selectedPlayerIds[1]);
        if (result.success) {
            toast({ title: '¡Caos desatado!', description: 'Has provocado una pelea mortal.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            setIsSubmitting(false);
        }
    };
    
    const target1 = players.find(p => p.userId === selectedPlayerIds[0]);
    const target2 = players.find(p => p.userId === selectedPlayerIds[1]);

    return (
        <Card className="bg-amber-900/30 border-amber-500/50 mt-4">
            <CardHeader>
                <CardTitle className="font-headline text-xl text-amber-400 flex items-center gap-2">
                    <Zap /> Acción de Alborotadora
                </CardTitle>
                <CardDescription>
                    Una vez por partida, puedes provocar una pelea mortal entre dos jugadores. Ambos serán eliminados.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-center mb-4 text-muted-foreground">Selecciona a dos jugadores para que se peleen.</p>
                <PlayerGrid 
                    players={players.filter(p => p.isAlive && p.userId !== currentPlayer.userId)}
                    onPlayerClick={handlePlayerSelect}
                    clickable={true}
                    selectedPlayerIds={selectedPlayerIds}
                />
                <Button 
                    className="w-full mt-6 text-lg" 
                    onClick={handleSubmit} 
                    disabled={selectedPlayerIds.length !== 2 || isSubmitting}
                    variant="destructive"
                >
                    {isSubmitting 
                        ? <Loader2 className="animate-spin" /> 
                        : `Provocar Pelea entre ${target1?.displayName || '...'} y ${target2?.displayName || '...'}`
                    }
                </Button>
            </CardContent>
        </Card>
    );
}

export function DayPhase({ game, players, currentPlayer, nightEvent, loverDeathEvents = [], voteEvent, behaviorClueEvent, chatMessages }: DayPhaseProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const hasVoted = !!currentPlayer.votedFor;
    const alivePlayers = players.filter(p => p.isAlive);
    const isTroublemaker = currentPlayer.role === 'troublemaker' && currentPlayer.isAlive && !game.troublemakerUsed;

    const handlePlayerSelect = (player: Player) => {
        if (hasVoted || !currentPlayer.isAlive || !player.isAlive || player.userId === currentPlayer.userId) return;
        setSelectedPlayerId(player.userId);
    };

    const handleVoteSubmit = async () => {
        if (!selectedPlayerId || !firestore) {
            toast({ variant: 'destructive', title: 'Debes seleccionar un jugador para votar.' });
            return;
        }

        setIsSubmitting(true);
        const result = await submitVote(firestore, game.id, currentPlayer.userId, selectedPlayerId);
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: 'Voto registrado.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };
    
    const votedForPlayer = players.find(p => p.userId === currentPlayer.votedFor);
    
    const votesByPlayer = alivePlayers.reduce((acc, player) => {
        if (player.votedFor) {
            if (!acc[player.votedFor]) {
                acc[player.votedFor] = [];
            }
            const voter = players.find(p => p.userId === player.userId);
            if (voter) {
                acc[player.votedFor].push(voter.displayName);
            }
        }
        return acc;
    }, {} as Record<string, string[]>);

    return (
        <Card className="bg-card/80 w-full h-full">
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

                {voteEvent && (
                    <Alert className='mb-4 bg-background/50 border-blue-400/30'>
                        <Users className="h-4 w-4" />
                        <AlertTitle>Resultado de la Votación Anterior</AlertTitle>
                        <AlertDescription>
                            {voteEvent.message}
                        </AlertDescription>
                    </Alert>
                )}

                {behaviorClueEvent && (
                     <Alert className='mb-4 bg-yellow-900/30 border-yellow-400/50'>
                        <BrainCircuit className="h-4 w-4 text-yellow-300" />
                        <AlertTitle className='text-yellow-300'>Pista de Comportamiento</AlertTitle>
                        <AlertDescription>
                            {behaviorClueEvent.message}
                        </AlertDescription>
                    </Alert>
                )}
                
                {currentPlayer.isAlive ? (
                    hasVoted ? (
                        <div className="text-center py-4 space-y-4">
                            <p className="text-lg text-primary">
                                Has votado por {votedForPlayer?.displayName || 'alguien'}. Esperando al resto de jugadores...
                            </p>
                            <PlayerGrid 
                                players={alivePlayers}
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
                    )
                ) : (
                    <div className="text-center py-4 space-y-4">
                        <p className="text-lg">Observas el debate desde el más allá...</p>
                        <PlayerGrid 
                            players={players}
                            votesByPlayer={votesByPlayer}
                        />
                    </div>
                )}
                
                {isTroublemaker && <TroublemakerPanel game={game} currentPlayer={currentPlayer} players={players} />}

            </CardContent>
        </Card>
    );
}

    
