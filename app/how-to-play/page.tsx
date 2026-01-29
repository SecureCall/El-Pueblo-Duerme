
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { HomeIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { roleDetails } from '../lib/roles';
import type { PlayerRole } from '../types';
import { GameMusic } from '../components/game/GameMusic';

const RoleSection = ({ title, roleKeys, teamColor }: { title: string, roleKeys: PlayerRole[], teamColor: string }) => (
    <Card className="bg-card/80">
        <CardHeader>
            <CardTitle className={cn("font-headline text-3xl", teamColor)}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="w-full">
                {roleKeys.sort((a, b) => roleDetails[a]!.name.localeCompare(roleDetails[b]!.name)).map((roleKey) => {
                    const details = roleDetails[roleKey];
                    if (!details) return null;
                    return (
                        <AccordionItem value={details.name} key={details.name}>
                            <AccordionTrigger className={cn("text-xl font-bold hover:no-underline", details.color)}>
                                <div className="flex items-center gap-4">
                                    <div className="relative h-10 w-10">
                                        <Image
                                            src={details.image}
                                            alt={details.name}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                    <span>{details.name}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-base text-muted-foreground pl-20">
                                {details.description}
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </CardContent>
    </Card>
);

export default function HowToPlayPage() {
    const allRoleKeys = Object.keys(roleDetails) as PlayerRole[];
    const villageTeam = allRoleKeys.filter(key => roleDetails[key]?.team === 'Aldeanos');
    const wolfTeam = allRoleKeys.filter(key => roleDetails[key]?.team === 'Lobos');
    const neutralTeam = allRoleKeys.filter(key => roleDetails[key]?.team === 'Neutral');

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
                />
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

                <main className="relative z-10 w-full max-w-4xl mx-auto space-y-8 text-white py-12">
                    <div className="text-center space-y-2">
                        <h1 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-white">
                            Cómo Jugar
                        </h1>
                        <p className="text-lg text-white/80">
                            Las reglas y secretos de Pueblo Duerme.
                        </p>
                    </div>

                    <Card className="bg-card/80">
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">El Juego</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-base text-muted-foreground">
                           <p>El Pueblo Duerme es un juego de engaño, deducción y supervivencia. Al principio de la partida, a cada jugador se le asigna un rol secreto que pertenece a uno de tres equipos: los Aldeanos, los Hombres Lobo, o Neutral.</p>
                           <ul className='list-disc list-inside space-y-2'>
                               <li><strong className='text-blue-400'>El Pueblo:</strong> Su objetivo es descubrir y eliminar a todos los Hombres Lobo.</li>
                               <li><strong className='text-destructive'>Los Lobos:</strong> Su objetivo es eliminar a los aldeanos hasta que su número sea igual o superior al de los aldeanos restantes.</li>
                               <li><strong className='text-purple-400'>Roles Neutrales:</strong> Cada rol neutral tiene un objetivo de victoria único y egoísta.</li>
                           </ul>
                        </CardContent>
                    </Card>

                    {villageTeam.length > 0 && <RoleSection title="El Pueblo" roleKeys={villageTeam} teamColor="text-blue-400" />}
                    {wolfTeam.length > 0 && <RoleSection title="Los Lobos" roleKeys={wolfTeam} teamColor="text-destructive" />}
                    {neutralTeam.length > 0 && <RoleSection title="Roles Neutrales" roleKeys={neutralTeam} teamColor="text-purple-400" />}

                    <div className="text-center pt-4">
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
