
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { DoctorIcon, HunterIcon, SeerIcon, VillagerIcon, WolfIcon, CupidIcon } from "../icons";
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
    Icon: React.ElementType;
    color: string;
    bgImageId: string;
}

const roleDetails: Record<NonNullable<Player['role']>, RoleDetail> = {
    werewolf: {
        name: "Hombre Lobo",
        description: "Cada noche, tú y tus compañeros lobos elegís a un aldeano para eliminar. Durante el día, debéis haceros pasar por aldeanos inocentes.",
        atmosphere: "La luna llena es tu guía. La caza ha comenzado.",
        Icon: WolfIcon,
        color: "text-destructive",
        bgImageId: "role-bg-werewolf"
    },
    seer: {
        name: "Vidente",
        description: "Cada noche, puedes elegir a un jugador para descubrir su verdadera identidad. Usa esta información sabiamente para guiar a los aldeanos.",
        atmosphere: "Ves más allá de las apariencias. La verdad te será revelada.",
        Icon: SeerIcon,
        color: "text-blue-400",
        bgImageId: "role-bg-seer"
    },
    doctor: {
        name: "Doctor",
        description: "Cada noche, puedes elegir a un jugador (incluido tú mismo) para protegerlo de los ataques de los lobos. No puedes elegir al mismo jugador dos noches seguidas.",
        atmosphere: "En tus manos está el poder de dar una noche más de vida.",
        Icon: DoctorIcon,
        color: "text-green-400",
        bgImageId: "role-bg-doctor"
    },
    villager: {
        name: "Aldeano",
        description: "Eres un miembro del pueblo. Tu único poder es tu voz y tu voto. Presta atención durante el día y vota para eliminar a quienes creas que son hombres lobo.",
        atmosphere: "Tu ingenio y tu voz son tus únicas armas. Sobrevive.",
        Icon: VillagerIcon,
        color: "text-primary-foreground/80",
        bgImageId: "role-bg-villager"
    },
    hunter: {
        name: "Cazador",
        description: "Si eres eliminado (ya sea de noche o por votación), puedes disparar tu última bala y llevarte a otro jugador contigo a la tumba.",
        atmosphere: "Tu pulso es firme. Incluso en la muerte, tu puntería será certera.",
        Icon: HunterIcon,
        color: "text-yellow-500",
        bgImageId: "role-bg-hunter"
    },
    cupid: {
        name: "Cupido",
        description: "En la primera noche, elige a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá de desamor.",
        atmosphere: "Una de tus flechas puede cambiar el destino del pueblo para siempre.",
        Icon: CupidIcon,
        color: "text-pink-400",
        bgImageId: "role-bg-cupid"
    }
}

export function RoleReveal({ player, onAcknowledge }: RoleRevealProps) {
    if (!player.role) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                <p>Asignando roles...</p>
            </div>
        )
    }

    const details = roleDetails[player.role];
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
                <details.Icon className={cn("h-24 w-24 mx-auto", details.color)} />
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
