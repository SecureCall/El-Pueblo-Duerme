'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { HomeIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { roleDetails } from '../lib/roles';
import type { PlayerRole } from '../types';
import { GameMusic } from '../components/game/GameMusic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const allRolesArray = (Object.keys(roleDetails) as (keyof typeof roleDetails)[])
    .map(key => ({ id: key, ...roleDetails[key]! }))
    .sort((a, b) => a.name.localeCompare(b.name));

type Team = 'all' | 'Aldeanos' | 'Lobos' | 'Neutral';

export default function HowToPlayPage() {
    const [selectedTeam, setSelectedTeam] = useState<Team>('all');
    
    const filteredRoles = selectedTeam === 'all'
        ? allRolesArray
        : allRolesArray.filter(role => role.team === selectedTeam);

    const teamConfig: Record<Team, { color: string; bg: string; border: string; text: string; }> = {
        all: { color: 'bg-primary', bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary' },
        Aldeanos: { color: 'bg-blue-600', bg: 'bg-blue-900/20', border: 'border-blue-400/40', text: 'text-blue-300' },
        Lobos: { color: 'bg-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive' },
        Neutral: { color: 'bg-purple-600', bg: 'bg-purple-900/20', border: 'border-purple-400/40', text: 'text-purple-300' },
    };

    return (
        <>
            <GameMusic src="/audio/menu-theme.mp3" />
            <div className="relative min-h-screen w-full flex flex-col items-center p-4 overflow-y-auto">
                <Image
                    src="/noche.png"
                    alt="A mysterious, dark, misty forest at night."
                    fill
                    className="object-cover z-0"
                    data-ai-hint="night village"
                    priority
                />
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

                <main className="relative z-10 w-full max-w-6xl mx-auto space-y-8 text-white py-12">
                    <div className="text-center space-y-2">
                        <h1 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-white">
                            Manual de Roles
                        </h1>
                        <p className="text-lg text-white/80">
                            Explora las habilidades y alianzas de los habitantes de Pueblo Duerme.
                        </p>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-2 mb-6 justify-center">
                        {(Object.keys(teamConfig) as Team[]).map(team => (
                        <Button
                            key={team}
                            variant={selectedTeam === team ? 'default' : 'secondary'}
                            onClick={() => setSelectedTeam(team)}
                            className={cn(selectedTeam === team && teamConfig[team].color)}
                        >
                            {team === 'all' ? 'Todos los Roles' : team}
                        </Button>
                        ))}
                    </div>
                    
                    {/* Grid de roles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRoles.map(role => (
                        <Card 
                            key={role.id}
                            className={cn("bg-card/80 flex flex-col", teamConfig[role.team].border)}
                        >
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className="relative h-16 w-16 flex-shrink-0">
                                        <Image
                                            src={role.image}
                                            alt={role.name}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                    <div>
                                        <CardTitle className={cn("text-2xl", role.color)}>{role.name}</CardTitle>
                                        <CardDescription className={cn("font-bold", teamConfig[role.team].text)}>
                                            Equipo: {role.team}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-muted-foreground">{role.description}</p>
                            </CardContent>
                        </Card>
                        ))}
                    </div>

                    <div className="text-center pt-8">
                        <Button asChild>
                            <Link href="/">
                                <HomeIcon className="mr-2" />
                                Volver al Inicio
                            </Link>
                        </Button>
                    </div>
                </main>
            </div>
        </>
    );
}
