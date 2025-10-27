
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HomeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { roleDetails } from '@/lib/roles';
import type { PlayerRole } from '@/types';
import { GameMusic } from '@/components/game/GameMusic';


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
                            <CardTitle className="font-headline text-3xl">El Comienzo</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-lg text-muted-foreground">
                            <p>
                               Pueblo Duerme es un juego de misterio y engaño donde se te asignará un rol secreto. Es fundamental que no lo reveles; el misterio es la clave.
                            </p>
                            <p>
                                Cuando el juego anuncie "Pueblo, duerme", comenzará la fase de noche. Deberás cerrar los ojos (simbólicamente) y solo actuar cuando tu rol sea llamado. El silencio durante esta fase es crucial.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/80">
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">Objetivo del Juego</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-lg">
                            <div>
                                <h3 className="font-bold text-blue-400">Para los Aldeanos (Equipo Azul):</h3>
                                <p className="text-muted-foreground">
                                    Vuestro objetivo es descubrir y eliminar a todos los Hombres Lobo mediante las votaciones del día. ¡La supervivencia del pueblo depende de vuestra astucia!
                                </p>
                            </div>
                            <div>
                                <h3 className="font-bold text-destructive">Para los Lobos (Equipo Rojo):</h3>
                                <p className="text-muted-foreground">
                                    Vuestra misión es asesinar a los aldeanos cada noche hasta que vuestro número iguale o supere al de los aldeanos restantes. La noche es vuestra aliada.
                                </p>
                            </div>
                             <div>
                                <h3 className="font-bold text-pink-400">Para los Enamorados y Solitarios:</h3>
                                <p className="text-muted-foreground">
                                    Algunos roles tienen objetivos únicos. Si eres un Enamorado, tu objetivo es ser el último superviviente junto a tu pareja. Otros, como el Hombre Ebrio o el Líder del Culto, tienen sus propias condiciones de victoria.
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
                            <p className="text-center italic pt-4 text-base">El ciclo de noche y día se repite hasta que uno de los bandos cumpla su objetivo de victoria.</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/80">
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">Reglas Avanzadas y Orden Nocturno</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-base text-muted-foreground">
                            <h4 className="font-bold text-xl text-primary-foreground">Orden de Acciones en la Noche</h4>
                            <p>Las habilidades nocturnas se resuelven en un orden estricto para evitar conflictos. El Máster seguirá esta secuencia:</p>
                            <ol className="list-decimal list-inside space-y-2 pl-4">
                                <li>**Acciones de Bloqueo/Manipulación:** Anciana Líder (Exilio), Silenciador.</li>
                                <li>**Acciones de Protección:** Sacerdote (Bendición), Guardián, Doctor.</li>
                                <li>**Acciones de Investigación:** Vidente, Vigía, Bruja, Hada Buscadora.</li>
                                <li>**Acciones de Asesinato/Ataque:** Hombres Lobo, Hechicera (Veneno).</li>
                                <li>**Roles Especiales (Post-Ataque):** Hechicera (Poción de Vida).</li>
                            </ol>

                            <h4 className="font-bold text-xl text-primary-foreground mt-4">Resolución de Conflictos y Habilidades</h4>
                            <ul className="list-disc list-inside space-y-2 pl-4">
                                <li>
                                    <strong>Prioridad de Protección:</strong> La bendición del **Sacerdote** es la protección más fuerte; anula cualquier ataque o habilidad negativa. Le siguen las protecciones del Guardián y el Doctor, que solo protegen del ataque de los lobos. La poción de vida de la Hechicera actúa en último lugar, revirtiendo una muerte ya ocurrida esa noche.
                                </li>
                                <li>
                                    <strong>Vínculos Inquebrantables:</strong> La muerte causada por el vínculo de **Virginia Woolf** o la de los **Enamorados** es automática e inevitable. Ninguna protección puede salvar al jugador vinculado si su pareja muere.
                                </li>
                                <li>
                                    <strong>El Último Disparo del Cazador:</strong> La habilidad del **Cazador** al morir es ineludible. Si dispara a un jugador, este muere sin importar si estaba protegido o bendecido esa noche o si es el Príncipe.
                                </li>
                                <li>
                                    <strong>Sirena y el Lobo Hechizado:</strong> Si la **Sirena del Río** hechiza a un Hombre Lobo, este sentirá un impulso irrefrenable de eliminarla. En la práctica, esto significa que el jugador lobo debe hacer todo lo posible (persuasión, votación) para que el resto de la manada elija a la Sirena como objetivo. No es un control mental automático, sino una obligación de rol.
                                </li>
                                <li>
                                    <strong>Objetivos (Líder de Culto, Pescador):</strong> Las condiciones de victoria de estos roles se aplican únicamente a los jugadores que siguen **vivos** en la partida.
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

