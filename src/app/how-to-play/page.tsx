
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HomeIcon } from 'lucide-react';
import { WolfIcon, VillagerIcon, DoctorIcon, SeerIcon, HunterIcon, CupidIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const roles = [
    {
        name: 'Hombre Lobo',
        Icon: WolfIcon,
        color: 'text-destructive',
        description:
            'Eres uno de los antagonistas. Cada noche, junto a tus compañeros lobos, eliges en secreto a un aldeano para eliminarlo. Durante el día, tu objetivo es hacerte pasar por un aldeano inocente y desviar las sospechas.',
    },
    {
        name: 'Aldeano Común',
        Icon: VillagerIcon,
        color: 'text-primary-foreground/80',
        description:
            'Formas la mayoría del pueblo. No tienes habilidades especiales nocturnas. Tu poder reside en tu capacidad de observación, debate y voto durante el día para identificar y linchar a los hombres lobo.',
    },
    {
        name: 'Doctor / Curandero',
        Icon: DoctorIcon,
        color: 'text-green-400',
        description:
            'Cada noche, puedes elegir a un jugador (incluido tú mismo) para protegerlo. Si los lobos atacan a esa persona, sobrevivirá. No puedes elegir a la misma persona dos noches seguidas.',
    },
    {
        name: 'Policía / Detective / Vidente',
        Icon: SeerIcon,
        color: 'text-blue-400',
        description:
            'Cada noche, tienes el poder de señalar a un jugador y el narrador te revelará su verdadera identidad (si es lobo o no). Tu información es crucial para guiar a los aldeanos.',
    },
    {
        name: 'Cazador',
        Icon: HunterIcon,
        color: 'text-yellow-500',
        description:
            'Si eres eliminado (ya sea por los lobos en la noche o por votación durante el día), tienes un último acto de venganza: puedes disparar y eliminar a otro jugador inmediatamente.',
    },
    {
        name: 'Cupido',
        Icon: CupidIcon,
        color: 'text-pink-400',
        description:
            'En la primera noche, eliges a dos jugadores para que se "enamoren". Si uno de esos dos jugadores muere, el otro morirá instantáneamente de desamor. Puedes elegirte a ti mismo como uno de los enamorados.',
    },
];

export default function HowToPlayPage() {
    const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center p-4 overflow-y-auto">
            {bgImage && (
                <Image
                    src={bgImage.imageUrl}
                    alt={bgImage.description}
                    fill
                    className="object-cover z-0"
                    data-ai-hint={bgImage.imageHint}
                />
            )}
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

            <main className="relative z-10 w-full max-w-4xl mx-auto space-y-8 text-primary-foreground py-12">
                <div className="text-center space-y-2">
                    <h1 className="font-headline text-5xl md:text-6xl font-bold tracking-tight">
                        Cómo Jugar
                    </h1>
                    <p className="text-lg text-primary-foreground/80">
                        Las reglas y secretos de Pueblo Duerme.
                    </p>
                </div>

                <Card className="bg-card/80">
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">Objetivo del Juego</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-lg">
                        <div>
                            <h3 className="font-bold text-accent">Para los Aldeanos:</h3>
                            <p className="text-muted-foreground">
                                Debéis descubrir y eliminar a todos los Hombres Lobo que se esconden entre vosotros. ¡La supervivencia del pueblo depende de vuestra astucia!
                            </p>
                        </div>
                        <div>
                            <h3 className="font-bold text-destructive">Para los Hombres Lobo:</h3>
                            <p className="text-muted-foreground">
                                Vuestro objetivo es eliminar aldeanos cada noche hasta que vuestro número iguale o supere al de los aldeanos restantes. La noche es vuestra aliada.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card/80">
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">Fases del Juego</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-primary">1. Fase de Noche</h3>
                            <p className="text-muted-foreground text-base">
                                El Narrador (el juego) pide a todos que "duerman" (cierren los ojos). Luego, va despertando a los roles especiales en secreto para que realicen sus acciones:
                            </p>
                            <ul className="list-disc list-inside pl-4 text-muted-foreground text-base space-y-1">
                                <li><strong className='text-pink-400'>Cupido:</strong> (Solo en la primera noche) Elige a dos enamorados.</li>
                                <li><strong className='text-destructive'>Hombres Lobo:</strong> Se despiertan, se reconocen y eligen a una víctima para eliminar.</li>
                                <li><strong className='text-blue-400'>Vidente/Policía:</strong> Elige a un jugador para descubrir su identidad.</li>
                                <li><strong className='text-green-400'>Doctor/Curandero:</strong> Elige a un jugador para protegerlo del ataque de los lobos.</li>
                            </ul>
                        </div>
                         <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-yellow-300">2. Fase de Día</h3>
                             <p className="text-muted-foreground text-base">
                                El pueblo se despierta. El Narrador anuncia quién ha sido eliminado durante la noche (si el Doctor no lo ha evitado). Esa persona revela su rol y queda fuera del juego, convirtiéndose en un fantasma que ya no puede hablar ni votar.
                            </p>
                            <p className='text-muted-foreground text-base'>
                                A continuación, se abre un debate. Los jugadores vivos discuten, acusan y se defienden para intentar adivinar quiénes son los lobos.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-red-400">3. Fase de Votación</h3>
                             <p className="text-muted-foreground text-base">
                                Tras el debate, llega la votación. Cada jugador vivo vota por alguien que crea que es un hombre lobo. El jugador con más votos es "linchado", revela su rol y queda eliminado. Si el <strong className='text-yellow-500'>Cazador</strong> es eliminado, puede llevarse a otro jugador con él.
                            </p>
                        </div>
                        <p className="text-center italic pt-4 text-base">El ciclo de noche y día se repite hasta que uno de los bandos cumpla su objetivo de victoria.</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/80">
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">Roles Especiales</CardTitle>
                        <CardDescription>Conoce las habilidades de cada personaje.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {roles.map(({ name, Icon, color, description }) => (
                                <AccordionItem value={name} key={name}>
                                    <AccordionTrigger className={cn("text-xl font-bold hover:no-underline", color)}>
                                        <div className="flex items-center gap-4">
                                            <Icon className="h-8 w-8" />
                                            <span>{name}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-base text-muted-foreground pl-14">
                                        {description}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
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
    );
}
