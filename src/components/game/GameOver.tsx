
"use client";

import type { GameEvent, Player } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import Link from 'next/link';
import { CrownIcon } from 'lucide-react';
import { WolfIcon, VillagerIcon } from '../icons';

interface GameOverProps {
    event?: GameEvent;
    players: Player[];
}

export function GameOver({ event, players }: GameOverProps) {
    if (!event) {
        return (
            <div className="text-center">
                <h1 className="text-4xl font-bold">Partida Terminada</h1>
                <p>Calculando resultados...</p>
            </div>
        );
    }

    const werewolves = players.filter(p => p.role === 'werewolf');
    const villagers = players.filter(p => p.role !== 'werewolf');

    return (
        <Card className="w-full max-w-2xl mx-auto text-center bg-card/90">
            <CardHeader>
                <CardTitle className="font-headline text-5xl flex items-center justify-center gap-4">
                    <CrownIcon className="h-10 w-10 text-yellow-400" />
                    Partida Terminada
                </CardTitle>
                <CardDescription className="text-xl text-primary pt-2">
                    {event.message}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="text-2xl font-bold flex items-center justify-center gap-2"><WolfIcon /> Hombres Lobo</h3>
                    <ul className="list-none p-0">
                        {werewolves.map(p => (
                            <li key={p.userId} className="text-lg text-muted-foreground">{p.displayName}</li>
                        ))}
                    </ul>
                </div>
                 <div>
                    <h3 className="text-2xl font-bold flex items-center justify-center gap-2"><VillagerIcon /> Aldeanos</h3>
                    <ul className="list-none p-0">
                        {villagers.map(p => (
                             <li key={p.userId} className="text-lg text-muted-foreground">{p.displayName} ({p.role})</li>
                        ))}
                    </ul>
                </div>
                <Button asChild size="lg" className="mt-6">
                    <Link href="/">Volver al Inicio</Link>
                </Button>
            </CardContent>
        </Card>
    )
}
