
"use client";

import { useEffect, useState } from 'react';
import type { GameEvent, Game, Player } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Milestone, Loader2, Play } from 'lucide-react';
import { playNarration } from '@/lib/sounds';
import { roleDetails } from '@/lib/roles';
import { useGameSession } from '@/hooks/use-game-session';
import { resetGame } from '@/lib/lobby-actions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Bot, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface GameOverProps {
    game: Game;
    event?: GameEvent;
    players: Player[];
    currentPlayer: Player | null;
}

export function GameOver({ game, event, players, currentPlayer }: GameOverProps) {
    const { toast } = useToast();
    const [isResetting, setIsResetting] = useState(false);

    const isCreator = game.creator === currentPlayer?.userId;

    useEffect(() => {
        if (event?.data?.winnerCode) {
            const winnerCode = event.data.winnerCode;
            switch(winnerCode) {
                case 'villagers':
                    playNarration('victoria-aldeanos.mp3');
                    break;
                case 'wolves':
                    playNarration('victoria-lobos.mp3');
                    break;
                case 'lovers':
                    playNarration('victoria-enamorados.mp3');
                    break;
                case 'cult':
                    playNarration('victoria-culto.mp3');
                    break;
                case 'vampire':
                    playNarration('el-vampiro-ha-ganado.mp3');
                    break;
                case 'drunk_man':
                    playNarration('ganador-el-ebrio.mp3');
                    break;
                case 'fisherman':
                    playNarration('pescador-ganador.mp3');
                    break;
                case 'executioner':
                    playNarration('victoria-el-verdugo.mp3');
                    break;
                case 'banshee':
                    break;
                case 'draw':
                    break;
            }
        }
    }, [event]);

    const handleResetGame = async () => {
        if (!isCreator) return;
        setIsResetting(true);
        const result = await resetGame(game.id);
        if (result.error) {
            toast({
                variant: 'destructive',
                title: 'Error al reiniciar',
                description: result.error,
            });
            setIsResetting(false);
        }
        // On success, the listener in GameRoom will handle the component switch
    };

    if (!event) {
        return (
            <div className="text-center">
                <h1 className="text-4xl font-bold">Partida Terminada</h1>
                <p>Calculando resultados...</p>
            </div>
        );
    }
    
    const getRoleInfo = (player: Player) => {
        return roleDetails[player.role!] ?? { name: 'Desconocido', image: '/roles/villager.png', color: 'text-white', team: 'Aldeanos' };
    };

    const villageTeam = players.filter(p => p.role && getRoleInfo(p).team === 'Aldeanos');
    const wolfTeam = players.filter(p => p.role && getRoleInfo(p).team === 'Lobos');
    const neutralTeam = players.filter(p => p.role && getRoleInfo(p).team === 'Neutral');

    const RoleListSection = ({ title, players, icon }: { title: string, players: Player[], icon: React.ReactNode }) => (
         <div>
            <h3 className="text-2xl font-bold flex items-center justify-center gap-2 mb-2">{icon}{title}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-left">
                {players.map(p => {
                    const roleInfo = getRoleInfo(p);
                    return (
                    <div key={p.userId} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                        <div className="relative h-8 w-8">
                            <Image src={roleInfo.image} alt={roleInfo.name} fill className="object-contain" unoptimized/>
                        </div>
                        <div>
                            <p className={cn("font-semibold", roleInfo.color)}>{p.displayName}</p>
                            <p className="text-xs text-muted-foreground">{roleInfo.name}</p>
                        </div>
                    </div>
                )})}
            </div>
        </div>
    );

    return (
        <Card className="w-full max-w-4xl mx-auto text-center bg-card/90">
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
                 <ScrollArea className="h-64">
                    <div className="space-y-6 p-4">
                        {villageTeam.length > 0 && <RoleListSection title="El Pueblo" players={villageTeam} icon={<Shield className="text-blue-400"/>} />}
                        {wolfTeam.length > 0 && <RoleListSection title="Los Lobos" players={wolfTeam} icon={<Bot className="text-destructive"/>} />}
                        {neutralTeam.length > 0 && <RoleListSection title="Roles Neutrales" players={neutralTeam} icon={<Wand2 className="text-purple-400"/>} />}
                    </div>
                 </ScrollArea>

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
    );
}
