
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { BriefcaseMedical, User, Heart, FlaskConical, Crown, Fingerprint, Users2, Shield, Sparkles, Crosshair, BotIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

interface RoleRevealProps {
  player: Player;
  onAcknowledge: () => void;
}

type RoleDetail = {
    name: string;
    description: string;
    atmosphere: string;
    image: string;
    color: string;
    bgImageId: string;
}

const roleDetails: Partial<Record<NonNullable<Player['role']>, RoleDetail>> = {
    werewolf: {
        name: "Hombre Lobo",
        description: "Cada noche, tú y tus compañeros lobos elegís a un aldeano para eliminar. Durante el día, debéis haceros pasar por aldeanos inocentes.",
        atmosphere: "La luna llena es tu guía. La caza ha comenzado.",
        image: "/roles/werewolf.png",
        color: "text-destructive",
        bgImageId: "role-bg-werewolf"
    },
    wolf_cub: {
        name: "Cría de Lobo",
        description: "Eres un lobo, pero si mueres, la noche siguiente los lobos podrán matar a dos jugadores.",
        atmosphere: "Tu pérdida desatará la furia de la manada.",
        image: "/roles/wolf_cub.png",
        color: "text-destructive",
        bgImageId: "role-bg-werewolf"
    },
    seer: {
        name: "Vidente",
        description: "Cada noche, puedes elegir a un jugador para descubrir su verdadera identidad. Usa esta información sabiamente para guiar a los aldeanos.",
        atmosphere: "Ves más allá de las apariencias. La verdad te será revelada.",
        image: "/roles/seer.png",
        color: "text-blue-400",
        bgImageId: "role-bg-seer"
    },
    doctor: {
        name: "Doctor",
        description: "Cada noche, puedes elegir a un jugador para protegerlo. No puedes proteger a la misma persona dos noches seguidas.",
        atmosphere: "En tus manos está el poder de dar una noche más de vida.",
        image: "/roles/doctor.png", // This will fallback gracefully if not present
        color: "text-green-400",
        bgImageId: "role-bg-doctor"
    },
    villager: {
        name: "Aldeano",
        description: "Eres un miembro del pueblo. Tu único poder es tu voz y tu voto. Presta atención durante el día y vota para eliminar a quienes creas que son hombres lobo.",
        atmosphere: "Tu ingenio y tu voz son tus únicas armas. Sobrevive.",
        image: "/roles/villager.png",
        color: "text-primary-foreground/80",
        bgImageId: "role-bg-villager"
    },
    hunter: {
        name: "Cazador",
        description: "Si eres eliminado (ya sea de noche o por votación), puedes disparar tu última bala y llevarte a otro jugador contigo a la tumba.",
        atmosphere: "Tu pulso es firme. Incluso en la muerte, tu puntería será certera.",
        image: "/roles/hunter.png",
        color: "text-yellow-500",
        bgImageId: "role-bg-hunter"
    },
    cupid: {
        name: "Cupido",
        description: "En la primera noche, elige a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá de desamor.",
        atmosphere: "Una de tus flechas puede cambiar el destino del pueblo para siempre.",
        image: "/roles/cupid.png",
        color: "text-pink-400",
        bgImageId: "role-bg-cupid"
    },
    hechicera: {
        name: "Hechicera",
        description: "Tienes una poción para salvar a la víctima de los lobos y otra para envenenar a un jugador. Puedes usar cada una una vez por partida.",
        atmosphere: "El poder de la vida y la muerte está en tus manos.",
        image: "/roles/Witch.png", 
        color: "text-purple-400",
        bgImageId: "role-bg-werewolf" 
    },
    prince: {
        name: "Príncipe",
        description: "Si eres el más votado para ser linchado, revelas tu identidad y sobrevives. No puedes ser eliminado por votación.",
        atmosphere: "Tu sangre real te protege del juicio de la plebe.",
        image: "/roles/Prince.png",
        color: "text-yellow-300",
        bgImageId: "role-bg-hunter" 
    },
    lycanthrope: {
        name: "Licántropo",
        description: "Eres un aldeano, pero la Vidente te ve como un lobo. Tu inocencia es tu mayor desafío.",
        atmosphere: "Marcado por la luna, pero fiel al pueblo. ¿Podrás convencerlos?",
        image: "/roles/lycanthrope.png",
        color: "text-orange-400",
        bgImageId: "role-bg-werewolf" 
    },
    twin: {
        name: "Gemelo/a",
        description: "No estás solo/a. Hay otro jugador que es tu gemelo/a. Os conocéis desde el principio y sois aliados.",
        atmosphere: "Un vínculo inquebrantable en medio del caos.",
        image: "/roles/twin.png",
        color: "text-blue-300",
        bgImageId: "role-bg-villager" 
    },
    guardian: {
        name: "Guardián",
        description: "Cada noche, eliges a un jugador para protegerlo. Ese jugador no podrá ser asesinado por los lobos. No puedes protegerte a ti mismo.",
        atmosphere: "Tu escudo es la última esperanza para los inocentes.",
        image: "/roles/Guardian.png",
        color: "text-gray-300",
        bgImageId: "role-bg-doctor"
    },
    priest: {
        name: "Sacerdote",
        description: "Cada noche, bendices a un jugador, protegiéndolo de todo mal. Solo puedes bendecirte a ti mismo una vez por partida.",
        atmosphere: "Tu fe es un escudo impenetrable contra la oscuridad.",
        image: "/roles/priest.png",
        color: "text-yellow-200",
        bgImageId: "role-bg-seer"
    },
    cursed: {
        name: "Maldito",
        description: "Empiezas como un aldeano. Si los lobos te atacan, te conviertes en uno de ellos en lugar de morir.",
        atmosphere: "Una maldición corre por tus venas. Tu destino es incierto.",
        image: "/roles/cursed.png",
        color: "text-orange-600",
        bgImageId: "role-bg-werewolf"
    },
}

const defaultRoleDetail: RoleDetail = {
    name: "Rol Desconocido",
    description: "Tu rol no se ha podido determinar. Por favor, contacta al administrador.",
    atmosphere: "El misterio te envuelve...",
    image: "/roles/villager.png",
    color: "text-gray-400",
    bgImageId: "role-bg-villager"
}


export function RoleReveal({ player, onAcknowledge }: RoleRevealProps) {
    if (!player.role) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                <p>Asignando roles...</p>
            </div>
        )
    }

    const details = roleDetails[player.role] ?? defaultRoleDetail;
    const bgImage = PlaceHolderImages.find((img) => img.id === details.bgImageId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in">
        {bgImage && (
            <Image
                src={bgImage.imageUrl}
                alt={bgImage.description}
                fill
                className="object-cover z-0"
                data-ai-hint={bgImage.imageHint}
            />
        )}
        <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
        
        <Card className="w-full max-w-md m-4 text-center animate-in zoom-in-95 bg-card/80 border-border/50 z-10">
            <CardHeader>
                <CardDescription>Tu rol es...</CardDescription>
                <CardTitle className={cn("font-headline text-5xl", details.color)}>
                    {details.name}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="relative h-48 w-48 mx-auto">
                    <Image 
                        src={details.image} 
                        alt={details.name}
                        fill
                        className="object-contain"
                        onError={(e) => {
                            // Fallback if the image doesn't exist
                            e.currentTarget.src = '/roles/villager.png';
                        }}
                    />
                </div>
                <p className="text-lg font-bold italic text-primary-foreground/90">
                    {details.atmosphere}
                </p>
                <p className="text-muted-foreground text-base">
                    {details.description}
                </p>
            </CardContent>
            <CardFooter>
                <Button className="w-full text-lg" onClick={onAcknowledge}>Entendido</Button>
            </CardFooter>
        </Card>
    </div>
  );
}
