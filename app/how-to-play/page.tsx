
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '../components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PlaceHolderImages } from '../lib/placeholder-images';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { HomeIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { roleDetails } from '../lib/roles';
import type { PlayerRole } from '../types';
import { GameMusic } from '../components/game/GameMusic';


const aldeanoRoleKeys: NonNullable<PlayerRole>[] = [
    'villager', 'seer', 'doctor', 'hunter', 'guardian', 'priest', 'prince', 'lycanthrope',
    'twin', 'hechicera', 'ghost', 'virginia_woolf', 'leprosa', 'river_siren', 'lookout',
    'troublemaker', 'silencer', 'seer_apprentice', 'elder_leader', 'sleeping_fairy', 'resurrector_angel'
];

const loboRoleKeys: NonNullable<PlayerRole>[] = [
    'werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch'
];

const especialRoleKeys: NonNullable<PlayerRole>[] = [
    'cupid', 'shapeshifter', 'drunk_man', 'cult_leader', 'fisherman', 'vampire', 'banshee', 'executioner'
];


const RoleSection = ({ title, roleKeys, teamColor }: { title: string, roleKeys: NonNullable<PlayerRole>[], teamColor: string }) => (
    <Card className="bg-card/80">
        <CardHeader>
            <CardTitle className={cn("font-headline text-3xl", teamColor)}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="w-full">
                {roleKeys.map((roleKey) => {
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
    const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');

    return (
        <>
            <GameMusic src="/audio/menu-theme.mp3" />
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
                           <p className='font-bold text-lg text-primary'>La única información válida es la que se genera a través de las mecánicas del juego. Toda la información debe permanecer dentro del 'círculo mágico' de la partida.</p>
                           <ul className='list-disc list-inside space-y-2'>
                               <li>**Tu carta es secreta:** Nunca puedes mostrar tu carta de rol a nadie.</li>
                               <li>**No a los pactos externos:** Cualquier pacto, código o señal debe ser creado y comunicado durante el transcurso del juego, visible para todos.</li>
                               <li>**Respeta la eliminación:** Un jugador eliminado no puede hablar ni comunicarse con los jugadores vivos, excepto a través de la mecánica del Jurado Fantasma.</li>
                               <li>**La palabra del Máster es ley:** En caso de una situación no contemplada en las reglas, la decisión del Máster (o del motor del juego) es final.</li>
                           </ul>
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
                                    El pueblo "duerme". El juego irá activando a los roles con habilidades nocturnas en secreto para que realicen sus acciones a través de la interfaz. Los lobos eligen a su víctima, la vidente investiga, el doctor protege, etc.
                                </p>
                            </div>
                             <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-yellow-300">2. Fase de Día</h3>
                                 <p className="text-muted-foreground text-base">
                                    El pueblo "despierta". El juego anunciará quién ha sido eliminado durante la noche. Tras esto, se abre un debate donde los jugadores vivos discuten y acusan para intentar adivinar quiénes son los lobos. El tiempo para debatir es limitado.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-red-400">3. Fase de Votación</h3>
                                 <p className="text-muted-foreground text-base">
                                    Tras el debate, cada jugador vivo vota por alguien que crea que es un hombre lobo. El jugador con más votos es "linchado", revela su rol y queda eliminado.
                                </p>
                            </div>
                             <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-gray-400">4. Voto del Jurado (Ocasional)</h3>
                                 <p className="text-muted-foreground text-base">
                                    Si la votación del pueblo resulta en un empate irresoluble, los espíritus de los jugadores eliminados (el Jurado Fantasma) emitirán el voto decisivo.
                                </p>
                            </div>
                            <p className="text-center italic pt-4 text-base">El ciclo de noche y día se repite hasta que uno de los bandos cumpla su objetivo de victoria.</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/80">
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">Reglas Avanzadas y Orden Nocturno</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-base text-muted-foreground">
                            <h4 className="font-bold text-xl text-primary-foreground">Orden de Acciones en la Noche (La Pila de Acciones)</h4>
                            <p>Las habilidades nocturnas se resuelven en un orden estricto para evitar conflictos. El motor del juego sigue esta secuencia inmutable:</p>
                            <ol className="list-decimal list-inside space-y-2 pl-4">
                                <li>**Fase 1: Manipulación y Control:** Acciones que afectan las habilidades de otros (Anciana Líder, Silenciador).</li>
                                <li>**Fase 2: Protección y Prevención:** Habilidades defensivas (Sacerdote, Guardián, Doctor, poción de la Hechicera).</li>
                                <li>**Fase 3: Acciones Letales y de Conversión:** Intentos de asesinato o transformación (Lobos, Veneno de Hechicera, Vampiro, Maldito).</li>
                                <li>**Fase 4: Investigación y Reclutamiento:** Obtención de información o nuevos miembros (Vidente, Líder de Culto).</li>
                                 <li>**Fase 5: Resolución Final:** El motor del juego calcula el resultado final de la noche, aplicando protecciones a los ataques y determinando quién muere.</li>
                            </ol>

                            <h4 className="font-bold text-xl text-primary-foreground mt-4">Resolución de Conflictos y Habilidades ("Triggers")</h4>
                            <ul className="list-disc list-inside space-y-2 pl-4">
                                 <li>
                                    <strong>Prioridad de Protección:</strong> La bendición del **Sacerdote** anula un único ataque o habilidad negativa. Le siguen las protecciones del Guardián/Doctor (contra lobos) y finalmente la poción de la Hechicera, que revierte una muerte ya ocurrida.
                                </li>
                                <li>
                                    **Habilidades "Disparadas" (Triggers):** Habilidades como la del Cazador (al morir), los Enamorados o Virginia Woolf pausan el juego y se resuelven inmediatamente, incluso creando reacciones en cadena, antes de que el juego continúe.
                                </li>
                                 <li>
                                    **El Fracaso del Verdugo:** Si el objetivo del **Verdugo** muere por cualquier otra causa que no sea el linchamiento del pueblo, el Verdugo pierde y se convierte en un simple Aldeano, teniendo que ganar con ellos.
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                    
                    <RoleSection title="El Pueblo" roleKeys={aldeanoRoleKeys} teamColor="text-blue-400" />
                    <RoleSection title="Los Lobos" roleKeys={loboRoleKeys} teamColor="text-destructive" />
                    <RoleSection title="Roles Especiales" roleKeys={especialRoleKeys} teamColor="text-pink-400" />

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
