
"use client";

import { useEffect, useState } from 'react';
import type { GameEvent, Game, Player } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Milestone, User, BotIcon, Loader2, Play } from 'lucide-react';
import { playNarration } from '@/lib/sounds';
import { roleDetails } from '@/lib/roles';
import { useGameSession } from '@/hooks/use-game-session';
import { useFirebase } from '@/firebase';
import { resetGame } from '@/lib/firebase-actions';
import { useToast } from '@/hooks/use-toast';


interface GameOverProps {
    game: Game;
    event?: GameEvent;
    players: Player[];
    currentPlayer: Player | null;
}

export function GameOver({ game, event, players, currentPlayer }: GameOverProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isResetting, setIsResetting] = useState(false);

    const isCreator = game.creator === currentPlayer?.userId;

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
                    playNarration('victoria enamorados.mp3');
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
                    // No specific sound provided for banshee, can be added here
                    break;
                case 'draw':
                    // No specific sound provided for a draw, can be added here
                    break;
            }
        }
    }, [event]);

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

    if (!event) {
        return (
            <div className="text-center">
                <h1 className="text-4xl font-bold">Partida Terminada</h1>
                <p>Calculando resultados...</p>
            </div>
        );
    }

    const werewolves = players.filter(p => p.role === 'werewolf' || p.role === 'wolf_cub' || p.role === 'cursed');
    const villagers = players.filter(p => p.role !== 'werewolf' && p.role !== 'wolf_cub' && p.role !== 'cursed');

    const getRoleName = (role: Player['role']) => {
        if (!role) return 'Desconocido';
        return roleDetails[role]?.name || role;
    }

    return (
        <Card className="w-full max-w-2xl mx-auto text-center bg-card/90">
            <CardHeader>
                <CardTitle className="font-headline text-5xl flex items-center justify-center gap-4">
                    <Milestone className="h-10 w-10 text-yellow-400" />
                    Partida Terminada
                </CardTitle>
                <CardDescription className="text-xl text-primary pt-2">
                    {event.message}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-2xl font-bold flex items-center justify-center gap-2"><BotIcon /> Hombres Lobo</h3>
                    <ul className="list-none p-0">
                        {werewolves.map(p => (
                            <li key={p.userId} className="text-lg text-muted-foreground">{p.displayName} ({getRoleName(p.role)})</li>
                        ))}
                    </ul>
                </div>
                 <div>
                    <h3 className="text-2xl font-bold flex items-center justify-center gap-2"><User /> Pueblo</h3>
                    <ul className="list-none p-0">
                        {villagers.map(p => (
                             <li key={p.userId} className="text-lg text-muted-foreground">{p.displayName} ({getRoleName(p.role)})</li>
                        ))}
                    </ul>
                </div>
                <div className='flex items-center justify-center gap-4 pt-6'>
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
                </div>
            </CardContent>
        </Card>
    )
}
