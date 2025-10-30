
"use client";

import { useEffect, useState } from 'react';
import type { GameEvent, Game, Player } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Milestone, Loader2, Play, Users, BotIcon } from 'lucide-react';
import { playNarration } from '@/lib/sounds';
import { roleDetails } from '@/lib/roles';
import { useGameSession } from '@/hooks/use-game-session';
import { useFirebase } from '@/firebase';
import { resetGame } from '@/lib/firebase-actions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Shield, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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
                    playNarration('victoria_enamorados.mp3');
                    break;
                case 'cult':
                    playNarration('victoria_culto.mp3');
                    break;
                case 'vampire':
                    playNarration('el_vampiro_ha_ganado.mp3');
                    break;
                case 'drunk_man':
                    playNarration('ganador_el_ebrio.mp3');
                    break;
                case 'fisherman':
                    playNarration('pescador_ganador.mp3');
                    break;
                case 'executioner':
                    playNarration('victoria_el_berdugo.mp3');
                    break;
                case 'banshee':
                    break;
                case 'draw':
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

    const wolfTeamRoles: Player['role'][] = ['werewolf', 'wolf_cub', 'cursed', 'witch', 'seeker_fairy'];
    const specialTeamRoles: Player['role'][] = ['cupid', 'shapeshifter', 'drunk_man', 'cult_leader', 'fisherman', 'vampire', 'banshee', 'executioner', 'sleeping_fairy'];

    const villageTeam = players.filter(p => p.role && !wolfTeamRoles.includes(p.role) && !specialTeamRoles.includes(p.role));
    const wolfTeam = players.filter(p => p.role && wolfTeamRoles.includes(p.role));
    const specialTeam = players.filter(p => p.role && specialTeamRoles.includes(p.role));

    const getRoleInfo = (player: Player) => {
        return roleDetails[player.role!] ?? { name: 'Desconocido', image: '/roles/villager.png', color: 'text-white' };
    };

    const RoleListSection = ({ title, players, icon }: { title: string, players: Player[], icon: React.ReactNode }) => (
         <div>
            <h3 className="text-2xl font-bold flex items-center justify-center gap-2 mb-2">{icon}{title}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-left">
                {players.map(p => (
                    <div key={p.userId} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                        <div className="relative h-8 w-8">
                            <Image src={getRoleInfo(p).image} alt={getRoleInfo(p).name} fill className="object-contain" unoptimized/>
                        </div>
                        <div>
                            <p className={cn("font-semibold", getRoleInfo(p).color)}>{p.displayName}</p>
                            <p className="text-xs text-muted-foreground">{getRoleInfo(p).name}</p>
                        </div>
                    </div>
                ))}
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
                        {wolfTeam.length > 0 && <RoleListSection title="Los Lobos" players={wolfTeam} icon={<BotIcon className="text-destructive"/>} />}
                        {specialTeam.length > 0 && <RoleListSection title="Roles Especiales" players={specialTeam} icon={<Wand2 className="text-purple-400"/>} />}
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
