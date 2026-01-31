
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
                    priority
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
                            <CardTitle className="font-headline text-3xl">La Regla Cero</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-base text-muted-foreground">
                           <p>La única información válida es la que se genera a través de las mecánicas del juego. Toda la información debe permanecer dentro del 'círculo mágico' de la partida.</p>
                           <ul className='list-disc list-inside space-y-2'>
                               <li><strong>Tu carta es secreta:</strong> Nunca puedes mostrar tu carta de rol a nadie.</li>
                               <li><strong>No a los pactos externos:</strong> Cualquier pacto, código o señal debe ser creado y comunicado durante el transcurso del juego, visible para todos.</li>
                               <li><strong>Respeta la eliminación:</strong> Un jugador eliminado no puede hablar ni comunicarse con los jugadores vivos, excepto a través de la mecánica del Jurado Fantasma.</li>
                               <li><strong>La palabra del Máster es ley:</strong> En caso de una situación no contemplada en las reglas, la decisión del Máster (o del motor del juego) es final.</li>
                           </ul>
                        </CardContent>
                    </Card>

                     <Card className="bg-card/80">
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">Fases del Juego</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-base text-muted-foreground">
                            <div>
                                <h3 className="text-xl font-bold text-primary mb-2">1. Fase de Noche</h3>
                                <p>Durante la noche, la mayoría de los jugadores duermen. Es el momento en que los Hombres Lobo y otros roles con habilidades nocturnas actúan en secreto. Los Hombres Lobo se comunican en un chat privado para decidir a quién eliminar.</p>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-primary mb-2">2. Fase de Día</h3>
                                <p>El pueblo se despierta y descubre quién (si alguien) ha sido asesinado durante la noche. A partir de aquí, comienza el debate. Los jugadores discuten, acusan y se defienden en el chat público. El objetivo es identificar a los sospechosos.</p>
                            </div>
                             <div>
                                <h3 className="text-xl font-bold text-primary mb-2">3. Fase de Votación</h3>
                                <p>Al final del día, todos los jugadores vivos deben votar para linchar a un jugador que crean que es un Hombre Lobo. El jugador con más votos es eliminado de la partida y su rol es revelado. Si hay un empate, puede haber una segunda ronda de votación o, dependiendo de la configuración, nadie es eliminado.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/80">
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">Condiciones de Victoria</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4 text-base text-muted-foreground">
                           <ul className='list-disc list-inside space-y-2'>
                               <li><strong className='text-blue-400'>El Pueblo:</strong> Gana cuando todos los Hombres Lobo y amenazas neutrales han sido eliminados.</li>
                               <li><strong className='text-destructive'>Los Lobos:</strong> Ganan cuando su número es igual o superior al de los aldeanos restantes.</li>
                               <li><strong className='text-purple-400'>Roles Neutrales:</strong> Cada rol neutral tiene un objetivo de victoria único y egoísta que debe cumplir.</li>
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
