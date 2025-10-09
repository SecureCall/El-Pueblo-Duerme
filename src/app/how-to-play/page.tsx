
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
import { 
    WolfIcon, VillagerIcon, DoctorIcon, SeerIcon, HunterIcon, CupidIcon, GuardianIcon, GhostIcon, PriestIcon, VirginiaWoolfIcon, LeperIcon, PrinceIcon, LycanthropeIcon, RiverMermaidIcon, LookoutIcon, TroublemakerIcon, SilencerIcon, TwinIcon, SeerApprenticeIcon, ElderLeaderIcon, HechiceraIcon, WolfCubIcon, SeekerFairyIcon, CursedIcon, SleepingFairyIcon, ShapeshifterIcon, DrunkManIcon, CultLeaderIcon, FishermanIcon, VampireIcon, WitchIcon, BansheeIcon 
} from '@/components/icons';
import { cn } from '@/lib/utils';


const aldeanosRoles = [
    {
        name: 'Aldeano',
        Icon: VillagerIcon,
        color: 'text-blue-300',
        description:
            'No tienes poderes especiales. Tu misión es observar, razonar y participar en los juicios para descubrir a los lobos. Tu voto es tu mayor poder.',
    },
    {
        name: 'Guardián',
        Icon: GuardianIcon,
        color: 'text-blue-300',
        description:
            'Cada noche, eliges a un jugador para protegerlo. Ese jugador no podrá ser asesinado por los lobos. Solo puedes protegerte a ti mismo una vez por partida.',
    },
    {
        name: 'Vidente',
        Icon: SeerIcon,
        color: 'text-blue-300',
        description:
            'Cada noche, eliges a un jugador y el juego te revelará si es un lobo, un aldeano o un rol especial. Tu información es crucial, pero revelarte te convierte en un objetivo.',
    },
    {
        name: 'Doctor',
        Icon: DoctorIcon,
        color: 'text-green-300',
        description:
            'Cada noche, puedes proteger a un jugador del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas.'
    },
    {
        name: 'Sacerdote',
        Icon: PriestIcon,
        color: 'text-blue-300',
        description:
            'Cada noche, otorgas una bendición a un jugador, protegiéndolo de cualquier tipo de ataque (lobos, hechizos, etc.). Puedes bendecirte a ti mismo una vez por partida.',
    },
    {
        name: 'Gemelas',
        Icon: TwinIcon,
        color: 'text-blue-300',
        description:
            'La primera noche, os despertáis para reconoceros. Empiezas la partida con una aliada de confianza, lo que es una gran ventaja estratégica.',
    },
    {
        name: 'Cazador',
        Icon: HunterIcon,
        color: 'text-blue-300',
        description:
            'Si eres eliminado (de día o de noche), tienes un último acto: puedes disparar y eliminar a otro jugador inmediatamente.',
    },
    {
        name: 'Hechicera',
        Icon: HechiceraIcon,
        color: 'text-blue-300',
        description:
            'Tienes una poción de veneno (para eliminar a un jugador por la noche) y una poción de protección (para salvar a un jugador atacado). Puedes usar cada una una vez por partida.',
    },
    {
        name: 'Príncipe',
        Icon: PrinceIcon,
        color: 'text-blue-300',
        description:
            'No puedes ser eliminado por la votación del pueblo. Si recibes la mayoría de votos, revelas tu carta y sobrevives, pero te conviertes en un objetivo claro para los lobos.',
    },
     {
        name: 'Licántropo',
        Icon: LycanthropeIcon,
        color: 'text-blue-300',
        description:
            'Eres un aldeano, pero si la Vidente te investiga, te verá como un Hombre Lobo. Tu reto es convencer a todos de tu inocencia a pesar de las pruebas en tu contra.',
    },
     {
        name: 'Leprosa',
        Icon: LeperIcon,
        color: 'text-blue-300',
        description:
            'No tienes acción nocturna. Sin embargo, si eres asesinada por los lobos, tu enfermedad les impide atacar en la noche siguiente.',
    },
    {
        name: 'Fantasma',
        Icon: GhostIcon,
        color: 'text-blue-300',
        description:
            'Si mueres, puedes enviar un único mensaje escrito a un jugador vivo a través del máster (el juego). No puedes revelar roles directamente.',
    },
     {
        name: 'Vigía',
        Icon: LookoutIcon,
        color: 'text-blue-300',
        description:
            'Puedes intentar espiar cuando los lobos se despiertan. Si lo logras sin que te descubran, sabrás quiénes son. Si te ven, mueres. No puede jugar si hay una Vidente.',
    },
    {
        name: 'Aprendiz de Vidente',
        Icon: SeerApprenticeIcon,
        color: 'text-blue-300',
        description:
            'Mientras la Vidente viva, eres un aldeano normal. Si la Vidente muere, tú te conviertes en la nueva Vidente y adquieres su habilidad nocturna.',
    },
    {
        name: 'Anciana Líder',
        Icon: ElderLeaderIcon,
        color: 'text-blue-300',
        description:
            'Cada noche eliges a un jugador para expulsarlo temporalmente. Esa persona no podrá usar sus habilidades durante la noche siguiente.',
    }
];

const lobosRoles = [
     {
        name: 'Hombre Lobo',
        Icon: WolfIcon,
        color: 'text-destructive',
        description:
            'Cada noche, junto a tus compañeros lobos, eliges en secreto a un aldeano para eliminarlo. Durante el día, tu objetivo es hacerte pasar por un aldeano inocente.',
    },
    {
        name: 'Cría de Lobo',
        Icon: WolfCubIcon,
        color: 'text-destructive',
        description:
            'Actúas como un Hombre Lobo normal. Sin embargo, si eres eliminado, la noche siguiente a tu muerte los lobos podrán devorar a dos jugadores en lugar de uno.',
    },
    {
        name: 'Maldito',
        Icon: CursedIcon,
        color: 'text-destructive',
        description:
            'Empiezas como un aldeano. No tienes acciones. Sin embargo, si los lobos te atacan, no mueres, sino que te transformas en un Hombre Lobo y te unes a su equipo.',
    },
];

