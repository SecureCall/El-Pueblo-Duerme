
"use client";

import { useEffect, useState } from 'react';
import type { GameEvent, Game, Player } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Milestone, Crown, Skull, Loader2, Play, Star } from 'lucide-react';
import { playNarration } from '@/lib/sounds';
import { useGameSession } from '@/hooks/use-game-session';
import { useFirebase } from '@/firebase';
import { resetGame } from '@/lib/firebase-actions';
import { useToast } from '@/hooks/use-toast';
import { PlayerCard } from './PlayerCard';
import { secretObjectives } from '@/lib/objectives';
import type { MasterActionState } from './MasterActionBar';


interface GameOverProps {
    game: Game;
    event?: GameEvent;
    players: Player[];
    currentPlayer: Player | null;
}

export function GameOver({ game, event, players, currentPlayer }: GameOverProps) {
    const { userId, updateStats, addGameEventToHistory } = useGameSession();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isResetting, setIsResetting] = useState(false);
    const [masterActionState, setMasterActionState] = useState<MasterActionState>({ active: false, actionId: null, sourceId: null });


    const isCreator = game.creator === userId;

    useEffect(() => {
        if (event?.data?.winnerCode) {
            const winnerCode = event.data.winnerCode;
            switch(winnerCode) {
                case 'villagers':
                    playNarration('victoria_aldeanos.mp3');
                    break;
                case 'wolves':
                    playNarration('victoria_lobos.mp3');
                    break;
                case 'lovers':
                    break;
                case 'cult':
                    playNarration('victoria culto.mp3');
                    break;
                case 'vampire':
                    playNarration('el vampiro ha ganado .mp3');
                    break;
                case 'drunk_man':
                    playNarration('ganador el ebrio.mp3');
                    break;
                case 'fisherman':
                    playNarration('pescador ganador.mp3');
                    break;
                case 'executioner':
                    playNarration('victoria el berdugo.mp3');
                    break;
                case 'banshee':
                    break;
                case 'draw':
                    break;
            }

            const winners = event.data.winners || [];
            const losers = event.data.losers || [];
            updateStats(winners, losers, players);
            
            if (winners.some((p: Player) => p.userId === userId)) {
                addGameEventToHistory({
                    type: 'victory',
                    title: '¡Victoria Aplastante!',
                    description: `Ganaste una partida como ${currentPlayer?.role || 'un rol desconocido'}.`
                });
            }
        }
    }, [event, updateStats, addGameEventToHistory, userId, currentPlayer?.role, players]);

    const handleResetGame = async () => {
        if (!firestore || !isCreator) return;
        setIsResetting(true);
        const result = await resetGame(firestore, game.id);
        if (result.error) {
            toast({
                variant: 'destructive',
                title: 'Error al reiniciar',
                description: result.error,
            });
            setIsResetting(false);
        }
    };

    if (!event || !currentPlayer) {
        return (
            <div className="text-center">
                <h1 className="text-4xl font-bold">Partida Terminada</h1>
                <p>Calculando resultados...</p>
            </div>
        );
    }
    
    const winners = (event.data?.winners as Player[] || []).map(p => ({
        ...p,
        objectiveMet: p.secretObjective ? secretObjectives.find(o => o.id === p.secretObjective?.id)?.checkCompletion(p, game) : false
    }));

    const losers = (event.data?.losers as Player[] || []).map(p => ({
        ...p,
        objectiveMet: p.secretObjective ? secretObjectives.find(o => o.id === p.secretObjective?.id)?.checkCompletion(p, game) : false
    }));
    
    return (
        <Card className="w-full max-w-4xl mx-auto text-center bg-card/90 p-6">
            <CardHeader>
                <CardTitle className="font-headline text-5xl flex items-center justify-center gap-4">
                    <Milestone className="h-10 w-10 text-yellow-400" />
                    Partida Terminada
                </CardTitle>
                <CardDescription className="text-xl text-primary pt-2">
                    {event.message}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div>
                    <h3 className="text-2xl font-bold font-headline mb-4 flex items-center justify-center gap-2 text-yellow-300">
                        <Crown className="h-6 w-6"/>
                        Ganadores
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {winners.map(p => (
                            <div key={p.userId} className="aspect-[3/4]">
                                 <PlayerCard game={game} player={p} currentPlayer={currentPlayer} masterActionState={masterActionState} setMasterActionState={setMasterActionState} />
                            </div>
                        ))}
                    </div>
                </div>
                
                 {losers.length > 0 && (
                    <div>
                        <h3 className="text-2xl font-bold font-headline mb-4 flex items-center justify-center gap-2 text-muted-foreground">
                            <Skull className="h-6 w-6"/>
                            Perdedores
                        </h3>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                            {losers.map(p => (
                                <div key={p.userId} className="aspect-[3/4] opacity-70">
                                    <PlayerCard game={game} player={p} currentPlayer={currentPlayer} masterActionState={masterActionState} setMasterActionState={setMasterActionState} />
                                </div>
                            ))}
                        </div>
                    </div>
                 )}

            </CardContent>
             <CardFooter className='flex-col items-center justify-center gap-4 pt-6'>
                <Button asChild size="lg">
                    <Link href="/">Volver al Inicio</Link>
                </Button>
                {isCreator ? (
                    <Button onClick={handleResetGame} size="lg" variant="secondary" disabled={isResetting}>
                        {isResetting ? <Loader2 className="animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                        Reiniciar Sala
                    </Button>
                ) : (
                        <Button size="lg" variant="secondary" disabled={true}>
                        Esperando al creador para reiniciar...
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}
