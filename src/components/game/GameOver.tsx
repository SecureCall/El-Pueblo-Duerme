
"use client";

import { useEffect } from 'react';
import type { GameEvent, Player } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Milestone, User, BotIcon } from 'lucide-react';
import { playNarration } from '@/lib/sounds';
import { roleDetails } from '@/lib/roles';


interface GameOverProps {
    event?: GameEvent;
    players: Player[];
}

export function GameOver({ event, players }: GameOverProps) {
    
    useEffect(() => {
        if (event) {
            const villagersWon = event.message.includes('pueblo ha ganado');
            if (villagersWon) {
                playNarration('victoria_aldeanos.mp3');
            } else {
                playNarration('victoria_lobos.mp3');
            }
        }
    }, [event]);

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
                <Button asChild size="lg" className="mt-6">
                    <Link href="/">Volver al Inicio</Link>
                </Button>
            </CardContent>
        </Card>
    )
}