const especialesRoles = [
    {
        name: 'Cupido',
        Icon: CupidIcon,
        color: 'text-pink-400',
        description:
            'La primera noche, eliges a dos jugadores para que se "enamoren". Si uno de ellos muere, el otro morirá instantáneamente de desamor. Los enamorados ganan si son los únicos dos supervivientes.',
    },
    {
        name: 'Virginia Woolf',
        Icon: VirginiaWoolfIcon,
        color: 'text-purple-400',
        description:
            'Solo te despiertas la primera noche para elegir a un jugador. Si mueres en cualquier momento, la persona que elegiste también morirá automáticamente contigo.',
    },
    {
        name: 'Sirena del Río',
        Icon: RiverMermaidIcon,
        color: 'text-purple-400',
        description:
            'La primera noche, hechizas a un jugador. La segunda noche, os reconocéis. A partir de entonces, ese jugador está obligado a votar siempre lo mismo que tú en los juicios.',
    },
    {
        name: 'Alborotadora',
        Icon: TroublemakerIcon,
        color: 'text-purple-400',
        description:
            'Una vez por partida, puedes elegir a dos jugadores para que peleen. Ambos serán eliminados inmediatamente. Eliges cuándo usar este poder.',
    },
    {
        name: 'Silenciadora',
        Icon: SilencerIcon,
        color: 'text-purple-400',
        description:
            'Cada noche, eliges a un jugador para silenciarlo. Esa persona no podrá hablar durante todo el día siguiente, lo que le impedirá debatir y defenderse.',
    },
    {
        name: 'Hada Buscadora',
        Icon: SeekerFairyIcon,
        color: 'text-red-400',
        description:
            'Tu equipo son los lobos. Cada noche buscas a la Hada Durmiente. Si la encuentras, se unirá al bando de los lobos. Una vez juntas, podréis lanzar una maldición mortal una vez por partida.',
    },
    {
        name: 'Hada Durmiente',
        Icon: SleepingFairyIcon,
        color: 'text-blue-400',
        description:
            'Empiezas como aldeana. Si el Hada Buscadora te encuentra, te conviertes a la locura y te unes al bando de los lobos, ganando nuevos poderes junto a ella.',
    },
    {
        name: 'Cambiaformas',
        Icon: ShapeshifterIcon,
        color: 'text-green-400',
        description:
            'La primera noche, eliges a un jugador. Si esa persona muere, tú adoptas su rol y su equipo, sea cual sea, para el resto de la partida.',
    },
    {
        name: 'Hombre Ebrio',
        Icon: DrunkManIcon,
        color: 'text-green-400',
        description:
            'Ganas la partida si consigues que te eliminen, ya sea por votación del pueblo o por ataque de los lobos. Tu objetivo es morir.',
    },
    {
        name: 'Líder del Culto',
        Icon: CultLeaderIcon,
        color: 'text-green-400',
        description:
            'Cada noche, conviertes a un jugador a tu culto. Ganas la partida si todos los jugadores vivos forman parte de tu culto.',
    },
    {
        name: 'Pescador',
        Icon: FishermanIcon,
        color: 'text-green-400',
        description:
            'Cada noche, subes a un jugador a tu barco. Ganas si logras subir a todos los aldeanos. Si intentas subir a un lobo, mueres.',
    },
    {
        name: 'Vampiro',
        Icon: VampireIcon,
        color: 'text-green-400',
        description:
            'Cada noche, chupas la sangre de un jugador. Si chupas la sangre de la misma persona tres veces, esta muere. Ganas si consigues asesinar a 3 jugadores de esta forma.',
    },
    {
        name: 'Bruja',
        Icon: WitchIcon,
        color: 'text-green-400',
        description:
            'Cada noche, buscas a la Vidente. Si la encuentras, los lobos la eliminarán y tú te unirás a su bando, protegida de sus ataques.',
    },
    {
        name: 'Banshee',
        Icon: BansheeIcon,
        color: 'text-green-400',
        description:
            'Una vez por partida, lanzas un grito sobre un jugador. Si ese jugador muere esa noche o al día siguiente, puedes lanzar un segundo grito en otra noche. Si aciertas las dos veces, ganas la partida.',
    },
]


const RoleSection = ({ title, roles, teamColor }: { title: string, roles: typeof aldeanosRoles, teamColor: string }) => (
    <Card className="bg-card/80">
        <CardHeader>
            <CardTitle className={cn("font-headline text-3xl", teamColor)}>{title}</CardTitle>
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
);

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
                            <h3 className="font-bold text-green-400">Para los Roles Especiales (Solitarios):</h3>
                            <p className="text-muted-foreground">
                                Algunos roles tienen sus propias condiciones de victoria, como el Hombre Ebrio que debe morir o el Líder del Culto que debe convertir a todos. ¡Lee bien tu carta!
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
                
                <RoleSection title="El Pueblo (Equipo Azul)" roles={aldeanosRoles} teamColor="text-blue-400" />
                <RoleSection title="Los Lobos (Equipo Rojo)" roles={lobosRoles} teamColor="text-destructive" />
                <RoleSection title="Roles Especiales (Solitarios / Otros)" roles={especialesRoles} teamColor="text-green-400" />

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


    